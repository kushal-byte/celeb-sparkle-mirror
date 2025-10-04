import { useState } from "react";
import { Hero } from "@/components/Hero";
import { OccasionSelector } from "@/components/OccasionSelector";
import { CelebrityGallery } from "@/components/CelebrityGallery";
import { ProductRecommendations } from "@/components/ProductRecommendations";
import { VirtualTryOn } from "@/components/VirtualTryOn";

type Step = "hero" | "occasion" | "celebrity" | "products" | "tryOn";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  celebrity: string;
}

const Index = () => {
  const [currentStep, setCurrentStep] = useState<Step>("hero");
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [selectedCelebrity, setSelectedCelebrity] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleGetStarted = () => {
    setCurrentStep("occasion");
  };

  const handleOccasionSelect = (occasion: string) => {
    setSelectedOccasion(occasion);
    setCurrentStep("celebrity");
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

  return (
    <div className="min-h-screen bg-background">
      {currentStep === "hero" && <Hero onGetStarted={handleGetStarted} />}
      
      {currentStep === "occasion" && (
        <OccasionSelector onSelect={handleOccasionSelect} />
      )}
      
      {currentStep === "celebrity" && (
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
        />
      )}
      
      {currentStep === "tryOn" && selectedProduct && (
        <VirtualTryOn 
          product={selectedProduct}
          onClose={handleCloseTryOn}
        />
      )}
    </div>
  );
};

export default Index;
