import { useState, useEffect } from "react";
import { Hero } from "@/components/Hero";
import { StyleSurvey } from "@/components/StyleSurvey";
import { CelebrityGallery } from "@/components/CelebrityGallery";
import { ProductRecommendations } from "@/components/ProductRecommendations";
import { VirtualTryOn } from "@/components/VirtualTryOn";
import { Wishlist } from "@/components/Wishlist";
import type { Product } from "@/data/loadProducts";
import { useProducts } from "@/data/loadProducts";
import { supabaseService } from "@/services/supabaseService";
import { useSessionId } from "@/hooks/useSessionId";
import { toast } from "sonner";
import { getCelebritySuggestions } from "@/services/aiService";
import { Cart } from "@/components/Cart";

type Step = "hero" | "survey" | "celebrity" | "products" | "tryOn" | "wishlist";

const Index = () => {
  const sessionId = useSessionId();
  const { products } = useProducts();
  const [currentStep, setCurrentStep] = useState<Step>("hero");
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [stylePreferences, setStylePreferences] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState<string>("");
  const [selectedCelebrity, setSelectedCelebrity] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [isMatchingCelebrity, setIsMatchingCelebrity] = useState(false);
  const [celebritySuggestions, setCelebritySuggestions] = useState<{ name: string; style?: string; image?: string }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartIds, setCartIds] = useState<string[]>([]);

  // Load wishlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('evol-wishlist');
    if (saved) {
      setWishlist(new Set(JSON.parse(saved)));
    }
  }, []);

  // If the user has a server-side session id, sync wishlist from Supabase
  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;
    supabaseService.getWishlist(sessionId).then(data => {
      if (!mounted) return;
      try {
        const ids = (data || []).map((row: { product_id?: string; product?: { id?: string } }) => row.product_id ?? row.product?.id).filter(Boolean) as string[];
        setWishlist(new Set(ids));
      } catch (e) {
        // ignore malformed response
      }
    }).catch(err => {
      console.error('Failed to sync wishlist from Supabase:', err);
    });
    return () => { mounted = false; };
  }, [sessionId]);

  // Save wishlist to localStorage
  useEffect(() => {
    localStorage.setItem('evol-wishlist', JSON.stringify(Array.from(wishlist)));
  }, [wishlist]);

  const handleGetStarted = () => {
    setCurrentStep("survey");
  };

  const goToPrev = () => {
    if (currentStep === 'survey') setCurrentStep('hero');
    else if (currentStep === 'celebrity') setCurrentStep('survey');
    else if (currentStep === 'products') setCurrentStep('celebrity');
    else if (currentStep === 'tryOn') setCurrentStep('products');
    else if (currentStep === 'wishlist') setCurrentStep('products');
  };

  const goToNext = () => {
    if (currentStep === 'hero') setCurrentStep('survey');
    else if (currentStep === 'survey') setCurrentStep('celebrity');
    else if (currentStep === 'celebrity') setCurrentStep('products');
    else if (currentStep === 'products') setCurrentStep('tryOn');
  };

  const handleSurveyComplete = async (occasion: string, styles: string[], budget: string) => {
    setSelectedOccasion(occasion);
    setStylePreferences(styles);
    setBudgetRange(budget);
    setIsMatchingCelebrity(true);

    try {
      if (sessionId) {
        await supabaseService.saveSurvey(sessionId, occasion, styles, budget);
      }

      let data: { celebrities?: unknown[] } | null = null;
      try {
        data = await supabaseService.callMatchCelebrity(occasion, styles, budget);
      } catch (e) {
        // fall back to OpenRouter if available
        const fallback = await getCelebritySuggestions(occasion, styles, budget);
        data = { celebrities: fallback };
      }

      const suggestions = (data?.celebrities ?? []).map((c: unknown) => {
        if (typeof c === 'string') {
          return { name: c, style: undefined as string | undefined, image: undefined as string | undefined };
        }
        const obj = c as { name?: string; style?: string; image?: string };
        return {
          name: obj.name ?? String(obj),
          style: obj.style ?? undefined,
          image: obj.image ?? undefined,
        };
      });
      setCelebritySuggestions(suggestions);

      toast.success(`AI matched ${suggestions.length} celebrities for you!`);
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

  const handlePrevProduct = () => {
    if (!selectedProduct || !products || products.length === 0) return;
    const idx = products.findIndex(p => p.id === selectedProduct.id);
    const prevIdx = (idx - 1 + products.length) % products.length;
    setSelectedProduct(products[prevIdx]);
  };

  const handleNextProduct = () => {
    if (!selectedProduct || !products || products.length === 0) return;
    const idx = products.findIndex(p => p.id === selectedProduct.id);
    const nextIdx = (idx + 1) % products.length;
    setSelectedProduct(products[nextIdx]);
  };

  const toggleWishlist = async (productId: string) => {
    const wasPresent = wishlist.has(productId);

    // Optimistic UI update
    setWishlist(prev => {
      const newSet = new Set(prev);
      if (wasPresent) newSet.delete(productId);
      else newSet.add(productId);
      return newSet;
    });

    if (!sessionId) {
      // No server persistence available, we're done
      toast.success(wasPresent ? 'Removed from wishlist' : 'Added to wishlist');
      return;
    }

    try {
      if (wasPresent) {
        await supabaseService.removeFromWishlistBySessionAndProduct(sessionId, productId);
        toast.success('Removed from wishlist');
      } else {
        await supabaseService.addToWishlist(sessionId, productId);
        toast.success('Added to wishlist');
      }
    } catch (err) {
      console.error('Error syncing wishlist to Supabase:', err);
      toast.error('Failed to sync wishlist to server');
      // Revert optimistic update on failure
      setWishlist(prev => {
        const newSet = new Set(prev);
        if (wasPresent) newSet.add(productId); else newSet.delete(productId);
        return newSet;
      });
    }
  };

  const handleViewWishlist = () => {
    setCurrentStep("wishlist");
  };

  const handleCloseWishlist = () => {
    setCurrentStep("products");
  };

  const cartItems = (products ?? []).filter(p => cartIds.includes(p.id));
  const addToCart = (productId: string) => setCartIds(prev => prev.includes(productId) ? prev : [...prev, productId]);
  const removeFromCart = (productId: string) => setCartIds(prev => prev.filter(id => id !== productId));
  const checkout = async () => {
    if (!sessionId || cartItems.length === 0) return;
    try {
      // Create one order per product (simple demo). In real app, create one order with items.
      for (const item of cartItems) {
        await supabaseService.createOrder(sessionId, item.id);
      }
      setCartIds([]);
      setCartOpen(false);
      toast.success("Order placed successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to place order");
    }
  };

  useEffect(() => {
    const onAddToCart = (e: Event) => {
      const ce = e as CustomEvent<{ productId: string }>;
      if (ce.detail?.productId) {
        addToCart(ce.detail.productId);
        setCartOpen(true);
      }
    };
    window.addEventListener('add-to-cart', onAddToCart as EventListener);
    return () => window.removeEventListener('add-to-cart', onAddToCart as EventListener);
  }, []);

  const wishlistProducts = (products ?? []).filter(p => wishlist.has(p.id));

  return (
    <div className="min-h-screen bg-background">
      {currentStep === "hero" && <Hero onGetStarted={handleGetStarted} onPrev={goToPrev} onNext={goToNext} />}
      
      {currentStep === "survey" && (
        <StyleSurvey onComplete={handleSurveyComplete} onPrev={goToPrev} onNext={goToNext} />
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
          suggestions={celebritySuggestions}
          onPrev={goToPrev}
          onNext={goToNext}
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
          onPrev={goToPrev}
          onNext={goToNext}
        />
      )}
      
      {currentStep === "tryOn" && selectedProduct && (
        <VirtualTryOn 
          product={selectedProduct}
          onClose={handleCloseTryOn}
          onPrev={handlePrevProduct}
          onNext={handleNextProduct}
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

      {cartOpen && (
        <Cart
          items={cartItems}
          onRemove={removeFromCart}
          onCheckout={checkout}
          onClose={() => setCartOpen(false)}
        />
      )}
    </div>
  );
};

export default Index;
