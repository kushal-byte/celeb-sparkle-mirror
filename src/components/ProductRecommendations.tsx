import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, ShoppingBag, Camera, Share2, Sparkles, Filter } from "lucide-react";
import { toast } from "sonner";
import { products, Product } from "@/data/products";

interface ProductRecommendationsProps {
  celebrity: string;
  occasion: string;
  onTryOn: (product: Product) => void;
  wishlist: Set<string>;
  onWishlistToggle: (productId: string) => void;
  onViewWishlist: () => void;
}

export const ProductRecommendations = ({ 
  celebrity, 
  occasion, 
  onTryOn, 
  wishlist, 
  onWishlistToggle,
  onViewWishlist 
}: ProductRecommendationsProps) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceRange, setPriceRange] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    // Price filter
    if (priceRange !== "all") {
      filtered = filtered.filter(p => {
        if (priceRange === "under50k") return p.price < 50000;
        if (priceRange === "50k-100k") return p.price >= 50000 && p.price <= 100000;
        if (priceRange === "100k-200k") return p.price > 100000 && p.price <= 200000;
        if (priceRange === "over200k") return p.price > 200000;
        return true;
      });
    }

    return filtered;
  }, [searchQuery, categoryFilter, priceRange]);

  const categories = Array.from(new Set(products.map(p => p.category)));


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

        {/* Filters */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Filter Products</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priceRange} onValueChange={setPriceRange}>
              <SelectTrigger>
                <SelectValue placeholder="Price Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                <SelectItem value="under50k">Under ₹50,000</SelectItem>
                <SelectItem value="50k-100k">₹50,000 - ₹1,00,000</SelectItem>
                <SelectItem value="100k-200k">₹1,00,000 - ₹2,00,000</SelectItem>
                <SelectItem value="over200k">Over ₹2,00,000</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
              setPriceRange("all");
            }}>
              Clear Filters
            </Button>
          </div>
        </Card>

        <p className="text-center text-muted-foreground">
          Showing {filteredProducts.length} of {products.length} products
        </p>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => (
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
                    onClick={() => onWishlistToggle(product.id)}
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
          <Button variant="premium" size="lg" onClick={onViewWishlist}>
            <ShoppingBag className="w-5 h-5" />
            View Wishlist ({wishlist.size})
          </Button>
        </div>
      </div>
    </div>
  );
};
