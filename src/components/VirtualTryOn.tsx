import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";
// @ts-ignore
import wasmHelperUrl from "@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, RotateCcw, Download, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/data/loadProducts";

// MediaPipe Face Landmark Indices
// Using FACE OVAL landmarks which are closer to ears
const FACE_LANDMARKS = {
  LEFT_EAR_AREA: 454,        // Left face oval edge (very close to ear)
  RIGHT_EAR_AREA: 234,       // Right face oval edge (very close to ear)
  CHIN: 152,                 // Chin/jaw bottom
  NOSE_TIP: 1,              // Nose tip
  FOREHEAD_CENTER: 10,      // Forehead
} as const;

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
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  
  const [earPositions, setEarPositions] = useState<{ 
    left?: { x: number; y: number }; 
    right?: { x: number; y: number }; 
    neck?: { x: number; y: number };
  }>({});
  const [wristPosition, setWristPosition] = useState<{ x: number; y: number } | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  
  const lastDetectTimeRef = useRef<number>(0);
  const lastPositionsRef = useRef<typeof earPositions>({});
  const minDetectIntervalMs = 50; // 20 FPS for smoother detection
  
  const smoothRef = useRef<{ 
    left?: { x: number; y: number }; 
    right?: { x: number; y: number }; 
    neck?: { x: number; y: number }; 
    wrist?: { x: number; y: number } 
  }>({});
  
  const [smoothingAlpha, setSmoothingAlpha] = useState<number>(0.7);
  const smoothingAlphaRef = useRef<number>(smoothingAlpha);
  useEffect(() => { smoothingAlphaRef.current = smoothingAlpha; }, [smoothingAlpha]);
  
  // REDUCED ear offset - bringing earrings much closer
  const [earOffsetMultiplier, setEarOffsetMultiplier] = useState<number>(0.012);
  const earOffsetMultiplierRef = useRef<number>(earOffsetMultiplier);
  useEffect(() => { earOffsetMultiplierRef.current = earOffsetMultiplier; }, [earOffsetMultiplier]);
  
  const [offsets, setOffsets] = useState<{ x: number; y: number; scale: number }>({ 
    x: 0, 
    y: 0, // Default slight downward offset
    scale: 1 
  });
  const offsetsRef = useRef(offsets);
  useEffect(() => { offsetsRef.current = offsets; }, [offsets]);
  
  const transparentCache = useRef<Record<string,string>>({});
  
  // Debug mode
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugTryOn') === '1';
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  type Point = { x: number; y: number };
  const fpsRef = useRef<{ lastTime: number; frameCount: number; fps: number }>({ 
    lastTime: performance.now(), 
    frameCount: 0, 
    fps: 0 
  });
  const lastRawRef = useRef<{ left?: Point; right?: Point; neck?: Point } | null>(null);
  const lastFpsUpdateRef = useRef<number>(0);
  type DebugStats = { 
    fps: number; 
    resolution?: string; 
    raw?: { left?: Point; right?: Point; neck?: Point }; 
    smooth?: { left?: Point; right?: Point; neck?: Point };
    faceDetected: boolean;
  };
  const [debugStats, setDebugStats] = useState<DebugStats>({ fps: 0, faceDetected: false });
  const [showMarkers, setShowMarkers] = useState<boolean>(false);

  // Map normalized landmark (0..1) to displayed pixel with proper mirroring
  const mapNormalizedToDisplayed = (nx: number, ny: number, videoEl: HTMLVideoElement) => {
    const rect = videoEl.getBoundingClientRect();
    const vw = videoEl.videoWidth || rect.width;
    const vh = videoEl.videoHeight || rect.height;

    // Determine how the video is fit into the element (cover vs contain)
    const computedFit = (videoEl.style && videoEl.style.objectFit) || getComputedStyle(videoEl).objectFit || 'contain';
    const scale = computedFit === 'cover'
      ? Math.max(rect.width / vw, rect.height / vh)
      : Math.min(rect.width / vw, rect.height / vh);
    const displayW = vw * scale;
    const displayH = vh * scale;
    // offset can be negative for cover (cropping)
    const offsetX = (rect.width - displayW) / 2;
    const offsetY = (rect.height - displayH) / 2;

    // Convert normalized coordinates to display coordinates
    const x = nx * displayW + offsetX;
    const y = ny * displayH + offsetY;
    
    // Mirror X-axis for selfie view
    const mirroredX = rect.width - x;
    // Clamp to container to avoid overflow when using cover/crop
    const cx = Math.max(0, Math.min(rect.width, mirroredX));
    const cy = Math.max(0, Math.min(rect.height, y));
    return { x: cx, y: cy };
  };

  // Canvas-based white->transparent processor
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
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no-ctx');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      
      for (let i = 0; i < data.data.length; i += 4) {
        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];
        // Make near-white pixels transparent
        if (r > 240 && g > 240 && b > 240) {
          data.data[i + 3] = 0;
        }
      }
      ctx.putImageData(data, 0, 0);
      const out = c.toDataURL('image/png');
      transparentCache.current[src] = out;
      return out;
    } catch (e) {
      return src;
    }
  };

  // Preprocess product image
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

  // Debug overlay drawing
  const drawDebugOverlay = useCallback((
    canvas: HTMLCanvasElement, 
    videoEl: HTMLVideoElement, 
    raw: { left?: Point; right?: Point; neck?: Point } | null, 
    smooth: { left?: Point; right?: Point; neck?: Point } | null, 
    fps: number,
    detected: boolean
  ) => {
    const rect = videoEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const drawPt = (p: {x:number;y:number}, color: string, r = 4) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.closePath();
    };

    // Draw raw points (cyan)
    if (raw) {
      if (raw.left) drawPt(raw.left, 'rgba(0,200,255,0.9)', 8);
      if (raw.right) drawPt(raw.right, 'rgba(0,200,255,0.9)', 8);
      if (raw.neck) drawPt(raw.neck, 'rgba(0,200,255,0.9)');
    }
    
    // Draw smoothed points (yellow)
    if (smooth) {
      if (smooth.left) drawPt(smooth.left, 'rgba(255,200,0,0.95)', 10);
      if (smooth.right) drawPt(smooth.right, 'rgba(255,200,0,0.95)', 10);
      if (smooth.neck) drawPt(smooth.neck, 'rgba(255,200,0,0.95)', 6);
    }

    // Draw FPS and status
    ctx.fillStyle = detected ? 'rgba(0,255,100,0.95)' : 'rgba(255,100,100,0.95)';
    ctx.font = 'bold 14px ui-sans-serif, system-ui';
    ctx.fillText(`FPS: ${Math.round(fps)}`, 8, 20);
    ctx.fillText(`Res: ${videoEl.videoWidth}x${videoEl.videoHeight}`, 8, 40);
    ctx.fillText(detected ? '✓ Face Detected' : '✗ No Face', 8, 60);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      // Request higher quality video for better detection
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
          
          // Main detection loop
          const tick = () => {
            const fl = faceLandmarkerRef.current;
            const hl = handLandmarkerRef.current;
            
            if (!videoRef.current || !fl) {
              const id = requestAnimationFrame(tick);
              frameRequestedRef.current = id;
              return;
            }
            
            try {
              const now = performance.now();
              
              // Throttle detection
              if (now - lastDetectTimeRef.current >= minDetectIntervalMs) {
                lastDetectTimeRef.current = now;
                
                // Detect face landmarks
                const result = fl.detectForVideo(videoRef.current, now);
                const landmarks = result.faceLandmarks?.[0];
                
                if (landmarks && landmarks.length >= 478 && videoRef.current) {
                  setFaceDetected(true);
                  
                  // Use face oval edge landmarks (closest to ears)
                  // These are at the very edge of the face contour
                  const leftEdgeLandmark = landmarks[FACE_LANDMARKS.LEFT_EAR_AREA];
                  const rightEdgeLandmark = landmarks[FACE_LANDMARKS.RIGHT_EAR_AREA];
                  const chinLandmark = landmarks[FACE_LANDMARKS.CHIN];
                  
                  // Calculate face width for proportional calculation
                  const faceWidthNorm = Math.abs(rightEdgeLandmark.x - leftEdgeLandmark.x);
                  
                  // Tunable offsets: X proportion and Y shift (negative moves upward)
                  const earOffsetX = faceWidthNorm * earOffsetMultiplierRef.current;
                  const earOffsetY = faceWidthNorm * -0.052; // negative brings earrings slightly up toward ear

                  // Calculate ear positions - closer to face by default
                  const leftEarNorm = {
                    x: leftEdgeLandmark.x - earOffsetX,
                    y: leftEdgeLandmark.y + earOffsetY
                  };
                  const rightEarNorm = {
                    x: rightEdgeLandmark.x + earOffsetX,
                    y: rightEdgeLandmark.y + earOffsetY
                  };
                  
                  // Map to display coordinates
                  const left = mapNormalizedToDisplayed(leftEarNorm.x, leftEarNorm.y, videoRef.current);
                  const right = mapNormalizedToDisplayed(rightEarNorm.x, rightEarNorm.y, videoRef.current);
                  const chin = mapNormalizedToDisplayed(chinLandmark.x, chinLandmark.y, videoRef.current);
                  
                  const next = { left, right, neck: chin };
                  const rawPts = next;
                  
                  // EMA smoothing
                  const s = smoothRef.current;
                  const ema = (oldV: {x:number;y:number}|undefined, newV: {x:number;y:number}) => {
                    const a = smoothingAlphaRef.current;
                    if (!oldV) return newV;
                    return { 
                      x: oldV.x * (1 - a) + newV.x * a, 
                      y: oldV.y * (1 - a) + newV.y * a 
                    };
                  };
                  
                  const smoothNext = {
                    left: ema(s.left, next.left),
                    right: ema(s.right, next.right),
                    neck: ema(s.neck, next.neck),
                  };
                  smoothRef.current = smoothNext;
                  
                  // Update positions
                  const movedEnough = (a?: {x:number;y:number}, b?: {x:number;y:number}) => {
                    if (!a || !b) return true;
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    return (dx * dx + dy * dy) > 4; // >2px movement
                  };
                  
                  const prev = lastPositionsRef.current;
                  if (
                    movedEnough(prev.left, smoothNext.left) ||
                    movedEnough(prev.right, smoothNext.right) ||
                    movedEnough(prev.neck, smoothNext.neck)
                  ) {
                    lastPositionsRef.current = smoothNext;
                    setEarPositions(smoothNext);
                  }
                  
                  lastRawRef.current = rawPts;
                } else {
                  setFaceDetected(false);
                }
                
                // Hand detection for bracelets
                if (hl && videoRef.current) {
                  const hands = hl.detectForVideo(videoRef.current, now);
                  const hand = hands.handednesses?.[0] && hands.landmarks?.[0];
                  if (hand) {
                    const rect = videoRef.current.getBoundingClientRect();
                    const nx = hand[0].x;
                    const ny = hand[0].y;
                    const wrist = { 
                      x: rect.width - nx * rect.width, 
                      y: ny * rect.height 
                    };
                    
                    const emaPt = (oldV: {x:number;y:number}|undefined, newV: {x:number;y:number}) => {
                      const a = smoothingAlphaRef.current;
                      return (!oldV ? newV : { 
                        x: oldV.x * (1 - a) + newV.x * a, 
                        y: oldV.y * (1 - a) + newV.y * a 
                      });
                    };
                    
                    const s = smoothRef.current;
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
                
                if (debugMode && overlayCanvasRef.current && videoRef.current) {
                  drawDebugOverlay(
                    overlayCanvasRef.current, 
                    videoRef.current, 
                    lastRawRef.current, 
                    smoothRef.current, 
                    fr.fps,
                    faceDetected
                  );
                  
                  const nowTick = performance.now();
                  if (nowTick - lastFpsUpdateRef.current > 250) {
                    lastFpsUpdateRef.current = nowTick;
                    setDebugStats({ 
                      fps: fr.fps, 
                      resolution: `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`, 
                      raw: lastRawRef.current ?? undefined, 
                      smooth: smoothRef.current ?? undefined,
                      faceDetected
                    });
                  }
                }
              }
            } catch (err) {
              console.error("Detection error:", err);
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
  }, [drawDebugOverlay, debugMode, faceDetected]);

  useEffect(() => {
    let isMounted = true;
    const capturedVideoRef = videoRef.current;
    
    const init = async () => {
      await startCamera();
      
      try {
        const u = new URL(wasmHelperUrl, window.location.href);
        const wasmBase = u.toString().replace(/vision_wasm_internal\.js(?:\?.*)?$/i, "");
        const filesetResolver = await FilesetResolver.forVisionTasks(wasmBase);
        
        // Initialize Face Landmarker with optimized settings
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        
        let hand: HandLandmarker | null = null;
        try {
          hand = await HandLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
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
        console.error("FaceLandmarker init failed", e);
        toast.error("Failed to initialize face detection");
      }
    };
    
    init();
    
    return () => {
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

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.scale(-1, 1);
        context.drawImage(
          videoRef.current, 
          -canvasRef.current.width, 
          0, 
          canvasRef.current.width, 
          canvasRef.current.height
        );
        
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
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-transparent">
                {!capturedImage ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full mirror"
                      style={{ transform: 'scaleX(-1)', objectFit: 'cover' }}
                    />
                    
                    {/* Face detection status indicator */}
                    {isStreaming && (
                      <div className="absolute top-4 left-4 z-10">
                        <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${
                          faceDetected 
                            ? 'bg-green-500/90 text-white' 
                            : 'bg-amber-500/90 text-white'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            faceDetected ? 'bg-white' : 'bg-white animate-pulse'
                          }`} />
                          {faceDetected ? 'Face Detected' : 'Looking for face...'}
                        </div>
                      </div>
                    )}
                    
                    {/* AR Overlay */}
                    {isStreaming && faceDetected && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {/* Debug markers toggle */}
                        <div className="absolute top-4 right-4 z-20">
                          <button className="px-2 py-1 text-xs bg-white/80 rounded" onClick={() => setShowMarkers(s => !s)}>
                            {showMarkers ? 'Hide markers' : 'Show markers'}
                          </button>
                        </div>
                        {/* Earrings */}
                        {product.category.toLowerCase().includes("ear") && earPositions.left && earPositions.right && (
                          <>
                            {(() => {
                              const dx = (earPositions.right!.x - earPositions.left!.x);
                              const dy = (earPositions.right!.y - earPositions.left!.y);
                              const earDist = Math.sqrt(dx * dx + dy * dy);
                              const size = Math.max(50, Math.min(110, earDist * 0.35));
                              const half = size / 2;
                              const styleCommon = {
                                width: `${size}px`,
                                height: `${size}px`,
                                filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.35))',
                                willChange: 'transform',
                                transition: 'transform 0.05s ease-out',
                              };
                              return (
                                <>
                                  <img
                                    src={processedImage ?? product.image}
                                    alt={product.name}
                                    className="absolute object-contain opacity-95 drop-shadow-2xl"
                                    style={{
                                      ...styleCommon,
                                      transform: `translate3d(${earPositions.left!.x - half + offsetsRef.current.x}px, ${earPositions.left!.y - half + offsetsRef.current.y}px, 0) scale(${offsetsRef.current.scale})`,
                                    }}
                                  />
                                  <img
                                    src={processedImage ?? product.image}
                                    alt={product.name}
                                    className="absolute object-contain opacity-95 drop-shadow-2xl"
                                    style={{
                                      ...styleCommon,
                                      transform: `translate3d(${earPositions.right!.x - half + offsetsRef.current.x}px, ${earPositions.right!.y - half + offsetsRef.current.y}px, 0) scale(${offsetsRef.current.scale})`,
                                    }}
                                  />
                                </>
                              );
                            })()}
                          </>
                        )}
                        
                        {/* Necklace */}
                        {product.category.toLowerCase().includes("neck") && earPositions.neck && earPositions.left && earPositions.right && (
                          (() => {
                            const dx = (earPositions.right!.x - earPositions.left!.x);
                            const dy = (earPositions.right!.y - earPositions.left!.y);
                            const faceWidth = Math.sqrt(dx * dx + dy * dy);
                            const width = Math.max(160, Math.min(340, faceWidth * 1.7));
                            const height = width * 0.5;
                            const x = earPositions.neck!.x - width / 2;
                            const y = earPositions.neck!.y + Math.min(45, height * 0.25);
                            return (
                              <img
                                src={processedImage ?? product.image}
                                alt={product.name}
                                className="absolute object-contain opacity-95 drop-shadow-2xl"
                                style={{
                                  width: `${width}px`,
                                  height: `${height}px`,
                                  transform: `translate3d(${x}px, ${y}px, 0) scale(${offsetsRef.current.scale})`,
                                  filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.4))',
                                  willChange: 'transform',
                                  transition: 'transform 0.05s ease-out',
                                }}
                              />
                            );
                          })()
                        )}
                        
                        {/* Bracelet */}
                        {product.category.toLowerCase().includes("bracelet") && wristPosition && (
                          <img
                            src={processedImage ?? product.image}
                            alt={product.name}
                            className="absolute object-contain opacity-95 drop-shadow-2xl"
                            style={{
                              width: "180px",
                              height: "180px",
                              transform: `translate3d(${wristPosition.x - 90}px, ${wristPosition.y - 50}px, 0) scale(${offsetsRef.current.scale})`,
                              filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.4))',
                              willChange: 'transform',
                              transition: 'transform 0.05s ease-out',
                            }}
                          />
                        )}
                        
                        {/* Debug overlay */}
                        {debugMode && (
                          <canvas
                            ref={overlayCanvasRef}
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            style={{ width: '100%', height: '100%' }}
                          />
                        )}
                        {showMarkers && (
                          <>
                            {earPositions.left && <div style={{ position: 'absolute', left: earPositions.left.x - 6, top: earPositions.left.y - 6, width: 12, height: 12, borderRadius: 6, background: 'cyan', pointerEvents: 'none' }} />}
                            {earPositions.right && <div style={{ position: 'absolute', left: earPositions.right.x - 6, top: earPositions.right.y - 6, width: 12, height: 12, borderRadius: 6, background: 'cyan', pointerEvents: 'none' }} />}
                            {earPositions.neck && <div style={{ position: 'absolute', left: earPositions.neck.x - 6, top: earPositions.neck.y - 6, width: 12, height: 12, borderRadius: 6, background: 'yellow', pointerEvents: 'none' }} />}
                          </>
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
                      disabled={!isStreaming || !faceDetected}
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
                <div className="fixed right-6 top-24 z-[60] w-80 p-4 bg-white/95 text-black rounded-lg shadow-lg border-2 border-gray-200">
                  <h4 className="font-bold mb-3 text-lg">AR Debug Panel</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">FPS:</span>
                      <span className="font-mono font-semibold">{Math.round(debugStats.fps)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Resolution:</span>
                      <span className="font-mono text-xs">{debugStats.resolution}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Face Status:</span>
                      <span className={`font-semibold ${faceDetected ? 'text-green-600' : 'text-red-600'}`}>
                        {faceDetected ? '✓ Detected' : '✗ Not Found'}
                      </span>
                    </div>
                    <hr className="my-2" />
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">
                        Ear Offset: {earOffsetMultiplier.toFixed(3)}
                      </label>
                      <input 
                        type="range" 
                        min="0.00" 
                        max="0.15" 
                        step="0.005" 
                        value={earOffsetMultiplier} 
                        onChange={(e) => setEarOffsetMultiplier(Number(e.target.value))} 
                        className="w-full" 
                      />
                      <p className="text-xs text-gray-500">↓ Lower = closer to face</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">
                        Smoothing: {smoothingAlpha.toFixed(2)}
                      </label>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="0.95" 
                        step="0.05" 
                        value={smoothingAlpha} 
                        onChange={(e) => setSmoothingAlpha(Number(e.target.value))} 
                        className="w-full" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">
                        Offset X: {offsets.x}px
                      </label>
                      <input 
                        type="range" 
                        min="-100" 
                        max="100" 
                        step="1" 
                        value={offsets.x} 
                        onChange={(e) => setOffsets(o => ({ ...o, x: Number(e.target.value) }))} 
                        className="w-full" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">
                        Offset Y: {offsets.y}px
                      </label>
                      <input 
                        type="range" 
                        min="-100" 
                        max="100" 
                        step="1" 
                        value={offsets.y} 
                        onChange={(e) => setOffsets(o => ({ ...o, y: Number(e.target.value) }))} 
                        className="w-full" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">
                        Scale: {offsets.scale.toFixed(2)}
                      </label>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2.0" 
                        step="0.05" 
                        value={offsets.scale} 
                        onChange={(e) => setOffsets(o => ({ ...o, scale: Number(e.target.value) }))} 
                        className="w-full" 
                      />
                    </div>
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
              <li>• Face the camera directly for accurate detection</li>
              <li>• Ensure good lighting - avoid backlighting</li>
              <li>• Keep your face centered in the frame</li>
              <li>• Wait for "Face Detected" status before capturing</li>
              <li>• For bracelets, show your wrist to the camera</li>
              <li>• Use debug mode (?debugTryOn=1) to fine-tune ear position</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
