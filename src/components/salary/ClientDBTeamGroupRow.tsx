import { TableRow, TableCell } from "@/components/ui/table";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/calculations/formatting";
import { cn } from "@/lib/utils";

export interface ClientDBTeamGroupSummary {
  key: string;
  teamId: string | null;
  teamName: string;
  clientCount: number;
  sales: number;
  revenue: number;
  costs: number;
  finalDB: number;
  dbPercent: number;
  /** Teamets samlede lederløn inkl. feriepenge (beregnes på teamniveau) */
  leaderCost: number;
  leaderHasBasis: boolean;
}

interface Props {
  group: ClientDBTeamGroupSummary;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Sammentællingsrække for et team i "DB per klient".
 *
 * Rent visning: alle tal kommer fra `useClientDbData` (klientrækker + team-
 * sammendrag). Lederlønnen vises på teamniveau, fordi det er det niveau den
 * faktisk beregnes på — fordelingen ud på klienter er en beregningsdetalje.
 */
export function ClientDBTeamGroupRow({ group, isExpanded, onToggle }: Props) {
  return (
    <TableRow
      className="bg-muted/60 hover:bg-muted cursor-pointer font-medium border-t-2"
      onClick={onToggle}
    >
      <TableCell className="py-2">
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </TableCell>
      <TableCell className="py-2">
        <div className="flex flex-col">
          <span className="truncate">{group.teamName}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {group.clientCount} {group.clientCount === 1 ? "klient" : "klienter"}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-2 text-xs font-normal text-muted-foreground">
        {group.leaderHasBasis ? (
          <span>Lederløn {formatCurrency(group.leaderCost)}</span>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Lederløn mangler grundlag
              </TooltipTrigger>
              <TooltipContent>
                Teamet mangler leder, lønrække eller procentsats — lederlønnen indgår som 0 kr.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
      <TableCell className="py-2 text-right tabular-nums">{group.sales}</TableCell>
      <TableCell className="py-2 text-right tabular-nums">
        {formatCurrency(group.revenue)}
      </TableCell>
      <TableCell className="py-2 text-right tabular-nums">
        {formatCurrency(group.costs)}
      </TableCell>
      <TableCell
        className={cn(
          "py-2 text-right tabular-nums font-semibold",
          group.finalDB >= 0 ? "text-primary" : "text-destructive"
        )}
      >
        {formatCurrency(group.finalDB)}
      </TableCell>
      <TableCell
        className={cn(
          "py-2 text-right tabular-nums",
          group.dbPercent >= 20
            ? "text-primary"
            : group.dbPercent >= 0
              ? "text-muted-foreground"
              : "text-destructive"
        )}
      >
        {group.dbPercent.toFixed(1)}%
      </TableCell>
      <TableCell className="py-2" />
    </TableRow>
  );
}
