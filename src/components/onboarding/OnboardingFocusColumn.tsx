import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Focus, Lightbulb, CheckCircle2, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingFocusColumnProps {
  currentWeek: number;
  weeklyFocus?: string;
  focusTechnique?: string;
  dailyCallTarget?: number;
}

export function OnboardingFocusColumn({
  currentWeek,
  weeklyFocus = "Tag 60 kald om dagen og brug \"indvending A\"-teknikken mindst 5 gange.",
  focusTechnique = "indvending A",
  dailyCallTarget = 60,
}: OnboardingFocusColumnProps) {
  const motivationalQuotes = [
    "Du skal ikke slå de erfarne – du skal slå din egen sidste uge.",
    "20.000 kr. i måned 1 er ikke for lidt. Det er et forventet trin i ramp-kurven.",
    "En dag uden salg kan stadig være en god dag, hvis din aktivitet og læring rykker.",
  ];

  const weekFocusAreas: Record<number, string[]> = {
    1: ["Bliv tryg ved telefonen", "Lær scriptet", "Forstå produktet"],
    2: ["Øg samtalekvalitet", "Arbejd med indvendinger", "Book første møder"],
    3: ["Mestre behovsafdækning", "Præsenter løsninger", "Følg op effektivt"],
    4: ["Luk ordrer selv", "Håndter alle indvendinger", "Byg pipeline"],
  };

  const currentFocusAreas = weekFocusAreas[currentWeek] || weekFocusAreas[1];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Focus className="h-5 w-5 text-primary" />
          Ugens Fokus
        </CardTitle>
        <p className="text-sm text-muted-foreground">Én klar prioritet ad gangen</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Main focus highlight */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-2 border-amber-500/30">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                FOKUS DENNE UGE
              </p>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {weeklyFocus}
              </p>
            </div>
          </div>
        </div>

        {/* Focus areas for current week */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Uge {currentWeek} fokusområder:</p>
          <div className="space-y-2">
            {currentFocusAreas.map((area, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
              >
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{area}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Motivational quotes */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Quote className="h-4 w-4" />
            <span className="text-xs font-medium">Husk:</span>
          </div>
          <div className="space-y-2">
            {motivationalQuotes.map((quote, idx) => (
              <p key={idx} className="text-xs text-muted-foreground italic pl-6">
                "{quote}"
              </p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
