import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FinancialKpiCardProps {
  title: string;
  value: number;
  previousYear?: number;
  subtitle?: string;
  className?: string;
  showTrend?: boolean;
  invertTrend?: boolean;
  icon?: React.ReactNode;
}

export function FinancialKpiCard({ 
  title, 
  value, 
  previousYear, 
  subtitle, 
  className,
  showTrend = true,
  invertTrend = false,
  icon,
}: FinancialKpiCardProps) {
  const formatCurrency = (amount: number) => {
    if (Math.abs(amount) >= 1000000) {
      return new Intl.NumberFormat('da-DK', {
        style: 'currency',
        currency: 'DKK',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        notation: 'compact',
      }).format(amount);
    }
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(0)}%`;
  };

  const percentChange = previousYear ? ((value - previousYear) / Math.abs(previousYear)) * 100 : 0;
  const isPositive = invertTrend ? percentChange < 0 : percentChange > 0;
  const isNeutral = Math.abs(percentChange) < 1;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon && (
            <div className="text-muted-foreground/50">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold tracking-tight",
          value < 0 && "text-destructive"
        )}>
          {formatCurrency(value)}
        </div>
        <div className="flex items-center justify-between mt-2">
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {showTrend && previousYear !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              isNeutral 
                ? "bg-muted text-muted-foreground" 
                : isPositive 
                  ? "bg-green-500/10 text-green-600" 
                  : "bg-red-500/10 text-red-500"
            )}>
              {isNeutral ? (
                <Minus className="h-3 w-3" />
              ) : isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{formatPercent(percentChange)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
