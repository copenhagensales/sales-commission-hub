import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  formatAsCurrency?: boolean;
}

export function KpiCard({ title, value, subtitle, trend, formatAsCurrency = true }: KpiCardProps) {
  const formattedValue = formatAsCurrency
    ? new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(value)
    : value.toLocaleString('da-DK');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold",
          trend === 'up' && "text-green-600",
          trend === 'down' && "text-red-600"
        )}>
          {formattedValue}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
