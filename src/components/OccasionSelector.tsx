import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Users, Briefcase, PartyPopper, Coffee } from "lucide-react";

interface OccasionSelectorProps {
  onSelect: (occasion: string) => void;
}

const occasions = [
  {
    id: "wedding",
    label: "Wedding & Celebrations",
    icon: Sparkles,
    description: "Elegant pieces for your special day",
    gradient: "from-primary/20 to-accent/20",
  },
  {
    id: "party",
    label: "Party & Events",
    icon: PartyPopper,
    description: "Statement jewelry for memorable nights",
    gradient: "from-secondary/20 to-accent/20",
  },
  {
    id: "office",
    label: "Office & Professional",
    icon: Briefcase,
    description: "Sophisticated styles for work",
    gradient: "from-muted to-muted/50",
  },
  {
    id: "daily",
    label: "Daily Wear",
    icon: Coffee,
    description: "Comfortable elegance for everyday",
    gradient: "from-accent/20 to-primary/10",
  },
];

export const OccasionSelector = ({ onSelect }: OccasionSelectorProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 py-16">
      <div className="max-w-6xl mx-auto w-full space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h2 className="text-5xl md:text-6xl font-bold">
            What's the <span className="text-gradient-gold">Occasion?</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the occasion to help us find the perfect jewelry pieces for you
          </p>
        </div>

        {/* Occasion Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {occasions.map((occasion) => (
            <Card
              key={occasion.id}
              className="group relative overflow-hidden cursor-pointer transition-all hover:scale-105 hover:shadow-luxury"
              onClick={() => onSelect(occasion.id)}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${occasion.gradient} opacity-50 group-hover:opacity-70 transition-opacity`} />
              
              <div className="relative p-8 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-soft">
                  <occasion.icon className="w-10 h-10 text-primary" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">{occasion.label}</h3>
                  <p className="text-muted-foreground">{occasion.description}</p>
                </div>

                <Button variant="outline" size="sm" className="mt-4">
                  Select
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
