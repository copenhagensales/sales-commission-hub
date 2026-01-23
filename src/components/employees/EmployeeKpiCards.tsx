import { Card } from "@/components/ui/card";
import { Users, Briefcase, Network, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeKpiCardsProps {
  activeCount: number;
  staffCount: number;
  teamCount: number;
  positionCount: number;
}

export function EmployeeKpiCards({ 
  activeCount, 
  staffCount, 
  teamCount, 
  positionCount 
}: EmployeeKpiCardsProps) {
  const kpis = [
    {
      label: "Aktive medarbejdere",
      value: activeCount,
      icon: Users,
      gradient: "from-blue-500/15 to-blue-600/5",
      border: "border-blue-500/20",
      iconColor: "text-blue-500",
      valueColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Stab / Backoffice",
      value: staffCount,
      icon: Briefcase,
      gradient: "from-purple-500/15 to-purple-600/5",
      border: "border-purple-500/20",
      iconColor: "text-purple-500",
      valueColor: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Teams",
      value: teamCount,
      icon: Network,
      gradient: "from-emerald-500/15 to-emerald-600/5",
      border: "border-emerald-500/20",
      iconColor: "text-emerald-500",
      valueColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Stillinger",
      value: positionCount,
      icon: Shield,
      gradient: "from-amber-500/15 to-amber-600/5",
      border: "border-amber-500/20",
      iconColor: "text-amber-500",
      valueColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <Card
          key={kpi.label}
          className={cn(
            "relative overflow-hidden border bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
            kpi.gradient,
            kpi.border
          )}
        >
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </p>
                <p className={cn("text-3xl font-bold tracking-tight", kpi.valueColor)}>
                  {kpi.value.toLocaleString("da-DK")}
                </p>
              </div>
              <div className={cn(
                "rounded-xl p-2.5 bg-background/80 backdrop-blur-sm shadow-sm",
                kpi.iconColor
              )}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
          {/* Decorative gradient orb */}
          <div 
            className={cn(
              "absolute -right-8 -bottom-8 h-24 w-24 rounded-full opacity-20 blur-2xl",
              kpi.iconColor.replace("text-", "bg-")
            )}
          />
        </Card>
      ))}
    </div>
  );
}
