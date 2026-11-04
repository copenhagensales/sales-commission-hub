import { useLocationRefundLine } from "@/hooks/useLocationRefundLine";
import { formatRefusionLinje } from "@/lib/fm/refusionLinje";

/** Dagspris og separat Eesy-tillæg fra kædereglen – kun visning. */
export function RefusionLinje(props: { locationId?: string | null; bookingId?: string | null }) {
  const line = useLocationRefundLine(props);
  if (!line) return null;
  return <p className="text-sm text-muted-foreground tabular-nums">{formatRefusionLinje(line)}</p>;
}
