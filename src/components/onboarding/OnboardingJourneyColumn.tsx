import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingDay, EmployeeProgress } from "@/hooks/useOnboarding";

interface OnboardingJourneyColumnProps {
  days: OnboardingDay[];
  progress: EmployeeProgress[];
}

export function OnboardingJourneyColumn({ days, progress }: OnboardingJourneyColumnProps) {
  // Group days by week
  const weeks = days.reduce((acc, day) => {
    if (!acc[day.week]) acc[day.week] = [];
    acc[day.week].push(day);
    return acc;
  }, {} as Record<number, OnboardingDay[]>);

  const isDayComplete = (dayId: string) => {
    const p = progress.find(p => p.onboarding_day_id === dayId);
    return p?.completed_at !== null && p?.completed_at !== undefined;
  };

  const getWeekProgress = (weekDays: OnboardingDay[]) => {
    const completed = weekDays.filter(d => isDayComplete(d.id)).length;
    return { completed, total: weekDays.length };
  };

  const weekLabels: Record<number, { title: string; description: string }> = {
    1: { title: "Struktur & intro", description: "Kom godt i gang med de basale værktøjer" },
    2: { title: "Hul igennem & tryghed", description: "Bliv tryg i samtaler" },
    3: { title: "Behovsafdækning", description: "Lær at identificere kundebehov" },
    4: { title: "Indvendinger", description: "Mestre indvendingshåndtering" },
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Min Onboarding
        </CardTitle>
        <p className="text-sm text-muted-foreground">Læring & fremdrift</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(weeks).map(([weekNum, weekDays]) => {
          const { completed, total } = getWeekProgress(weekDays);
          const isWeekComplete = completed === total;
          const isWeekInProgress = completed > 0 && completed < total;
          const weekNumber = parseInt(weekNum);
          const label = weekLabels[weekNumber] || { title: `Uge ${weekNum}`, description: "" };

          return (
            <div 
              key={weekNum}
              className={cn(
                "p-3 rounded-lg border transition-colors",
                isWeekComplete && "bg-green-500/10 border-green-500/30",
                isWeekInProgress && "bg-amber-500/10 border-amber-500/30",
                !isWeekComplete && !isWeekInProgress && "bg-muted/30 border-border/50"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isWeekComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : isWeekInProgress ? (
                    <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={cn(
                    "font-medium text-sm",
                    isWeekComplete && "text-green-600 dark:text-green-400",
                    isWeekInProgress && "text-amber-600 dark:text-amber-400"
                  )}>
                    Uge {weekNum}: {label.title}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {completed}/{total}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {label.description}
              </p>
            </div>
          );
        })}

        {/* Bottom message */}
        <div className="pt-4 border-t mt-4">
          <p className="text-xs text-muted-foreground italic text-center">
            Det er meningen, at du stadig er i træning. 
            Fuldt rampede resultater kommer senere.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
