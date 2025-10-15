import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/loadProducts";

interface CartProps {
  items: Product[];
  onRemove: (productId: string) => void;
  onCheckout: () => Promise<void> | void;
  onClose: () => void;
}

export const Cart = ({ items, onRemove, onCheckout, onClose }: CartProps) => {
  const total = items.reduce((sum, p) => sum + (p.price || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[85vh] overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Your Cart</h3>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground">Your cart is empty.</p>
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border rounded-md p-3">
                <img src={p.image} alt={p.name} className="w-16 h-16 object-cover rounded" />
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground">₹{p.price.toLocaleString()}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => onRemove(p.id)}>Remove</Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-xl font-bold">₹{total.toLocaleString()}</div>
        </div>

        <Button variant="premium" className="w-full" disabled={items.length === 0} onClick={() => void onCheckout()}>
          Checkout
        </Button>
      </Card>
    </div>
  );
};


