import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";

interface CelebrityGalleryProps {
  occasion: string;
  onSelect: (celebrity: string) => void;
}

const celebrities = [
  {
    name: "Deepika Padukone",
    style: "Elegant & Timeless",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop",
  },
  {
    name: "Priyanka Chopra",
    style: "Bold & Modern",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop",
  },
  {
    name: "Alia Bhatt",
    style: "Delicate & Graceful",
    image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=500&fit=crop",
  },
  {
    name: "Kareena Kapoor",
    style: "Classic & Sophisticated",
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop",
  },
  {
    name: "Anushka Sharma",
    style: "Minimalist & Chic",
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop",
  },
  {
    name: "Sonam Kapoor",
    style: "Fashion Forward",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop",
  },
];

export const CelebrityGallery = ({ occasion, onSelect }: CelebrityGalleryProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCelebrity, setSelectedCelebrity] = useState<string | null>(null);

  const filteredCelebrities = celebrities.filter(celebrity =>
    celebrity.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (name: string) => {
    setSelectedCelebrity(name);
    setTimeout(() => onSelect(name), 500);
  };

  return (
    <div className="min-h-screen flex flex-col px-8 py-16">
      <div className="max-w-7xl mx-auto w-full space-y-12">
        {/* Header */}
        <div className="text-center space-y-6">
          <h2 className="text-5xl md:text-6xl font-bold">
            Choose Your <span className="text-gradient-gold">Style Icon</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select a celebrity whose jewelry style you admire, or search for your favorite
          </p>

          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a celebrity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-14 text-lg shadow-soft"
            />
          </div>
        </div>

        {/* Celebrity Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {filteredCelebrities.map((celebrity) => (
            <Card
              key={celebrity.name}
              className={`group relative overflow-hidden cursor-pointer transition-all hover:scale-105 hover:shadow-luxury ${
                selectedCelebrity === celebrity.name ? 'ring-4 ring-primary shadow-glow' : ''
              }`}
              onClick={() => handleSelect(celebrity.name)}
            >
              <div className="aspect-[4/5] relative">
                <img
                  src={celebrity.image}
                  alt={celebrity.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{celebrity.name}</h3>
                  <p className="text-sm opacity-90 mb-4">{celebrity.style}</p>
                  
                  {selectedCelebrity === celebrity.name ? (
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-sm font-semibold">Selected</span>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white hover:text-foreground"
                    >
                      Select Style
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredCelebrities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              No celebrities found. Try a different search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
