import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles } from "lucide-react";

interface StyleSurveyProps {
  onComplete: (occasion: string, styles: string[], budget: string) => void;
}

const occasions = [
  { id: "wedding", label: "Wedding", icon: "💍" },
  { id: "party", label: "Party", icon: "🎉" },
  { id: "office", label: "Office", icon: "💼" },
  { id: "daily", label: "Daily Wear", icon: "☀️" },
];

const styleOptions = [
  { id: "traditional", label: "Traditional" },
  { id: "modern", label: "Modern" },
  { id: "minimal", label: "Minimal" },
  { id: "statement", label: "Statement Pieces" },
  { id: "vintage", label: "Vintage" },
  { id: "elegant", label: "Elegant" },
];

const budgetRanges = [
  { id: "under-500", label: "Under $500" },
  { id: "500-1500", label: "$500 - $1,500" },
  { id: "1500-3000", label: "$1,500 - $3,000" },
  { id: "over-3000", label: "Over $3,000" },
];

export const StyleSurvey = ({ onComplete }: StyleSurveyProps) => {
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>("");

  const toggleStyle = (styleId: string) => {
    setSelectedStyles(prev =>
      prev.includes(styleId)
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  const handleContinue = () => {
    if (selectedOccasion && selectedStyles.length > 0 && selectedBudget) {
      onComplete(selectedOccasion, selectedStyles, selectedBudget);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-8 py-16 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-4xl w-full space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Style & Occasion Survey</span>
          </div>
          
          <h2 className="text-5xl md:text-6xl font-bold text-gradient-gold">
            Let's Find Your Perfect Match
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tell us about your style and occasion to get personalized celebrity-inspired recommendations
          </p>
        </div>

        <div className="space-y-8">
          {/* Occasion Selection */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Select Occasion</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {occasions.map((occasion) => (
                <Card
                  key={occasion.id}
                  className={`cursor-pointer transition-all hover:shadow-luxury ${
                    selectedOccasion === occasion.id
                      ? "border-primary bg-primary/5 shadow-glow"
                      : ""
                  }`}
                  onClick={() => setSelectedOccasion(occasion.id)}
                >
                  <div className="p-6 text-center space-y-2">
                    <div className="text-4xl">{occasion.icon}</div>
                    <h4 className="font-semibold">{occasion.label}</h4>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Style Preferences */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Your Style Preferences</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {styleOptions.map((style) => (
                <Card
                  key={style.id}
                  className={`cursor-pointer transition-all hover:shadow-luxury ${
                    selectedStyles.includes(style.id)
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                  onClick={() => toggleStyle(style.id)}
                >
                  <div className="p-4 flex items-center gap-3">
                    <Checkbox
                      checked={selectedStyles.includes(style.id)}
                      onCheckedChange={() => toggleStyle(style.id)}
                    />
                    <span className="font-medium">{style.label}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Budget Range */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Your Budget Range</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {budgetRanges.map((budget) => (
                <Card
                  key={budget.id}
                  className={`cursor-pointer transition-all hover:shadow-luxury ${
                    selectedBudget === budget.id
                      ? "border-primary bg-primary/5 shadow-glow"
                      : ""
                  }`}
                  onClick={() => setSelectedBudget(budget.id)}
                >
                  <div className="p-6 text-center">
                    <h4 className="font-semibold">{budget.label}</h4>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            variant="luxury"
            size="lg"
            onClick={handleContinue}
            disabled={!selectedOccasion || selectedStyles.length === 0 || !selectedBudget}
            className="px-12"
          >
            Continue to Celebrity Matching
          </Button>
        </div>
      </div>
    </div>
  );
};
