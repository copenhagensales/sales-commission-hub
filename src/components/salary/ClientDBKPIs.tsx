import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercentage } from "@/lib/calculations/formatting";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Percent, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientDBKPIsProps {
  totalRevenue: number;
  totalDB: number;
  dbPercent: number;
  netEarnings: number;
  isLoading?: boolean;
}

export function ClientDBKPIs({
  totalRevenue,
  totalDB,
  dbPercent,
  netEarnings,
  isLoading = false,
}: ClientDBKPIsProps) {
  const kpis = [
    {
      label: "Total Omsætning",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "Total DB",
      value: formatCurrency(totalDB),
      icon: PiggyBank,
      colorClass: totalDB >= 0 ? "text-primary" : "text-destructive",
      bgClass: totalDB >= 0 ? "bg-primary/10" : "bg-destructive/10",
    },
    {
      label: "DB%",
      value: formatPercentage(dbPercent),
      icon: Percent,
      colorClass: dbPercent >= 20 ? "text-primary" : dbPercent >= 0 ? "text-muted-foreground" : "text-destructive",
      bgClass: dbPercent >= 20 ? "bg-primary/10" : dbPercent >= 0 ? "bg-muted/50" : "bg-destructive/10",
    },
    {
      label: "Netto Indtjening",
      value: formatCurrency(netEarnings),
      icon: Wallet,
      colorClass: netEarnings >= 0 ? "text-primary" : "text-destructive",
      bgClass: netEarnings >= 0 ? "bg-primary/10" : "bg-destructive/10",
      trend: netEarnings >= 0 ? TrendingUp : TrendingDown,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-2" />
            <div className="h-6 bg-muted rounded w-32" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="p-4 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {kpi.label}
              </p>
              <p className={cn("text-xl font-bold", kpi.colorClass)}>
                {kpi.value}
              </p>
            </div>
            <div className={cn("p-2 rounded-lg", kpi.bgClass)}>
              <kpi.icon className={cn("h-4 w-4", kpi.colorClass)} />
            </div>
          </div>
          {kpi.trend && (
            <div className="mt-2 flex items-center gap-1">
              <kpi.trend className={cn("h-3 w-3", kpi.colorClass)} />
              <span className={cn("text-xs", kpi.colorClass)}>
                {netEarnings >= 0 ? "Overskud" : "Underskud"}
              </span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
