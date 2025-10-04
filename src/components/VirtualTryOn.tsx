import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, RotateCcw, Download, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  celebrity: string;
}

interface VirtualTryOnProps {
  product: Product;
  onClose: () => void;
}

export const VirtualTryOn = ({ product, onClose }: VirtualTryOnProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" },
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
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
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-6 h-6" />
            </Button>
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
                      className="w-full h-full object-cover mirror"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    
                    {/* AR Overlay - Simulated jewelry overlay */}
                    {isStreaming && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-64 h-64 object-contain opacity-70 drop-shadow-2xl"
                            style={{ filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.5))' }}
                          />
                        </div>
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
                    <span className="text-muted-foreground">Inspired by</span>
                    <span className="font-medium">{product.celebrity}</span>
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
