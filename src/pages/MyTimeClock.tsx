import { useState, useEffect } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Clock, Play, Square, Timer, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentEmployee } from "@/hooks/useShiftPlanning";
import { useEmployeeTimeClocks } from "@/hooks/useEmployeeTimeClocks";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyTimeClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { data: employee, isLoading: empLoading } = useCurrentEmployee();
  const { clocks, isLoading: clocksLoading } = useEmployeeTimeClocks({
    employeeId: employee?.id,
    activeOnly: true,
  });

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (empLoading || clocksLoading) {
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
      <div className="p-6 space-y-6">
        {/* Header med ur */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6" />
              Stempelur
            </h1>
            <p className="text-muted-foreground mt-1">
              {format(currentTime, "EEEE d. MMMM yyyy", { locale: da })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-mono font-bold tabular-nums">
              {format(currentTime, "HH:mm:ss")}
            </p>
          </div>
        </div>

        {/* Aktive stempelure */}
        <div className="grid gap-4 md:grid-cols-2">
          {clocks.map((clock) => (
            <Card key={clock.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    {clock.project_name || "Stempelur"}
                  </div>
                  <Badge variant={clockTypeVariant(clock.clock_type)}>
                    {clockTypeLabel(clock.clock_type)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {clock.hourly_rate > 0 && (
                    <div>
                      <span className="text-muted-foreground">Timesats:</span>{" "}
                      <span className="font-medium">{clock.hourly_rate} DKK</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
