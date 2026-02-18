import { Badge } from "@/components/ui/badge";

interface DataFreshnessBadgeProps {
  dataAsOf: string | null;
  isStale: boolean;
}

export function DataFreshnessBadge({ dataAsOf, isStale }: DataFreshnessBadgeProps) {
  if (!dataAsOf) {
    return <Badge variant="outline">Data mangler timestamp</Badge>;
  }

  const formatted = new Date(dataAsOf).toLocaleString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Badge variant={isStale ? "destructive" : "secondary"}>
      {isStale ? "Stale" : "Live"} · data as of {formatted}
    </Badge>
  );
}
