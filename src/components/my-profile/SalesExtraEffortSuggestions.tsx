import { Card, CardContent } from "@/components/ui/card";
import { Clock, Calendar, Rocket, Trophy, TrendingUp, Lightbulb } from "lucide-react";

interface SalesExtraEffortSuggestionsProps {
  hourlyRate: number;
  amountRemaining: number;
  currentAmount: number;
  targetAmount: number;
  status: "ahead" | "on_track" | "behind";
  bestDayRecord?: number;
}

interface SuggestionItem {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  amount: number;
  highlight?: boolean;
  badge?: string;
}

export function SalesExtraEffortSuggestions({
  hourlyRate,
  amountRemaining,
  currentAmount,
  targetAmount,
  status,
  bestDayRecord,
}: SalesExtraEffortSuggestionsProps) {
  // Calculate extra effort scenarios
  const threeHoursExtra = Math.round(hourlyRate * 3);
  const saturdayShift = Math.round(hourlyRate * 8);
  const weekendSprint = Math.round(hourlyRate * 16);

  // Don't show if no valid hourly rate
  if (hourlyRate <= 0 || !isFinite(hourlyRate)) return null;

  const isBehind = status === "behind";

  const getSuggestions = (): SuggestionItem[] => {
    if (isBehind) {
      // Behind goal - show how extra effort helps catch up
      const afterThreeHours = Math.max(0, amountRemaining - threeHoursExtra);
      const afterSaturday = Math.max(0, amountRemaining - saturdayShift);
      const afterWeekend = Math.max(0, amountRemaining - weekendSprint);

      return [
        {
          icon: Clock,
          title: "Bliv 3 timer ekstra i dag",
          subtitle: afterThreeHours > 0 
            ? `Mangler så: ${afterThreeHours.toLocaleString("da-DK")} kr`
            : "Du når målet! 🎯",
          amount: threeHoursExtra,
          highlight: afterThreeHours === 0,
        },
        {
          icon: Calendar,
          title: "Tag en lørdag",
          subtitle: afterSaturday > 0
            ? `Mangler så: ${afterSaturday.toLocaleString("da-DK")} kr`
            : "Du når målet! 🎯",
          amount: saturdayShift,
          highlight: afterSaturday === 0,
        },
        {
          icon: Rocket,
          title: "Sprint-weekend (lør + søn)",
          subtitle: afterWeekend > 0
            ? `Mangler så: ${afterWeekend.toLocaleString("da-DK")} kr`
            : "Du når målet med god margin! 🚀",
          amount: weekendSprint,
          highlight: true,
          badge: afterWeekend === 0 ? "Anbefalet" : undefined,
        },
      ];
    } else {
      // On track or ahead - show potential extra earnings
      const potentialWithThreeHours = currentAmount + threeHoursExtra;
      const potentialWithSaturday = currentAmount + saturdayShift;
      const potentialWithWeekend = currentAmount + weekendSprint;
      
      // Check if weekend can beat best day record
      const canBeatRecord = bestDayRecord && weekendSprint > bestDayRecord;

      return [
        {
          icon: Clock,
          title: "3 timer ekstra i dag",
          subtitle: `Ekstra kommission`,
          amount: threeHoursExtra,
        },
        {
          icon: Calendar,
          title: "En lørdagsvagt",
          subtitle: `Nå ${potentialWithSaturday.toLocaleString("da-DK")} kr i perioden`,
          amount: saturdayShift,
          badge: potentialWithSaturday >= targetAmount * 1.1 ? "Sprint mål" : undefined,
        },
        {
          icon: Rocket,
          title: "Weekend-sprint",
          subtitle: canBeatRecord 
            ? `Potentiel: ${potentialWithWeekend.toLocaleString("da-DK")} kr`
            : `Total: ${potentialWithWeekend.toLocaleString("da-DK")} kr`,
          amount: weekendSprint,
          highlight: true,
          badge: canBeatRecord ? "🏆 Slå rekord!" : undefined,
        },
      ];
    }
  };

  const suggestions = getSuggestions();

  return (
    <Card className="bg-gradient-to-br from-muted/50 to-transparent border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-full bg-amber-500/20">
            <Lightbulb className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-sm font-medium">
            {isBehind ? "Sådan indhenter du målet" : "Push dit mål endnu højere!"}
          </p>
          {!isBehind && (
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {Math.round(hourlyRate).toLocaleString("da-DK")} kr/time
            </div>
          )}
        </div>

        {isBehind && (
          <p className="text-sm text-muted-foreground mb-3">
            Du mangler: <span className="font-medium text-foreground">{amountRemaining.toLocaleString("da-DK")} kr</span> til at nå målet
          </p>
        )}

        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                suggestion.highlight
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted/30 border-border/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <suggestion.icon className={`h-4 w-4 ${suggestion.highlight ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${suggestion.highlight ? "text-primary" : ""}`}>
                      {suggestion.title}
                    </p>
                    {suggestion.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                        {suggestion.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{suggestion.subtitle}</p>
                </div>
              </div>
              <div className={`text-sm font-bold ${suggestion.highlight ? "text-primary" : ""}`}>
                +{suggestion.amount.toLocaleString("da-DK")} kr
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
