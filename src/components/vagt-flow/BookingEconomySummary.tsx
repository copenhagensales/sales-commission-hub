import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBookingDiscount } from "@/hooks/useBookingDiscount";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Info } from "lucide-react";

const kr = (n: number) => `${Math.round(n).toLocaleString("da-DK")} kr`;

/** Brutto, låst rabatsats og netto for én booking. */
export function BookingEconomySummary({ bookingId }: { bookingId?: string | null }) {
  const { data } = useBookingDiscount(bookingId);
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">Økonomi</span>
        {data.isAnnualRevenue && (
          data.lockedPercent == null ? (
            <Badge variant="destructive" className="text-xs">Ukendt sats</Badge>
          ) : (
            <Badge variant="outline" className="text-xs tabular-nums">
              Låst {data.lockedPercent}%
            </Badge>
          )
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Brutto</p>
          <p className="font-semibold tabular-nums">{kr(data.gross)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Rabat</p>
          <p className="font-semibold tabular-nums text-green-600">
            {data.lockedPercent == null ? "-" : `-${kr(data.discountAmount)}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Netto</p>
          <p className="font-semibold tabular-nums">
            {data.lockedPercent == null ? kr(data.gross) : kr(data.net)}
          </p>
        </div>
      </div>

      {data.missingRate && (
        <p className="text-xs text-destructive">
          Ingen dagspris fundet på booking, placering eller lokation. Brutto regnes som 0.
        </p>
      )}

      {data.isAnnualRevenue && data.lockedPercent == null && (
        <p className="text-xs text-destructive">
          Bookingen har ingen låst rabatsats. Satsen er ukendt og skal rettes.
        </p>
      )}

      {data.lockedPercent != null && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-help">
                <Info className="h-3 w-3" />
                Sådan blev satsen målt
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-xs">
              Grundlag ved låsning: {data.basis == null ? "ukendt" : kr(data.basis)}
              {data.lockedAt
                ? ` · låst ${format(parseISO(data.lockedAt), "d. MMM yyyy HH:mm", { locale: da })}`
                : ""}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
