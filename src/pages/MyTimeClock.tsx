import { useState, useEffect } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Clock, Play, Square, Timer, Briefcase, Calendar, CheckCircle2, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentEmployee } from "@/hooks/useShiftPlanning";
import { useEmployeeTimeClocks } from "@/hooks/useEmployeeTimeClocks";
import { useTimeStamps } from "@/hooks/useTimeStamps";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyTimeClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { data: employee, isLoading: empLoading } = useCurrentEmployee();
  const { clocks, isLoading: clocksLoading } = useEmployeeTimeClocks({
    employeeId: employee?.id,
    activeOnly: true,
  });

  const {
    activeStamp,
    todayStamps,
    recentStamps,
    secondaryClients,
    totalHoursToday,
    isLoading: stampsLoading,
    clockIn,
    clockOut,
    isClockedIn,
  } = useTimeStamps();

  const [note, setNote] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("primary");
  const [elapsedTime, setElapsedTime] = useState("");

  const hasSecondaryClients = secondaryClients.length > 0;
  const clientNameMap = new Map<string, string>();
  secondaryClients.forEach(sc => clientNameMap.set(sc.client_id, sc.client_name));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      if (activeStamp) {
        const diff = new Date().getTime() - new Date(activeStamp.clock_in).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsedTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeStamp]);

  const handleClockIn = async () => {
    try {
      const clientId = selectedClientId === "primary" ? undefined : selectedClientId;
      await clockIn.mutateAsync({ note: note || undefined, clientId });
      setNote("");
    } catch {}
  };

  const handleClockOut = async () => {
    if (!activeStamp) return;
    try {
      await clockOut.mutateAsync({ id: activeStamp.id, note: note || undefined });
      setNote("");
    } catch {}
  };

  const formatDuration = (ci: string, co: string | null, effectiveHours?: number | null) => {
    if (effectiveHours != null) {
      const h = Math.floor(effectiveHours);
      const m = Math.round((effectiveHours - h) * 60);
      return `${h}t ${m}m`;
    }
    const start = new Date(ci);
    const end = co ? new Date(co) : new Date();
    const diff = end.getTime() - start.getTime();
    return `${Math.floor(diff / 3600000)}t ${Math.floor((diff % 3600000) / 60000)}m`;
  };

  if (empLoading || clocksLoading || stampsLoading) {
    return (
      <MainLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!employee || clocks.length === 0) {
    return (
      <MainLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Stempelur</h1>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Du har ingen aktive stempelure tildelt.
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const clockTypeLabel = (type: string) => {
    switch (type) {
      case "override": return "Overskrivende";
      case "documentation": return "Dokumentation";
      case "revenue": return "Omsætning/time";
      default: return type;
    }
  };

  const clockTypeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type) {
      case "override": return "default";
      case "documentation": return "secondary";
      case "revenue": return "outline";
      default: return "default";
    }
  };

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto space-y-6 px-4 py-6 sm:py-4 sm:px-0">
        {/* Header med ur */}
        <div className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Stempelur</h1>
          <p className="text-sm text-muted-foreground">
            {format(currentTime, "EEEE d. MMMM", { locale: da })}
          </p>
        </div>

        {/* Clock display */}
        <div className="text-center space-y-4">
          <div className="text-6xl sm:text-7xl font-light font-mono tabular-nums tracking-tight">
            {format(currentTime, "HH:mm")}
          </div>

          {/* Status */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            isClockedIn
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}>
            {isClockedIn ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Aktiv · {elapsedTime}
                {activeStamp?.client_id && clientNameMap.has(activeStamp.client_id) && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {clientNameMap.get(activeStamp.client_id)}
                  </Badge>
                )}
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

        {/* Tildelte stempelure */}
        <div className="grid gap-3">
          {clocks.map((clock) => (
            <Card key={clock.id} className="border-0 shadow-sm bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{clock.project_name || "Stempelur"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {clock.hourly_rate > 0 && (
                      <span className="text-xs text-muted-foreground">{clock.hourly_rate} DKK/t</span>
                    )}
                    <Badge variant={clockTypeVariant(clock.clock_type)} className="text-xs">
                      {clockTypeLabel(clock.clock_type)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stemple ind/ud */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur">
          <CardContent className="p-4 sm:p-6 space-y-4">
            {hasSecondaryClients && !isClockedIn && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Stempl på kunde
                </label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primær kunde</SelectItem>
                    {secondaryClients.map(sc => (
                      <SelectItem key={sc.client_id} value={sc.client_id}>
                        {sc.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-md bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Timer className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">I dag</span>
              </div>
              <div className="text-2xl font-semibold">{totalHoursToday.toFixed(1)}t</div>
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
                {recentStamps.reduce((total, s) => {
                  if (!s.clock_out) return total;
                  return total + (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3600000;
                }, 0).toFixed(1)}t
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {recentStamps.filter(s => s.clock_out).length} dage
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Dagens stemplinger */}
        {todayStamps.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground px-1">Dagens stemplinger</h2>
            <div className="space-y-2">
              {todayStamps.map((stamp) => {
                const actualIn = format(new Date(stamp.clock_in), "HH:mm");
                const actualOut = stamp.clock_out ? format(new Date(stamp.clock_out), "HH:mm") : null;
                const stampClientName = stamp.client_id ? clientNameMap.get(stamp.client_id) : null;

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
                            <div className="font-medium flex items-center gap-2">
                              <span>{actualIn} <span className="text-muted-foreground mx-1">→</span> {actualOut || "..."}</span>
                              {stampClientName && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{stampClientName}</Badge>
                              )}
                            </div>
                            {stamp.note && <p className="text-xs text-muted-foreground mt-0.5">{stamp.note}</p>}
                          </div>
                        </div>
                        <div className="font-medium">{formatDuration(stamp.clock_in, stamp.clock_out, stamp.effective_hours)}</div>
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
