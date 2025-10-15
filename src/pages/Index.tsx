import { useState, useEffect } from "react";
import { Hero } from "@/components/Hero";
import { StyleSurvey } from "@/components/StyleSurvey";
import { CelebrityGallery } from "@/components/CelebrityGallery";
import { ProductRecommendations } from "@/components/ProductRecommendations";
import { VirtualTryOn } from "@/components/VirtualTryOn";
import { Wishlist } from "@/components/Wishlist";
import { Product, products } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = "hero" | "survey" | "celebrity" | "products" | "tryOn" | "wishlist";

const Index = () => {
  const [currentStep, setCurrentStep] = useState<Step>("hero");
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [stylePreferences, setStylePreferences] = useState<string[]>([]);
  const [selectedCelebrity, setSelectedCelebrity] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [isMatchingCelebrity, setIsMatchingCelebrity] = useState(false);

  // Load wishlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('evol-wishlist');
    if (saved) {
      setWishlist(new Set(JSON.parse(saved)));
    }
  }, []);

  // Save wishlist to localStorage
  useEffect(() => {
    localStorage.setItem('evol-wishlist', JSON.stringify(Array.from(wishlist)));
  }, [wishlist]);

  const handleGetStarted = () => {
    setCurrentStep("survey");
  };

  const handleSurveyComplete = async (occasion: string, styles: string[]) => {
    setSelectedOccasion(occasion);
    setStylePreferences(styles);
    setIsMatchingCelebrity(true);

    try {
      const { data, error } = await supabase.functions.invoke('match-celebrity', {
        body: { occasion, stylePreferences: styles }
      });

      if (error) throw error;

      // Show AI-matched celebrities
      toast.success(`AI matched ${data.celebrities.length} celebrities for you!`);
      setIsMatchingCelebrity(false);
      setCurrentStep("celebrity");
    } catch (error) {
      console.error('Error matching celebrities:', error);
      toast.error('Failed to match celebrities. Using default suggestions.');
      setIsMatchingCelebrity(false);
      setCurrentStep("celebrity");
    }
  };

  const handleCelebritySelect = (celebrity: string) => {
    setSelectedCelebrity(celebrity);
    setCurrentStep("products");
  };

  const handleTryOn = (product: Product) => {
    setSelectedProduct(product);
    setCurrentStep("tryOn");
  };

  const handleCloseTryOn = () => {
    setCurrentStep("products");
    setSelectedProduct(null);
  };

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
        toast.success("Removed from wishlist");
      } else {
        newSet.add(productId);
        toast.success("Added to wishlist");
      }
      return newSet;
    });
  };

  const handleViewWishlist = () => {
    setCurrentStep("wishlist");
  };

  const handleCloseWishlist = () => {
    setCurrentStep("products");
  };

  const wishlistProducts = products.filter(p => wishlist.has(p.id));

  return (
    <div className="min-h-screen bg-background">
      {currentStep === "hero" && <Hero onGetStarted={handleGetStarted} />}
      
      {currentStep === "survey" && (
        <StyleSurvey onComplete={handleSurveyComplete} />
      )}
      
      {isMatchingCelebrity && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-xl text-muted-foreground">AI matching your style preferences...</p>
          </div>
        </div>
      )}
      
      {currentStep === "celebrity" && !isMatchingCelebrity && (
        <CelebrityGallery 
          occasion={selectedOccasion} 
          onSelect={handleCelebritySelect} 
        />
      )}
      
      {currentStep === "products" && (
        <ProductRecommendations
          celebrity={selectedCelebrity}
          occasion={selectedOccasion}
          onTryOn={handleTryOn}
          wishlist={wishlist}
          onWishlistToggle={toggleWishlist}
          onViewWishlist={handleViewWishlist}
        />
      )}
      
      {currentStep === "tryOn" && selectedProduct && (
        <VirtualTryOn 
          product={selectedProduct}
          onClose={handleCloseTryOn}
        />
      )}

      {currentStep === "wishlist" && (
        <Wishlist
          items={wishlistProducts}
          onRemove={toggleWishlist}
          onTryOn={handleTryOn}
          onClose={handleCloseWishlist}
        />
      )}
    </div>
  );
};

export default Index;
