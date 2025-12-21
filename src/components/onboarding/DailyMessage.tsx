import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { useWeekExpectations } from "@/hooks/useWeekExpectations";

interface DailyMessageProps {
  currentWeek: number;
  dayMessage?: string | null;
}

export function DailyMessage({ currentWeek, dayMessage }: DailyMessageProps) {
  const { data: weeks = [] } = useWeekExpectations();
  
  const weekData = weeks.find(w => w.week_number === currentWeek);
  const message = dayMessage || weekData?.daily_message;
  
  if (!message) return null;
  
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-foreground">
            {message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
