import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Play, Square, Timer, Calendar } from "lucide-react";
import { useTimeStamps } from "@/hooks/useTimeStamps";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";

export default function TimeStamp() {
  const { 
    activeStamp, 
    todayStamps, 
    recentStamps,
    totalHoursToday, 
    isLoading, 
    clockIn, 
    clockOut,
    isClockedIn,
    employee
  } = useTimeStamps();
  
  const [note, setNote] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState("");
  
  // Check if employee is hourly (has 1 hour break deducted) - salary_type "hourly" or "provision" workers are hourly
  const isHourly = employee?.salary_type !== "fixed";

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      
      // Calculate elapsed time if clocked in
      if (activeStamp) {
        const clockInTime = new Date(activeStamp.clock_in);
        const diff = new Date().getTime() - clockInTime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setElapsedTime(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [activeStamp]);

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync(note || undefined);
      setNote("");
      toast.success("Du er nu stemplet ind");
    } catch (error) {
      toast.error("Kunne ikke stemple ind");
    }
  };

  const handleClockOut = async () => {
    if (!activeStamp) return;
    try {
      await clockOut.mutateAsync({ id: activeStamp.id, note: note || undefined });
      setNote("");
      toast.success("Du er nu stemplet ud");
    } catch (error) {
      toast.error("Kunne ikke stemple ud");
    }
  };

  const formatDuration = (clockIn: string, clockOut: string | null, effectiveHours?: number | null) => {
    // If we have effective hours, show that
    if (effectiveHours !== null && effectiveHours !== undefined) {
      const hours = Math.floor(effectiveHours);
      const minutes = Math.round((effectiveHours - hours) * 60);
      return `${hours}t ${minutes}m (effektiv)`;
    }
    
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}t ${minutes}m`;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stempel</h1>
          <p className="text-muted-foreground">Registrer din arbejdstid</p>
        </div>

        {/* Main Clock Card */}
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-6xl font-mono tabular-nums">
              {format(currentTime, "HH:mm:ss")}
            </CardTitle>
            <CardDescription className="text-lg">
              {format(currentTime, "EEEE d. MMMM yyyy", { locale: da })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Badge */}
            <div className="flex justify-center">
              {isClockedIn ? (
                <Badge variant="default" className="text-lg px-4 py-2 bg-green-600 hover:bg-green-700">
                  <Clock className="w-5 h-5 mr-2 animate-pulse" />
                  Stemplet ind - {elapsedTime}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  <Clock className="w-5 h-5 mr-2" />
                  Ikke stemplet ind
                </Badge>
              )}
            </div>

            {/* Clock In Time Display */}
            {activeStamp && (
              <div className="text-center text-muted-foreground">
                Stemplet ind kl. {format(new Date(activeStamp.clock_in), "HH:mm")}
              </div>
            )}

            {/* Note Input */}
            <Textarea
              placeholder="Tilføj en note (valgfrit)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none"
              rows={2}
            />

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              {!isClockedIn ? (
                <Button 
                  size="lg" 
                  className="w-48 h-16 text-xl bg-green-600 hover:bg-green-700"
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                >
                  <Play className="w-6 h-6 mr-2" />
                  Stempel ind
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  variant="destructive"
                  className="w-48 h-16 text-xl"
                  onClick={handleClockOut}
                  disabled={clockOut.isPending}
                >
                  <Square className="w-6 h-6 mr-2" />
                  Stempel ud
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Summary */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Timer className="w-5 h-5" />
                I dag (effektiv tid)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {totalHoursToday.toFixed(1)} timer
              </div>
              <p className="text-muted-foreground text-sm">
                {todayStamps.length} stempling{todayStamps.length !== 1 ? "er" : ""}
              </p>
              {isHourly && (
                <p className="text-xs text-amber-600 mt-1">
                  * 1 times pause fratrukket pr. dag
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Seneste 7 dage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {recentStamps.reduce((total, stamp) => {
                  if (!stamp.clock_out) return total;
                  const clockIn = new Date(stamp.clock_in);
                  const clockOut = new Date(stamp.clock_out);
                  return total + (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
                }, 0).toFixed(1)} timer
              </div>
              <p className="text-muted-foreground text-sm">
                {recentStamps.filter(s => s.clock_out).length} afsluttede stemplinger
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Log */}
        {todayStamps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dagens stemplinger</CardTitle>
              {isHourly && (
                <p className="text-xs text-muted-foreground">
                  Effektiv tid er baseret på din vagt med 1 times pause fratrukket
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayStamps.map((stamp) => {
                  const effectiveIn = stamp.effective_clock_in 
                    ? format(new Date(stamp.effective_clock_in), "HH:mm")
                    : null;
                  const effectiveOut = stamp.effective_clock_out 
                    ? format(new Date(stamp.effective_clock_out), "HH:mm")
                    : null;
                  const hasEffectiveTime = effectiveIn && (stamp.clock_out ? effectiveOut : true);
                  
                  return (
                    <div 
                      key={stamp.id} 
                      className="p-3 bg-muted/50 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground text-xs mr-1">Registreret:</span>
                            <span className="font-medium">
                              {format(new Date(stamp.clock_in), "HH:mm")}
                            </span>
                            <span className="text-muted-foreground"> → </span>
                            <span className="font-medium">
                              {stamp.clock_out 
                                ? format(new Date(stamp.clock_out), "HH:mm")
                                : "..."
                              }
                            </span>
                          </div>
                          {stamp.note && (
                            <span className="text-sm text-muted-foreground">
                              "{stamp.note}"
                            </span>
                          )}
                        </div>
                        <Badge variant={stamp.clock_out ? "secondary" : "default"}>
                          {formatDuration(stamp.clock_in, stamp.clock_out, stamp.effective_hours)}
                        </Badge>
                      </div>
                      
                      {/* Show effective time if different from registered */}
                      {hasEffectiveTime && stamp.clock_out && (
                        <div className="text-xs text-blue-600 pl-1">
                          <span className="text-muted-foreground mr-1">Effektiv:</span>
                          {effectiveIn} → {effectiveOut}
                          {stamp.effective_hours !== null && (
                            <span className="ml-2 font-medium">
                              = {stamp.effective_hours.toFixed(1)} timer
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
