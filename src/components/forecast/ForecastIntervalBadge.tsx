import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ForecastInterval } from "@/types/forecast";

interface Props {
  interval: ForecastInterval;
  value: number;
  className?: string;
}

const intervalConfig: Record<ForecastInterval, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  expected: { label: 'Expected', className: 'bg-primary/10 text-primary border-primary/20' },
  high: { label: 'High', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export function ForecastIntervalBadge({ interval, value, className }: Props) {
  const config = intervalConfig[interval];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className, className)}>
      {config.label}: {value}
    </Badge>
  );
}
