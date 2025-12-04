import { useState, useEffect } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Clock, Play, Square, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveTimeEntry, useClockIn, useClockOut, useMyShifts } from "@/hooks/useShiftPlanning";

interface TimeClockProps {
  employeeId: string;
}

export function TimeClock({ employeeId }: TimeClockProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: activeEntry, isLoading } = useActiveTimeEntry(employeeId);
  const { data: todayShifts } = useMyShifts(employeeId, today, today);
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayShift = todayShifts?.[0];

  const handleClockIn = () => {
    clockIn.mutate({
      employee_id: employeeId,
      shift_id: todayShift?.id,
      date: today,
    });
  };

  const handleClockOut = () => {
    if (activeEntry) {
      clockOut.mutate(activeEntry.id);
    }
  };

  // Calculate elapsed time
  const getElapsedTime = () => {
    if (!activeEntry?.clock_in) return null;
    const start = new Date(activeEntry.clock_in);
    const diff = currentTime.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Stempelur
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Current Time Display */}
          <div className="text-center md:text-left">
            <p className="text-3xl font-mono font-bold">
              {format(currentTime, "HH:mm:ss")}
            </p>
            <p className="text-muted-foreground">
              {format(currentTime, "EEEE d. MMMM yyyy", { locale: da })}
            </p>
          </div>

          {/* Today's Shift Info */}
          {todayShift && (
            <div className="text-center border-x px-6">
              <p className="text-sm text-muted-foreground">Dagens vagt</p>
              <p className="font-medium">
                {todayShift.start_time.slice(0, 5)} - {todayShift.end_time.slice(0, 5)}
              </p>
              <p className="text-sm text-muted-foreground">
                {todayShift.planned_hours?.toFixed(1)} timer planlagt
              </p>
            </div>
          )}

          {/* Clock In/Out Actions */}
          <div className="flex flex-col items-center gap-2">
            {activeEntry ? (
              <>
                <Badge variant="default" className="text-lg py-1 px-3">
                  <Timer className="h-4 w-4 mr-2" />
                  {getElapsedTime()}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Stemplet ind: {format(new Date(activeEntry.clock_in!), "HH:mm")}
                </p>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleClockOut}
                  disabled={clockOut.isPending}
                  className="min-w-[140px]"
                >
                  <Square className="h-4 w-4 mr-2" />
                  {clockOut.isPending ? "Stempler..." : "Stemple ud"}
                </Button>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="text-lg py-1 px-3">
                  Ikke stemplet ind
                </Badge>
                <Button
                  size="lg"
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                  className="min-w-[140px]"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {clockIn.isPending ? "Stempler..." : "Stemple ind"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
