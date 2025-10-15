import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";
// Use Vite to emit wasm helper script and derive base path at runtime
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite adds ?url support at build time
import wasmHelperUrl from "@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, RotateCcw, Download, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/data/loadProducts";

interface VirtualTryOnProps {
  product: Product;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export const VirtualTryOn = ({ product, onClose, onPrev, onNext }: VirtualTryOnProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const frameRequestedRef = useRef<number | null>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  // Use refs so the animation loop always sees the latest landmarker instances
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const [earPositions, setEarPositions] = useState<{ left?: { x: number; y: number }; right?: { x: number; y: number }; neck?: { x: number; y: number } }>({});
  const [wristPosition, setWristPosition] = useState<{ x: number; y: number } | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const lastDetectTimeRef = useRef<number>(0);
  const lastPositionsRef = useRef<typeof earPositions>({});
  const minDetectIntervalMs = 66; // ~15 FPS landmarking for smoother UI + lower CPU
  const smoothRef = useRef<{ left?: { x: number; y: number }; right?: { x: number; y: number }; neck?: { x: number; y: number }; wrist?: { x: number; y: number } }>({});
  // smoothing state + ref so debug panel can tune it live
  const [smoothingAlpha, setSmoothingAlpha] = useState<number>(0.6);
  const smoothingAlphaRef = useRef<number>(smoothingAlpha);
  useEffect(() => { smoothingAlphaRef.current = smoothingAlpha; }, [smoothingAlpha]);
  // Offsets and scale for fine-tuning overlay placement
  const [offsets, setOffsets] = useState<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });
  const offsetsRef = useRef(offsets);
  useEffect(() => { offsetsRef.current = offsets; }, [offsets]);
  // Cache for processed transparent images by original src
  const transparentCache = useRef<Record<string,string>>({});

  // Utility: map normalized landmark (0..1) to displayed pixel inside the video element
  const mapNormalizedToDisplayed = (nx: number, ny: number, videoEl: HTMLVideoElement) => {
    const rect = videoEl.getBoundingClientRect();
    // video.videoWidth/videoHeight is the intrinsic size. With object-fit: contain, the video may be letterboxed.
    const vw = videoEl.videoWidth || rect.width;
    const vh = videoEl.videoHeight || rect.height;

    const scale = Math.min(rect.width / vw, rect.height / vh);
    const displayW = vw * scale;
    const displayH = vh * scale;
    const offsetX = (rect.width - displayW) / 2;
    const offsetY = (rect.height - displayH) / 2;

    // normalized coordinates relative to intrinsic frame
    const x = nx * displayW + offsetX;
    const y = ny * displayH + offsetY;
    // mirror
    const mirroredX = rect.width - x;
    return { x: mirroredX, y };
  };

  const averagePoints = (pts: {x:number;y:number}[]) => {
    if (!pts.length) return undefined;
    const acc = pts.reduce((a,b) => ({ x: a.x + b.x, y: a.y + b.y }), { x:0, y:0 });
    return { x: acc.x / pts.length, y: acc.y / pts.length };
  };

  // Canvas-based white->transparent processor. Returns a data URL (cached). Best-effort: may fail cross-origin.
  const makeImageTransparent = async (src: string) => {
    if (transparentCache.current[src]) return transparentCache.current[src];
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = src;
      });
      const w = img.naturalWidth; const h = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no-ctx');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0,0,w,h);
      for (let i=0;i<data.data.length;i+=4) {
        const r = data.data[i], g = data.data[i+1], b = data.data[i+2];
        // if pixel is near-white, make transparent
        if (r > 240 && g > 240 && b > 240) {
          data.data[i+3] = 0;
        }
      }
      ctx.putImageData(data, 0, 0);
      const out = c.toDataURL('image/png');
      transparentCache.current[src] = out;
      return out;
    } catch (e) {
      // CORS or other failure: return original
      return src;
    }
  };

  // Preprocess product image when product changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const out = await makeImageTransparent(product.image);
        if (mounted) setProcessedImage(out);
      } catch (e) {
        if (mounted) setProcessedImage(product.image);
      }
    })();
    return () => { mounted = false; };
  }, [product.image]);

  // Debug overlay
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugTryOn') === '1';
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  type Point = { x: number; y: number };
  const fpsRef = useRef<{ lastTime: number; frameCount: number; fps: number }>({ lastTime: performance.now(), frameCount: 0, fps: 0 });
  const lastRawRef = useRef<{ left?: Point; right?: Point; neck?: Point } | null>(null);
  const lastFpsUpdateRef = useRef<number>(0);
  type DebugStats = { fps: number; resolution?: string; raw?: { left?: Point; right?: Point; neck?: Point }; smooth?: { left?: Point; right?: Point; neck?: Point } };
  const [debugStats, setDebugStats] = useState<DebugStats>({ fps: 0 });

  const drawDebugOverlay = useCallback((canvas: HTMLCanvasElement, videoEl: HTMLVideoElement, raw: { left?: Point; right?: Point; neck?: Point } | null, smooth: { left?: Point; right?: Point; neck?: Point } | null, fps: number) => {
    const rect = videoEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw raw points (cyan)
    const drawPt = (p: {x:number;y:number}, color: string, r = 4) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill();
      ctx.closePath();
    };

    if (raw) {
      if (raw.left) drawPt(raw.left, 'rgba(0,200,255,0.9)');
      if (raw.right) drawPt(raw.right, 'rgba(0,200,255,0.9)');
      if (raw.neck) drawPt(raw.neck, 'rgba(0,200,255,0.9)');
    }
    // Draw smoothed points (yellow)
    if (smooth) {
      if (smooth.left) drawPt(smooth.left, 'rgba(255,200,0,0.95)', 5);
      if (smooth.right) drawPt(smooth.right, 'rgba(255,200,0,0.95)', 5);
      if (smooth.neck) drawPt(smooth.neck, 'rgba(255,200,0,0.95)', 5);
    }

    // Draw FPS and resolution
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '12px ui-sans-serif, system-ui';
    ctx.fillText(`FPS: ${Math.round(fps)}`, 8, 16);
    ctx.fillText(`Res: ${videoEl.videoWidth}x${videoEl.videoHeight}`, 8, 32);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" },
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
          // Kick off a very light animation loop so the browser optimizes compositing of overlay
          const tick = () => {
            // Always read from refs inside the animation loop so we observe changes
            const fl = faceLandmarkerRef.current;
            const hl = handLandmarkerRef.current;
            if (!videoRef.current || !fl) {
              const id = requestAnimationFrame(tick);
              frameRequestedRef.current = id;
              return;
            }
            try {
              const now = performance.now();
              // Throttle landmarking to reduce CPU/GPU load
              if (now - lastDetectTimeRef.current >= minDetectIntervalMs) {
                lastDetectTimeRef.current = now;
                const result = fl.detectForVideo(videoRef.current, now);
                const landmarks = result.faceLandmarks?.[0];
                if (landmarks && videoRef.current) {
                  // Robust anchor calculation: compute face bounding box from all landmarks
                  // and use left/right extremes as ear anchors; chin as the lowest y landmark
                  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                  for (let i = 0; i < landmarks.length; i++) {
                    const p = landmarks[i];
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                  }

                  // pick vertical midpoint for ear anchors slightly above center
                  const midY = (minY + maxY) / 2;
                  const leftNorm = { x: minX, y: midY };
                  const rightNorm = { x: maxX, y: midY };
                  // chin as the maxY point
                  const chinNorm = { x: (minX + maxX) / 2, y: maxY };

                  const left = mapNormalizedToDisplayed(leftNorm.x, leftNorm.y, videoRef.current!);
                  const right = mapNormalizedToDisplayed(rightNorm.x, rightNorm.y, videoRef.current!);
                  const chin = mapNormalizedToDisplayed(chinNorm.x, chinNorm.y, videoRef.current!);

                  // Only update React state if movement is significant (avoid reflows)
                  const prev = lastPositionsRef.current;
                  const movedEnough = (a?: {x:number;y:number}, b?: {x:number;y:number}) => {
                    if (!a || !b) return true;
                    const dx = a.x - b.x; const dy = a.y - b.y;
                    return (dx*dx + dy*dy) > 9; // >3px movement
                  };

                  const next = { left, right, neck: chin };
                  const rawPts = next;
                  // EMA smoothing
                  const s = smoothRef.current;
                  const ema = (oldV: {x:number;y:number}|undefined, newV: {x:number;y:number}) => {
                    const a = smoothingAlphaRef.current;
                    if (!oldV) return newV;
                    return { x: oldV.x*(1-a) + newV.x*a, y: oldV.y*(1-a) + newV.y*a };
                  };
                  const smoothNext = {
                    left: ema(s.left, next.left),
                    right: ema(s.right, next.right),
                    neck: ema(s.neck, next.neck),
                  } as typeof s;
                  smoothRef.current = smoothNext;

                  if (
                    movedEnough(prev.left, smoothNext.left) ||
                    movedEnough(prev.right, smoothNext.right) ||
                    movedEnough(prev.neck, smoothNext.neck)
                  ) {
                    lastPositionsRef.current = smoothNext;
                    setEarPositions(smoothNext);
                  }
                  // update raw cache for debug
                  lastRawRef.current = rawPts;
                }
                if (hl && videoRef.current) {
                  const hands = hl.detectForVideo(videoRef.current, now);
                  const hand = hands.handednesses?.[0] && hands.landmarks?.[0];
                  if (hand) {
                    const rect = videoRef.current.getBoundingClientRect();
                    // WRIST index 0 -> map to displayed, mirror X
                    const nx = hand[0].x; const ny = hand[0].y;
                    const wrist = { x: rect.width - nx * rect.width, y: ny * rect.height };
                    // Smooth wrist
                    const s = smoothRef.current;
                      const emaPt = (oldV: {x:number;y:number}|undefined, newV: {x:number;y:number}) => {
                        const a = smoothingAlphaRef.current;
                        return (!oldV ? newV : { x: oldV.x*(1-a) + newV.x*a, y: oldV.y*(1-a) + newV.y*a });
                      };
                    smoothRef.current = { ...s, wrist: emaPt(s.wrist, wrist) };
                    setWristPosition(smoothRef.current.wrist!);
                  }
                }
              }
              // FPS counting
              const fr = fpsRef.current;
              fr.frameCount += 1;
              const elapsed = now - fr.lastTime;
              if (elapsed >= 500) {
                fr.fps = (fr.frameCount * 1000) / elapsed;
                fr.lastTime = now;
                fr.frameCount = 0;
                // throttle debug UI updates
                if (debugMode && overlayCanvasRef.current && videoRef.current) {
                  drawDebugOverlay(overlayCanvasRef.current, videoRef.current, lastRawRef.current, smoothRef.current, fr.fps);
                  const nowTick = performance.now();
                  if (nowTick - lastFpsUpdateRef.current > 250) {
                    lastFpsUpdateRef.current = nowTick;
                    setDebugStats({ fps: fr.fps, resolution: `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`, raw: lastRawRef.current ?? undefined, smooth: smoothRef.current ?? undefined });
                  }
                }
              }
            } catch {
              // ignore per-frame errors
            }
            const id = requestAnimationFrame(tick);
            frameRequestedRef.current = id;
          };
          const id = requestAnimationFrame(tick);
          frameRequestedRef.current = id;
        };
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Could not access camera. Please check permissions.");
    }
  }, [drawDebugOverlay, debugMode]);

  useEffect(() => {
    let isMounted = true;
    // Capture video ref at effect start for a stable reference in cleanup
    const capturedVideoRef = videoRef.current;
    const init = async () => {
      await startCamera();
      try {
        const u = new URL(wasmHelperUrl, window.location.href);
        // Strip filename to get directory base
        const wasmBase = u.toString().replace(/vision_wasm_internal\.js(?:\?.*)?$/i, "");
        const filesetResolver = await FilesetResolver.forVisionTasks(wasmBase);
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          },
          outputFaceBlendshapes: false,
          runningMode: "VIDEO",
          numFaces: 1,
        });
        let hand: HandLandmarker | null = null;
        try {
          hand = await HandLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            },
            runningMode: "VIDEO",
            numHands: 1,
          });
        } catch (e) {
          console.warn("HandLandmarker init failed", e);
        }
        if (isMounted) {
          setFaceLandmarker(landmarker);
          faceLandmarkerRef.current = landmarker;
          if (hand) {
            setHandLandmarker(hand);
            handLandmarkerRef.current = hand;
          }
        }
      } catch (e) {
        console.warn("FaceLandmarker init failed", e);
      }
    };
    init();
    return () => {
      // Use the captured video ref to avoid lint about ref changing before cleanup
      const localVideo = capturedVideoRef;
      const localFrame = frameRequestedRef.current;
      if (localVideo && localVideo.srcObject) {
        const stream = localVideo.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (localFrame != null) {
        cancelAnimationFrame(localFrame);
        frameRequestedRef.current = null;
      }
      isMounted = false;
    };
  }, [startCamera]);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    if (frameRequestedRef.current != null) {
      cancelAnimationFrame(frameRequestedRef.current);
      frameRequestedRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        const imageData = canvasRef.current.toDataURL('image/png');
        setCapturedImage(imageData);
        toast.success("Photo captured! You can now share or save it.");
      }
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const downloadImage = () => {
    if (capturedImage) {
      const link = document.createElement('a');
      link.download = `evol-jewels-tryon-${product.id}.png`;
      link.href = capturedImage;
      link.click();
      toast.success("Image downloaded!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-auto">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-2xl font-bold">Virtual Try-On</h3>
                <p className="text-sm text-muted-foreground">{product.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onPrev && (
                <Button variant="outline" size="sm" onClick={onPrev}>
                  Previous
                </Button>
              )}
              {onNext && (
                <Button variant="outline" size="sm" onClick={onNext}>
                  Next
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Camera View */}
            <div className="space-y-4">
              <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden">
                {!capturedImage ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain mirror"
                      style={{ transform: 'scaleX(-1)', objectFit: 'contain' }}
                    />
                    
                    {/* AR Overlay - Simulated jewelry overlay */}
                    {isStreaming && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {/* Dynamic AR overlays based on category */}
                        {product.category.toLowerCase().includes("ear") && earPositions.left && earPositions.right && (
                          <>
                            {(() => {
                              // Scale earrings by ear distance
                              const dx = (earPositions.right!.x - earPositions.left!.x);
                              const dy = (earPositions.right!.y - earPositions.left!.y);
                              const earDist = Math.sqrt(dx*dx + dy*dy);
                              const size = Math.max(36, Math.min(96, earDist * 0.45));
                              const half = size / 2;
                              const styleCommon = {
                                width: `${size}px`,
                                height: `${size}px`,
                                filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.35))',
                                willChange: 'transform' as const,
                              };
                              return (
                                <>
                                  <img
                                    src={processedImage ?? transparentCache.current[product.image] ?? product.image}
                                    alt={product.name}
                                    className="absolute object-contain opacity-90 drop-shadow-2xl"
                                    style={{
                                      ...styleCommon,
                                      transform: `translate3d(${earPositions.left!.x - half + offsetsRef.current.x}px, ${earPositions.left!.y - (size*0.15) + offsetsRef.current.y}px, 0) scale(${offsetsRef.current.scale})`,
                                    }}
                                  />
                                  <img
                                    src={processedImage ?? transparentCache.current[product.image] ?? product.image}
                                    alt={product.name}
                                    className="absolute object-contain opacity-90 drop-shadow-2xl"
                                    style={{
                                      ...styleCommon,
                                      transform: `translate3d(${earPositions.right!.x - half + offsetsRef.current.x}px, ${earPositions.right!.y - (size*0.15) + offsetsRef.current.y}px, 0) scale(${offsetsRef.current.scale})`,
                                    }}
                                  />
                                </>
                              );
                            })()}
                            {debugMode && (
                              <canvas
                                ref={el => { overlayCanvasRef.current = el }}
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                style={{ width: '100%', height: '100%' }}
                              />
                            )}
                          </>
                        )}
                        {product.category.toLowerCase().includes("neck") && earPositions.neck && earPositions.left && earPositions.right && (
                          (() => {
                            // Necklace width based on face width; position slightly below chin
                            const dx = (earPositions.right!.x - earPositions.left!.x);
                            const dy = (earPositions.right!.y - earPositions.left!.y);
                            const faceWidth = Math.sqrt(dx*dx + dy*dy);
                            const width = Math.max(160, Math.min(320, faceWidth * 1.6));
                            const height = width * 0.5;
                            const x = earPositions.neck!.x - width / 2;
                            const y = earPositions.neck!.y + Math.min(40, height * 0.2);
                            return (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="absolute object-contain opacity-90 drop-shadow-2xl"
                                style={{
                                  width: `${width}px`,
                                  height: `${height}px`,
                                  transform: `translate3d(${x}px, ${y}px, 0)`,
                                  filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.35))',
                                  willChange: 'transform',
                                }}
                              />
                            );
                          })()
                        )}
                        {product.category.toLowerCase().includes("bracelet") && wristPosition && (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="absolute object-contain opacity-90 drop-shadow-2xl"
                            style={{
                              width: "160px",
                              height: "160px",
                              transform: `translate3d(${wristPosition.x - 80}px, ${wristPosition.y - 40}px, 0)`,
                              filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.35))',
                              willChange: 'transform',
                            }}
                          />
                        )}
                        {!product.category.toLowerCase().includes("ear") && !product.category.toLowerCase().includes("neck") && !product.category.toLowerCase().includes("bracelet") && (
                          <div className="relative">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-64 h-64 object-contain opacity-70 drop-shadow-2xl will-change-transform"
                              style={{ filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.5))' }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Camera Controls */}
              <div className="flex gap-3">
                {!capturedImage ? (
                  <div className="flex-1 flex gap-2">
                    {onPrev && (
                      <Button variant="outline" onClick={onPrev} className="w-28">
                        Prev
                      </Button>
                    )}
                    <Button 
                      variant="luxury" 
                      size="lg" 
                      className="flex-1"
                      onClick={capturePhoto}
                      disabled={!isStreaming}
                    >
                      <Camera className="w-5 h-5" />
                      Capture Photo
                    </Button>
                    {onNext && (
                      <Button variant="outline" onClick={onNext} className="w-28">
                        Next
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="flex-1"
                      onClick={retake}
                    >
                      <RotateCcw className="w-5 h-5" />
                      Retake
                    </Button>
                    <Button 
                      variant="luxury" 
                      size="lg" 
                      className="flex-1"
                      onClick={downloadImage}
                    >
                      <Download className="w-5 h-5" />
                      Download
                    </Button>
                  </>
                )}
              </div>

              {/* Debug Panel */}
              {debugMode && (
                <div className="fixed right-6 top-24 z-60 w-72 p-4 bg-white/95 text-black rounded-lg shadow-lg">
                  <h4 className="font-semibold mb-2">AR Debug</h4>
                  <div className="text-xs text-muted-foreground mb-2">FPS: {Math.round(debugStats.fps)}</div>
                  <div className="text-xs text-muted-foreground mb-2">Res: {debugStats.resolution}</div>
                  <div className="mb-2">
                    <label className="text-xs">Smoothing: {smoothingAlpha.toFixed(2)}</label>
                    <input type="range" min="0.05" max="0.95" step="0.01" value={smoothingAlpha} onChange={(e) => setSmoothingAlpha(Number(e.target.value))} className="w-full" />
                  </div>
                  <div className="mb-2">
                    <label className="text-xs">Offset X: {offsets.x}px</label>
                    <input type="range" min="-80" max="80" step="1" value={offsets.x} onChange={(e) => setOffsets(o => ({ ...o, x: Number(e.target.value) }))} className="w-full" />
                  </div>
                  <div className="mb-2">
                    <label className="text-xs">Offset Y: {offsets.y}px</label>
                    <input type="range" min="-80" max="80" step="1" value={offsets.y} onChange={(e) => setOffsets(o => ({ ...o, y: Number(e.target.value) }))} className="w-full" />
                  </div>
                  <div className="mb-1">
                    <label className="text-xs">Scale: {offsets.scale.toFixed(2)}</label>
                    <input type="range" min="0.5" max="1.8" step="0.01" value={offsets.scale} onChange={(e) => setOffsets(o => ({ ...o, scale: Number(e.target.value) }))} className="w-full" />
                  </div>
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-2xl font-bold mb-2">{product.name}</h4>
                  <p className="text-muted-foreground">{product.description}</p>
                </div>

                <div className="flex items-center justify-between py-4 border-y">
                  <span className="text-sm text-muted-foreground">Price</span>
                  <span className="text-3xl font-bold text-gradient-gold">
                    ₹{product.price.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{product.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Collection</span>
                    <span className="font-medium">{product.collection}</span>
                  </div>
                </div>

                <Button variant="premium" size="lg" className="w-full">
                  Add to Cart - ₹{product.price.toLocaleString()}
                </Button>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Virtual Try-On Tips
            </h5>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Ensure good lighting for best results</li>
              <li>• Position yourself centered in the frame</li>
              <li>• The jewelry overlay simulates how the piece will look</li>
              <li>• Capture and share your look with friends</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
