import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle, Info } from "lucide-react";
import type { StabilityAlert } from "@/hooks/useStabilityAlerts";

interface AlertBannerProps {
  alerts: StabilityAlert[];
}

const levelConfig = {
  critical: {
    icon: XCircle,
    badge: "destructive" as const,
    label: "Kritisk",
    borderColor: "border-l-red-500",
  },
  warning: {
    icon: AlertTriangle,
    badge: "secondary" as const,
    label: "Advarsel",
    borderColor: "border-l-amber-500",
  },
  info: {
    icon: Info,
    badge: "outline" as const,
    label: "Info",
    borderColor: "border-l-blue-500",
  },
};

export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.level === "critical").length;
  const warningCount = alerts.filter((a) => a.level === "warning").length;

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Aktive Alerts
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs">{criticalCount} kritisk{criticalCount > 1 ? "e" : ""}</Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary" className="text-xs">{warningCount} advarsl{warningCount > 1 ? "er" : ""}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {alerts.map((alert) => {
          const config = levelConfig[alert.level];
          const Icon = config.icon;
          return (
            <div
              key={alert.id}
              className={`flex items-center gap-3 rounded-md border-l-4 ${config.borderColor} bg-background px-3 py-2 text-xs`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium min-w-[100px]">{alert.integration}</span>
              <span className="text-muted-foreground flex-1">{alert.message}</span>
              <Badge variant={config.badge} className="text-[10px]">{config.label}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
