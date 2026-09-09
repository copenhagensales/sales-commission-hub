import { Badge } from "@/components/ui/badge";
import {
  useHasAnnualRevenueRules,
  useSupplierDiscountStatus,
} from "@/hooks/useSupplierDiscountStatus";

interface SupplierDiscountPanelProps {
  /** location.type - leverandøren */
  locationType?: string | null;
}

const kr = (n: number) => `${Math.round(n).toLocaleString("da-DK")} kr`;

/**
 * Viser leverandørens kumulerede grundlag, nuværende sats og næste trin.
 * Satsen der vises er den bookingen LÅSES til, fordi trinnet skal være nået
 * før bookingen oprettes - bookingen tæller ikke i sit eget grundlag.
 */
export function SupplierDiscountPanel({ locationType }: SupplierDiscountPanelProps) {
  const { data: hasRules } = useHasAnnualRevenueRules(locationType);
  const { data: status } = useSupplierDiscountStatus(locationType, !!hasRules);

  if (!hasRules || !status) return null;

  return (
    <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Leverandørrabat · {locationType}
        </span>
        <Badge variant="outline" className="tabular-nums">
          {status.currentPercent > 0 ? `${status.currentPercent}%` : "Ingen rabat"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Grundlag i år</p>
          <p className="font-semibold tabular-nums">{kr(status.basis)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Næste trin</p>
          <p className="font-semibold tabular-nums">
            {status.nextPercent != null ? `${status.nextPercent}%` : "Højeste nået"}
          </p>
          {status.nextMinRevenue != null && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Mangler {kr(status.remainingToNext ?? 0)} (fra {kr(status.nextMinRevenue)})
            </p>
          )}
        </div>
      </div>

      <p className="text-xs font-medium">
        Denne booking låses til {status.currentPercent}%
      </p>
      <p className="text-[11px] text-muted-foreground">
        Satsen fryses ved oprettelsen og ændres ikke bagudrettet.
      </p>
    </div>
  );
}
