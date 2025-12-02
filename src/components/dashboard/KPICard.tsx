import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend,
  variant = "default",
  className 
}: KPICardProps) {
  const variantStyles = {
    default: "from-card to-card/80",
    success: "from-success/10 to-success/5 border-success/20",
    warning: "from-warning/10 to-warning/5 border-warning/20",
    danger: "from-danger/10 to-danger/5 border-danger/20",
  };

  const iconStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    danger: "bg-danger/20 text-danger",
  };

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-gradient-to-br p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-border/80",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            {typeof value === "number" ? value.toLocaleString("da-DK") : value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn("rounded-lg p-2.5", iconStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <span 
            className={cn(
              "text-xs font-semibold",
              trend.value >= 0 ? "text-success" : "text-danger"
            )}
          >
            {trend.value >= 0 ? "+" : ""}{trend.value}%
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}

      {/* Decorative element */}
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-2xl" />
    </div>
  );
}
