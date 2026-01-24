import { Card } from "@/components/ui/card";
import { Trophy, Medal, Hash, DollarSign } from "lucide-react";
import { usePrecomputedKpis, getKpiDisplay } from "@/hooks/usePrecomputedKpi";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LeagueKpiCardsProps {
  employeeId: string;
  className?: string;
}

export function LeagueKpiCards({ employeeId, className }: LeagueKpiCardsProps) {
  const { data: ligaKpis, isLoading } = usePrecomputedKpis(
    ["liga_position", "liga_division", "liga_division_rank", "liga_provision"],
    "current",
    "employee",
    employeeId
  );

  const kpis = [
    {
      label: "Liga Position",
      value: getKpiDisplay(ligaKpis?.liga_position, "-"),
      icon: Trophy,
      gradient: "from-yellow-500/15 to-yellow-600/5",
      border: "border-yellow-500/20",
      iconColor: "text-yellow-500",
      valueColor: "text-yellow-600 dark:text-yellow-400",
    },
    {
      label: "Division",
      value: getKpiDisplay(ligaKpis?.liga_division, "-"),
      icon: Medal,
      gradient: "from-blue-500/15 to-blue-600/5",
      border: "border-blue-500/20",
      iconColor: "text-blue-500",
      valueColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Rank i Division",
      value: getKpiDisplay(ligaKpis?.liga_division_rank, "-"),
      icon: Hash,
      gradient: "from-purple-500/15 to-purple-600/5",
      border: "border-purple-500/20",
      iconColor: "text-purple-500",
      valueColor: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Liga Provision",
      value: getKpiDisplay(ligaKpis?.liga_provision, "-"),
      icon: DollarSign,
      gradient: "from-emerald-500/15 to-emerald-600/5",
      border: "border-emerald-500/20",
      iconColor: "text-emerald-500",
      valueColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  // Don't render if no league data
  const hasData = Object.keys(ligaKpis || {}).length > 0;
  if (!hasData) {
    return null;
  }

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {kpis.map((kpi) => (
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
                  {kpi.value}
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
