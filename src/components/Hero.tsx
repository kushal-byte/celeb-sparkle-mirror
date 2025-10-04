import { Button } from "@/components/ui/button";
import { Sparkles, Camera, Heart } from "lucide-react";

interface HeroProps {
  onGetStarted: () => void;
}

export const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-accent/10" />
      <div className="absolute top-20 left-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
        {/* Logo/Brand */}
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-card/80 backdrop-blur-sm shadow-luxury border border-primary/20">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          <span className="text-xl font-semibold text-gradient-gold">Evol Jewels</span>
        </div>

        {/* Main heading */}
        <h1 className="text-7xl md:text-8xl font-bold leading-tight">
          Shop Like Your
          <br />
          <span className="text-gradient-gold">Favorite Celebrity</span>
        </h1>

        {/* Subheading */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Experience the future of jewelry shopping with AI-powered recommendations 
          and virtual try-on technology
        </p>

        {/* Feature badges */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 backdrop-blur-sm border border-border">
            <Camera className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Virtual Try-On</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 backdrop-blur-sm border border-border">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="text-sm font-medium">AI-Powered</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 backdrop-blur-sm border border-border">
            <Heart className="w-5 h-5 text-secondary" />
            <span className="text-sm font-medium">Celebrity Inspired</span>
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-8">
          <Button 
            variant="luxury" 
            size="xl"
            onClick={onGetStarted}
            className="text-lg"
          >
            <Sparkles className="w-6 h-6" />
            Begin Your Experience
          </Button>
        </div>

        {/* Bottom text */}
        <p className="text-sm text-muted-foreground pt-4">
          Touch anywhere to start your personalized jewelry journey
        </p>
      </div>
    </div>
  );
};
