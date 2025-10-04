import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, Camera, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { products, Product } from "@/data/products";

interface ProductRecommendationsProps {
  celebrity: string;
  occasion: string;
  onTryOn: (product: Product) => void;
}

export const ProductRecommendations = ({ celebrity, occasion, onTryOn }: ProductRecommendationsProps) => {
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Use real products from database
  const displayProducts = products;

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

  const handleShare = (product: Product) => {
    toast.success("Sharing options opened");
  };

  const handleTryOn = (product: Product) => {
    setSelectedProduct(product);
    onTryOn(product);
  };

  return (
    <div className="min-h-screen px-8 py-16">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">AI-Powered Recommendations</span>
          </div>
          
          <h2 className="text-5xl md:text-6xl font-bold">
            <span className="text-gradient-gold">{celebrity}</span> Style Collection
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Curated pieces inspired by {celebrity}'s signature style for {occasion} occasions
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayProducts.map((product) => (
            <Card 
              key={product.id} 
              className="group overflow-hidden transition-all hover:shadow-luxury"
            >
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                
                {/* Wishlist & Share buttons */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full bg-white/90 backdrop-blur-sm"
                    onClick={() => toggleWishlist(product.id)}
                  >
                    <Heart 
                      className={`w-5 h-5 ${wishlist.has(product.id) ? 'fill-destructive text-destructive' : ''}`} 
                    />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full bg-white/90 backdrop-blur-sm"
                    onClick={() => handleShare(product)}
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* Badge */}
                <div className="absolute top-4 left-4">
                  <Badge className="gradient-gold border-0">
                    {product.category}
                  </Badge>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-gradient-gold">
                    ₹{product.price.toLocaleString()}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="luxury" 
                    className="flex-1"
                    onClick={() => handleTryOn(product)}
                  >
                    <Camera className="w-4 h-4" />
                    Virtual Try-On
                  </Button>
                  <Button 
                    variant="outline"
                    size="icon"
                  >
                    <ShoppingBag className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pt-8">
          <Button variant="outline" size="lg">
            View More Collections
          </Button>
          <Button variant="premium" size="lg">
            <ShoppingBag className="w-5 h-5" />
            View Wishlist ({wishlist.size})
          </Button>
        </div>
      </div>
    </div>
  );
};
