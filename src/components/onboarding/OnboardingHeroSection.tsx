import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Rocket } from "lucide-react";

export function OnboardingHeroSection() {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <CardContent className="py-8 relative">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-full bg-primary/10">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Du er på rette vej – det handler om din progression
            </h1>
            <p className="text-lg text-primary font-medium italic">
              Du skal kun vinde over én: dig selv fra sidste uge.
            </p>
          </div>
        </div>
        
        <div className="bg-background/60 backdrop-blur-sm rounded-lg p-4 border border-primary/10">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground leading-relaxed">
              Du er i træningsfasen. Ligesom med løb: At kunne løbe 5 km på 20 minutter i dag betyder, 
              at du – med det rigtige program – kan løbe 15 minutter om få måneder.
              <br />
              <span className="text-foreground font-medium mt-2 block">
                Det samme gælder salg. 20.000 kr. i omsætning nu kan være præcis det trin, 
                der gør, at du om 4 måneder ligger stabilt på 50.000 kr.+
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
