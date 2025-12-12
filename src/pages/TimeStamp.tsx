import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Play, Square, Timer, Calendar, CheckCircle2 } from "lucide-react";
import { useTimeStamps } from "@/hooks/useTimeStamps";
import { toast } from "sonner";
import { format } from "date-fns";
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
  
  const isHourly = employee?.salary_type !== "fixed";

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      
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
    if (effectiveHours !== null && effectiveHours !== undefined) {
      const hours = Math.floor(effectiveHours);
      const minutes = Math.round((effectiveHours - hours) * 60);
      return `${hours}t ${minutes}m`;
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
      <div className="max-w-lg mx-auto space-y-6 px-4 py-6 sm:py-4 sm:px-0">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Stempelur</h1>
          <p className="text-sm text-muted-foreground">
            {format(currentTime, "EEEE d. MMMM", { locale: da })}
          </p>
        </div>

        {/* Main Clock Display */}
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="text-6xl sm:text-7xl font-light font-mono tabular-nums tracking-tight">
            {format(currentTime, "HH:mm")}
          </div>
          
          {/* Status indicator */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            isClockedIn 
              ? "bg-green-500/10 text-green-600 dark:text-green-400" 
              : "bg-muted text-muted-foreground"
          }`}>
            {isClockedIn ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Aktiv · {elapsedTime}
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" />
                Ikke aktiv
              </>
            )}
          </div>

          {activeStamp && (
            <p className="text-sm text-muted-foreground">
              Startet kl. {format(new Date(activeStamp.clock_in), "HH:mm")}
            </p>
          )}
        </div>

        {/* Action Section */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <Textarea
              placeholder="Tilføj en note (valgfrit)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none bg-background/50 border-border/50 focus:border-primary/50"
              rows={2}
            />

            {!isClockedIn ? (
              <Button 
                size="lg" 
                className="w-full h-16 sm:h-14 text-lg sm:text-base font-medium bg-green-600 hover:bg-green-700 active:bg-green-800 shadow-lg shadow-green-600/20 touch-manipulation"
                onClick={handleClockIn}
                disabled={clockIn.isPending}
              >
                <Play className="w-6 h-6 sm:w-5 sm:h-5 mr-2" />
                Start arbejdsdag
              </Button>
            ) : (
              <Button 
                size="lg" 
                variant="destructive"
                className="w-full h-16 sm:h-14 text-lg sm:text-base font-medium shadow-lg shadow-destructive/20 active:opacity-80 touch-manipulation"
                onClick={handleClockOut}
                disabled={clockOut.isPending}
              >
                <Square className="w-6 h-6 sm:w-5 sm:h-5 mr-2" />
                Afslut arbejdsdag
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-md bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Timer className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">I dag</span>
              </div>
              <div className="text-2xl font-semibold">
                {totalHoursToday.toFixed(1)}t
              </div>
              {isHourly && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ekskl. 1t pause
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">7 dage</span>
              </div>
              <div className="text-2xl font-semibold">
                {recentStamps.reduce((total, stamp) => {
                  if (!stamp.clock_out) return total;
                  const clockIn = new Date(stamp.clock_in);
                  const clockOut = new Date(stamp.clock_out);
                  return total + (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
                }, 0).toFixed(1)}t
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {recentStamps.filter(s => s.clock_out).length} dage
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Log */}
        {todayStamps.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground px-1">
              Dagens stemplinger
            </h2>
            <div className="space-y-2">
              {todayStamps.map((stamp) => {
                // Always show actual clock times
                const actualIn = format(new Date(stamp.clock_in), "HH:mm");
                const actualOut = stamp.clock_out 
                  ? format(new Date(stamp.clock_out), "HH:mm")
                  : null;
                
                // Show effective times only if they differ from actual times
                const effectiveIn = stamp.effective_clock_in 
                  ? format(new Date(stamp.effective_clock_in), "HH:mm")
                  : null;
                const effectiveOut = stamp.effective_clock_out 
                  ? format(new Date(stamp.effective_clock_out), "HH:mm")
                  : null;
                
                const hasEffectiveDifference = 
                  (effectiveIn && effectiveIn !== actualIn) || 
                  (effectiveOut && actualOut && effectiveOut !== actualOut);
                
                return (
                  <Card key={stamp.id} className="border-0 shadow-sm bg-card/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-full ${stamp.clock_out ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                            {stamp.clock_out ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">
                              {actualIn}
                              <span className="text-muted-foreground mx-1.5">→</span>
                              {actualOut || "..."}
                            </div>
                            {stamp.note && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {stamp.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {formatDuration(stamp.clock_in, stamp.clock_out, stamp.effective_hours)}
                          </div>
                          {hasEffectiveDifference && effectiveIn && stamp.clock_out && effectiveOut && (
                            <p className="text-xs text-muted-foreground">
                              Effektiv: {effectiveIn}–{effectiveOut}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
