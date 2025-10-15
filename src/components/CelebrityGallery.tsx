import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";
import deepika from "./100.jpg";
import priyanka from "./101.jpg";
import alia from "./102.jpg";
import kareena from "./103.jpg";
import anushka from "./104.jpg";
import sonam from "./105.jpg";

interface CelebrityGalleryProps {
  occasion: string;
  onSelect: (celebrity: string) => void;
  suggestions?: { name: string; style?: string; image?: string }[];
  onPrev?: () => void;
  onNext?: () => void;
}

const defaultCelebrities = [
  {
    name: "Deepika Padukone",
    style: "Elegant & Timeless",
    image: deepika,
  },
  {
    name: "Priyanka Chopra",
    style: "Bold & Modern",
    image: priyanka,
  },
  {
    name: "Alia Bhatt",
    style: "Delicate & Graceful",
    image: alia,
  },
  {
    name: "Kareena Kapoor",
    style: "Classic & Sophisticated",
    image: kareena,
  },
  {
    name: "Anushka Sharma",
    style: "Minimalist & Chic",
    image: anushka,
  },
  {
    name: "Sonam Kapoor",
    style: "Fashion Forward",
    image: sonam,
  },
];

export const CelebrityGallery = ({ occasion, onSelect, suggestions, onPrev, onNext }: CelebrityGalleryProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCelebrity, setSelectedCelebrity] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 6; // show up to 6 items per page (3 columns x 2 rows on md)

  const celebrities = (suggestions && suggestions.length > 0 ? suggestions : defaultCelebrities);

  const filteredCelebrities = celebrities.filter(celebrity =>
    celebrity.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredCelebrities.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCelebrities = filteredCelebrities.slice(startIndex, startIndex + itemsPerPage);

  const handleSelect = (name: string) => {
    setSelectedCelebrity(name);
    setTimeout(() => onSelect(name), 500);
  };

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // If filtered results shrink, ensure currentPage is within bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    // include currentPage to satisfy the hook lint rule; effect only updates when pages change
  }, [totalPages, currentPage]);

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
          {paginatedCelebrities.map((celebrity) => (
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

        {/* Pagination Controls */}
        {filteredCelebrities.length > itemsPerPage && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
        {onPrev && (
          <div className="absolute left-6 bottom-6">
            <Button variant="ghost" onClick={onPrev}>Prev</Button>
          </div>
        )}
        {onNext && (
          <div className="absolute right-6 bottom-6">
            <Button variant="ghost" onClick={onNext}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
};
