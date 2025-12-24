import { Card, CardContent } from "@/components/ui/card";
import { useOnboardingDays, useEmployeeOnboardingProgress, useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { BookOpen } from "lucide-react";
import { OnboardingStatusBoard } from "@/components/onboarding/OnboardingStatusBoard";

export default function EmployeeOnboardingView() {
  const { data: employeeId } = useCurrentEmployeeId();
  const { data: days = [], isLoading: daysLoading } = useOnboardingDays();
  const { data: progress = [], isLoading: progressLoading } = useEmployeeOnboardingProgress(employeeId || undefined);

  if (daysLoading || progressLoading) {
    return <div className="text-muted-foreground py-8 text-center">Indlæser onboarding...</div>;
  }

  if (days.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Ingen onboarding-dage oprettet endnu.</p>
        </CardContent>
      </Card>
    );
  }

  const isDayComplete = (dayId: string) => {
    const p = progress.find(p => p.onboarding_day_id === dayId);
    return p?.completed_at !== null && p?.completed_at !== undefined;
  };

  const currentDayIndex = days.findIndex(d => !isDayComplete(d.id));
  const currentWeekNumber = currentDayIndex >= 0 ? days[currentDayIndex]?.week || 1 : 1;

  return (
    <OnboardingStatusBoard 
      days={days}
      progress={progress}
      currentWeek={currentWeekNumber}
    />
  );
}
