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
  invertTrend?: boolean; // For costs where decrease is good
}

export function FinancialKpiCard({ 
  title, 
  value, 
  previousYear, 
  subtitle, 
  className,
  showTrend = true,
  invertTrend = false,
}: FinancialKpiCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const percentChange = previousYear ? ((value - previousYear) / Math.abs(previousYear)) * 100 : 0;
  const isPositive = invertTrend ? percentChange < 0 : percentChange > 0;
  const isNeutral = Math.abs(percentChange) < 1;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold",
          value < 0 && "text-destructive"
        )}>
          {formatCurrency(value)}
        </div>
        {showTrend && previousYear !== undefined && (
          <div className={cn(
            "flex items-center gap-1 mt-2 text-sm",
            isNeutral ? "text-muted-foreground" : isPositive ? "text-green-600" : "text-red-500"
          )}>
            {isNeutral ? (
              <Minus className="h-4 w-4" />
            ) : isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{formatPercent(percentChange)} vs. året før</span>
          </div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
