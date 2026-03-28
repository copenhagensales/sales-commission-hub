import { useState, Fragment } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/calculations/formatting";
import { cn } from "@/lib/utils";

interface ClientDBRowData {
  clientId: string;
  clientName: string;
  teamName: string | null;
  sales: number;
  adjustedRevenue: number;
  adjustedSellerCost: number;
  locationCosts: number;
  fullMonthLocationCosts: number;
  assistantAllocation: number;
  leaderAllocation: number;
  leaderVacationPay: number;
  atpBarsselAllocation: number;
  cancellationPercent: number;
  sickPayPercent: number;
  finalDB: number;
  dbPercent: number;
  // Calculated deduction amounts
  sickPayAmount: number;
  cancellationRevenueDeduction: number;
  revenuePerFTE: number;
  // Full-month expected values
  fullMonthAssistantAllocation: number;
  fullMonthLeaderAllocation: number;
  fullMonthLeaderVacationPay: number;
  fullMonthAtpBarsselAllocation: number;
}

interface TrendInfo {
  change: number;
  isPositive: boolean;
  label: string;
  previousValue: number;
}

interface ClientDBExpandableRowProps {
  client: ClientDBRowData;
  trend?: TrendInfo | null;
  previousPeriodLabel?: string;
  onEditCancellation: (clientId: string, currentValue: number) => void;
  onEditSickPay: (clientId: string, currentValue: number) => void;
  onShowDaily: (client: { id: string; name: string }) => void;
}

