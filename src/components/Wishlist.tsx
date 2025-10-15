import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ShoppingBag, Camera } from "lucide-react";
import { Product } from "@/data/products";

interface WishlistProps {
  items: Product[];
  onRemove: (productId: string) => void;
  onTryOn: (product: Product) => void;
  onClose: () => void;
}

export const Wishlist = ({ items, onRemove, onTryOn, onClose }: WishlistProps) => {
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="min-h-screen px-8 py-16 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-5xl font-bold text-gradient-gold">Your Wishlist</h2>
            <p className="text-xl text-muted-foreground mt-2">
              {items.length} {items.length === 1 ? 'item' : 'items'} selected
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            <X className="w-5 h-5" />
            Close
          </Button>
        </div>

        {items.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-2xl text-muted-foreground">Your wishlist is empty</p>
            <Button variant="luxury" className="mt-6" onClick={onClose}>
              Continue Shopping
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="gradient-gold border-0">
                        {product.category}
                      </Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-4 right-4 rounded-full"
                      onClick={() => onRemove(product.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                    </div>

                    <div className="text-2xl font-bold text-gradient-gold">
                      ₹{product.price.toLocaleString()}
                    </div>

                    <Button
                      variant="luxury"
                      className="w-full"
                      onClick={() => {
                        onTryOn(product);
                        onClose();
                      }}
                    >
                      <Camera className="w-4 h-4" />
                      Try On
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-8 sticky bottom-8 bg-card/95 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-3xl font-bold text-gradient-gold">
                    ₹{total.toLocaleString()}
                  </p>
                </div>
                <Button variant="premium" size="lg">
                  <ShoppingBag className="w-5 h-5" />
                  Checkout ({items.length})
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