export function ClientDBExpandableRow({
  client,
  trend,
  previousPeriodLabel,
  onEditCancellation,
  onEditSickPay,
  onShowDaily,
}: ClientDBExpandableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const totalCosts = 
    client.adjustedSellerCost + 
    client.sickPayAmount +
    client.locationCosts + 
    client.assistantAllocation + 
    client.leaderAllocation + 
    client.leaderVacationPay + 
    client.atpBarsselAllocation;

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  
  // Clamp DB% for progress bar (0-50% range displayed)
  const dbProgressValue = Math.min(Math.max(client.dbPercent, 0), 50) * 2;

  return (
    <Fragment>
      <TableRow className={cn(
        "transition-colors",
        isExpanded && "bg-muted/30"
      )}>
        {/* Expand button */}
        <TableCell className="w-10 p-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>

        {/* Client name */}
        <TableCell className="font-medium min-w-[140px]">{client.clientName}</TableCell>

        {/* Team */}
        <TableCell className="text-muted-foreground text-sm min-w-[100px]">
          {client.teamName || "–"}
        </TableCell>

        {/* Sales */}
        <TableCell className="text-right tabular-nums w-[70px]">{client.sales}</TableCell>

        {/* Revenue with trend */}
        <TableCell className="text-right w-[120px]">
          <div className="flex items-center justify-end gap-1">
            <span className="tabular-nums">{formatCurrency(client.adjustedRevenue)}</span>
            {trend && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn(
                      "flex items-center",
                      trend.isPositive ? "text-primary" : "text-destructive"
                    )}>
                      {trend.isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{trend.label} vs. {previousPeriodLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(trend.previousValue)} → {formatCurrency(client.adjustedRevenue)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>

        {/* Total costs (grouped) */}
        <TableCell className="text-right text-destructive tabular-nums w-[120px]">
          -{formatCurrency(totalCosts)}
        </TableCell>

        {/* Final DB */}
        <TableCell className={cn(
          "text-right font-semibold tabular-nums w-[110px]",
          client.finalDB >= 0 ? "text-primary" : "text-destructive"
        )}>
          {formatCurrency(client.finalDB)}
        </TableCell>

        {/* DB% with mini progress */}
        <TableCell className="w-[140px]">
          <div className="flex items-center gap-2 justify-end">
            <Progress 
              value={dbProgressValue} 
              className={cn(
                "h-2 w-16",
                client.dbPercent >= 20 ? "[&>div]:bg-primary" : 
                client.dbPercent >= 0 ? "[&>div]:bg-muted-foreground" : 
                "[&>div]:bg-destructive"
              )}
            />
            <span className={cn(
              "text-sm font-medium tabular-nums w-12 text-right",
              client.dbPercent >= 20 ? "text-primary" : 
              client.dbPercent >= 0 ? "text-muted-foreground" : 
              "text-destructive"
            )}>
              {formatPercent(client.dbPercent)}
            </span>
          </div>
        </TableCell>


        {/* Actions */}
        <TableCell className="w-12">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onShowDaily({ id: client.clientId, name: client.clientName })}
            title="Vis daglig breakdown"
          >
            <Calendar className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </Button>
        </TableCell>
      </TableRow>

      {/* Expanded cost details */}
      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/30">
          <TableCell></TableCell>
          <TableCell colSpan={8} className="py-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Sælgerløn</p>
                <p className="font-medium text-destructive">
                  -{formatCurrency(client.adjustedSellerCost)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Centre/Boder</p>
                <p className="font-medium text-destructive">
                  {client.locationCosts > 0 ? `-${formatCurrency(client.locationCosts)}` : "–"}
                </p>
                {client.fullMonthLocationCosts > 0 && client.fullMonthLocationCosts !== client.locationCosts && (
                  <p className="text-xs text-muted-foreground">
                    ({formatCurrency(client.fullMonthLocationCosts)}/md.)
                  </p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Assist.løn</p>
                <p className="font-medium text-destructive">
                  {client.assistantAllocation > 0 ? `-${formatCurrency(client.assistantAllocation)}` : "–"}
                </p>
                {client.fullMonthAssistantAllocation > 0 && client.fullMonthAssistantAllocation !== client.assistantAllocation && (
                  <p className="text-xs text-muted-foreground">
                    ({formatCurrency(client.fullMonthAssistantAllocation)}/md.)
                  </p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Lederløn</p>
                <p className="font-medium text-destructive">
                  {client.leaderAllocation > 0 
                    ? `-${formatCurrency(client.leaderAllocation + client.leaderVacationPay)}` 
                    : "–"}
                </p>
                {client.fullMonthLeaderAllocation > 0 && client.fullMonthLeaderAllocation !== client.leaderAllocation && (
                  <p className="text-xs text-muted-foreground">
                    ({formatCurrency(client.fullMonthLeaderAllocation + client.fullMonthLeaderVacationPay)}/md.)
                  </p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">ATP/Barsel</p>
                <p className="font-medium text-destructive">
                  {client.atpBarsselAllocation > 0 ? `-${formatCurrency(client.atpBarsselAllocation)}` : "–"}
                </p>
                {client.fullMonthAtpBarsselAllocation > 0 && client.fullMonthAtpBarsselAllocation !== client.atpBarsselAllocation && (
                  <p className="text-xs text-muted-foreground">
                    ({formatCurrency(client.fullMonthAtpBarsselAllocation)}/md.)
                  </p>
                )}
              </div>
              <div>
                <button
                  onClick={() => onEditCancellation(client.clientId, client.cancellationPercent)}
                  className="text-left hover:text-primary transition-colors"
                >
                  <p className="text-muted-foreground text-xs mb-0.5">Annul. %</p>
                  <p className="font-medium">
                    {client.cancellationPercent > 0 ? formatPercent(client.cancellationPercent) : "–"}
                  </p>
                  {client.cancellationRevenueDeduction > 0 && (
                    <p className="text-xs text-destructive">
                      -{formatCurrency(client.cancellationRevenueDeduction)} oms.
                    </p>
                  )}
                </button>
              </div>
              <div>
                <button
                  onClick={() => onEditSickPay(client.clientId, client.sickPayPercent)}
                  className="text-left hover:text-primary transition-colors"
                >
                  <p className="text-muted-foreground text-xs mb-0.5">Sygeløn %</p>
                  <p className="font-medium">
                    {client.sickPayPercent > 0 ? formatPercent(client.sickPayPercent) : "–"}
                  </p>
                  {client.sickPayAmount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      +{formatCurrency(client.sickPayAmount)}
                    </p>
                  )}
                </button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
