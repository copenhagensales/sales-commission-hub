import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { DBPeriodSelector } from "./DBPeriodSelector";
import { ClientDBDailyBreakdown } from "./ClientDBDailyBreakdown";
import { ClientDBKPIs } from "./ClientDBKPIs";
import { ClientDBExpandableRow } from "./ClientDBExpandableRow";
import {
  ClientDBTeamGroupRow,
  type ClientDBTeamGroupSummary,
} from "./ClientDBTeamGroupRow";
import { ClientDBSummaryCard } from "./ClientDBSummaryCard";
import { ClientDBDailyChart } from "./ClientDBDailyChart";
import { DbDataQualityPanel } from "./DbDataQualityPanel";
import { useClientPeriodComparison } from "@/hooks/useClientPeriodComparison";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";
import {
  useClientDbData,
  type ClientDbRow,
  type DbPeriodMode,
} from "@/hooks/useClientDbData";
import { useMonthlyOverhead } from "@/hooks/useMonthlyOverhead";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

type SortColumn =
  | "clientName"
  | "teamName"
  | "sales"
  | "revenue"
  | "costs"
  | "finalDB"
  | "dbPercent"
  | "revenuePerFTE";
type SortDirection = "asc" | "desc";

/** Samme omkostningssum som vises i kolonnen "Omkostninger" pr. klient. */
function rowCosts(row: ClientDbRow): number {
  return (
    row.adjustedSellerCost +
    row.sickPayAmount +
    row.locationCosts +
    row.teamExpenseAllocation +
    row.assistantAllocation +
    row.leaderAllocation +
    row.leaderVacationPay +
    row.atpBarsselAllocation
  );
}

/**
 * DB per klient.
 *
 * Al beregning ligger i `useClientDbData` (som bruger `dbModel.ts`), så DB
 * Oversigt og denne fane altid viser samme lederløn, assistentløn og ATP.
 * Overhead (Stab + stabslønninger) beregnes af `useMonthlyOverhead` ud fra
 * data — ikke af et hardkodet tal.
 */
export function ClientDBTab() {
  const [periodStart, setPeriodStart] = useState(() => startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState(() => endOfMonth(new Date()));
  const [periodMode, setPeriodMode] = useState<DbPeriodMode>("month");
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | undefined>("Denne måned");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"cancellation" | "sickPay">("cancellation");
  const [editValue, setEditValue] = useState<string>("");
  const [selectedClientForDaily, setSelectedClientForDaily] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("finalDB");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hideZeroClients, setHideZeroClients] = useState(true);
  const [groupByTeam, setGroupByTeam] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const isFullPeriodMode = periodMode === "month" || periodMode === "payroll";

  // --- Fælles DB-beregning (samme kilde som DB Oversigt) ---
  const {
    clientRows,
    teamSummaryById,
    totals,
    isLoading: dbLoading,
    isCapped,
    effectivePeriodEnd,
    settingsFallback,
  } = useClientDbData({
    periodStart,
    periodEnd,
    periodMode,
    capAtToday: true,
  });

  // --- Overhead: Stab-udgifter + stabslønninger (data-drevet) ---
  const overhead = useMonthlyOverhead({
    periodStart,
    periodEnd: effectivePeriodEnd,
    isFullPeriod: isFullPeriodMode && !isCapped,
  });
  const overheadFullPeriod = useMonthlyOverhead({
    periodStart,
    periodEnd,
    isFullPeriod: isFullPeriodMode,
    enabled: isCapped,
  });

  // --- 31-dages vindue til NETTO-grafen (uafhængigt af valgt periode) ---
  const chartPeriodStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const chartPeriodEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const { data: dailyAggregates, isLoading: dailyAggregatesLoading } = useSalesAggregatesExtended({
    periodStart: chartPeriodStart,
    periodEnd: chartPeriodEnd,
    groupBy: ["date"],
    enabled: true,
  });

  const chartDb = useClientDbData({
    periodStart: chartPeriodStart,
    periodEnd: chartPeriodEnd,
    periodMode: "custom",
    forceDirectSales: true,
  });
  const chartOverhead = useMonthlyOverhead({
    periodStart: chartPeriodStart,
    periodEnd: chartPeriodEnd,
    isFullPeriod: true,
  });

  const chartTotals = useMemo(
    () => ({
      totalRevenue: Math.round(chartDb.totals.adjustedRevenue),
      teamDB: Math.round(chartDb.totals.finalDB),
      nettoTotal: Math.round(chartDb.totals.finalDB - chartOverhead.total),
      totalOverhead: Math.round(chartOverhead.total),
    }),
    [chartDb.totals, chartOverhead.total]
  );

  const { data: previousPeriodData, previousPeriodLabel } = useClientPeriodComparison(
    periodStart,
    periodEnd,
    periodMode
  );

  const handlePeriodChange = (start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const handleEditCancellationClick = (clientId: string, currentValue: number) => {
    setEditingClientId(clientId);
    setEditingType("cancellation");
    setEditValue(currentValue.toString());
  };

  const handleEditSickPayClick = (clientId: string, currentValue: number) => {
    setEditingClientId(clientId);
    setEditingType("sickPay");
    setEditValue(currentValue.toString());
  };

  const handleSaveAdjustmentPercent = async (clientId: string) => {
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      toast.error("Ugyldig værdi. Indtast et tal mellem 0 og 100.");
      return;
    }

    const columnName = editingType === "cancellation" ? "cancellation_percent" : "sick_pay_percent";
    const successMessage =
      editingType === "cancellation"
        ? "Annulleringsprocent opdateret"
        : "Sygefraværsprocent opdateret";
    const errorMessage =
      editingType === "cancellation"
        ? "Kunne ikke opdatere annulleringsprocent"
        : "Kunne ikke opdatere sygefraværsprocent";

    try {
      const { data: existing } = await supabase
        .from("client_adjustment_percents")
        .select("id")
        .eq("client_id", clientId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("client_adjustment_percents")
          .update({ [columnName]: newValue })
          .eq("client_id", clientId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_adjustment_percents")
          .insert({ client_id: clientId, [columnName]: newValue });
        if (error) throw error;
      }

      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ["client-adjustment-percents"] });
      setEditingClientId(null);
    } catch (error) {
      console.error(`Error updating ${columnName}:`, error);
      toast.error(errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, clientId: string) => {
    if (e.key === "Enter") handleSaveAdjustmentPercent(clientId);
    else if (e.key === "Escape") setEditingClientId(null);
  };

  const filteredAndSortedData = useMemo(() => {
    let data = [...clientRows];
    if (hideZeroClients) {
      data = data.filter((c) => c.sales > 0 || c.revenue > 0);
    }

    data.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortColumn) {
        case "clientName":
          aVal = a.clientName.toLowerCase();
          bVal = b.clientName.toLowerCase();
          break;
        case "teamName":
          aVal = (a.teamName || "").toLowerCase();
          bVal = (b.teamName || "").toLowerCase();
          break;
        case "sales":
          aVal = a.sales;
          bVal = b.sales;
          break;
        case "revenue":
          aVal = a.adjustedRevenue;
          bVal = b.adjustedRevenue;
          break;
        case "costs":
          aVal =
            a.adjustedSellerCost +
            a.sickPayAmount +
            a.locationCosts +
            a.teamExpenseAllocation +
            a.assistantAllocation +
            a.leaderAllocation +
            a.leaderVacationPay +
            a.atpBarsselAllocation;
          bVal =
            b.adjustedSellerCost +
            b.sickPayAmount +
            b.locationCosts +
            b.teamExpenseAllocation +
            b.assistantAllocation +
            b.leaderAllocation +
            b.leaderVacationPay +
            b.atpBarsselAllocation;
          break;
        case "dbPercent":
          aVal = a.dbPercent;
          bVal = b.dbPercent;
          break;
        case "revenuePerFTE":
          aVal = a.revenuePerFTE;
          bVal = b.revenuePerFTE;
          break;
        case "finalDB":
        default:
          aVal = a.finalDB;
          bVal = b.finalDB;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return data;
  }, [clientRows, sortColumn, sortDirection, hideZeroClients]);

  const clientActivity = useMemo(
    () =>
      clientRows.map((c) => ({
        clientId: c.clientId,
        clientName: c.clientName,
        teamId: c.teamId,
        sales: c.sales,
        revenue: c.revenue,
      })),
    [clientRows]
  );

  /**
   * Gruppering pr. team. Rent visning — rækkerne er de samme som i den flade
   * liste, og sammentællingen er en simpel sum af de viste klientrækker.
   * Lederlønnen tages fra team-sammendraget, fordi den beregnes på teamniveau.
   */
  const teamGroups = useMemo(() => {
    const map = new Map<
      string,
      { group: ClientDBTeamGroupSummary; rows: typeof filteredAndSortedData }
    >();

    for (const row of filteredAndSortedData) {
      const key = row.teamId ?? "__no_team__";
      let entry = map.get(key);
      if (!entry) {
        entry = {
          group: {
            key,
            teamId: row.teamId,
            teamName: row.teamName || "Uden team",
            clientCount: 0,
            sales: 0,
            revenue: 0,
            costs: 0,
            finalDB: 0,
            dbPercent: 0,
            leaderCost: 0,
            leaderHasBasis: true,
          },
          rows: [],
        };
        map.set(key, entry);
      }
      entry.rows.push(row);
      entry.group.clientCount += 1;
      entry.group.sales += row.sales;
      entry.group.revenue += row.adjustedRevenue;
      entry.group.costs += rowCosts(row);
      entry.group.finalDB += row.finalDB;
    }

    for (const entry of map.values()) {
      const { group } = entry;
      group.dbPercent = group.revenue > 0 ? (group.finalDB / group.revenue) * 100 : 0;
      const summary = group.teamId ? teamSummaryById[group.teamId] : undefined;
      if (summary) {
        group.leaderCost = summary.leader.totalCost;
        group.leaderHasBasis = summary.leader.hasBasis;
      } else {
        group.leaderCost = 0;
        group.leaderHasBasis = group.teamId === null;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      // Grupper uden team altid sidst, så de ikke forsvinder øverst/nederst
      if (a.group.teamId === null) return 1;
      if (b.group.teamId === null) return -1;
      if (sortColumn === "clientName" || sortColumn === "teamName") {
        return sortDirection === "asc"
          ? a.group.teamName.localeCompare(b.group.teamName)
          : b.group.teamName.localeCompare(a.group.teamName);
      }
      const pick = (g: ClientDBTeamGroupSummary) =>
        sortColumn === "sales"
          ? g.sales
          : sortColumn === "revenue"
            ? g.revenue
            : sortColumn === "costs"
              ? g.costs
              : sortColumn === "dbPercent"
                ? g.dbPercent
                : g.finalDB;
      return sortDirection === "asc"
        ? pick(a.group) - pick(b.group)
        : pick(b.group) - pick(a.group);
    });
  }, [filteredAndSortedData, teamSummaryById, sortColumn, sortDirection]);

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isLoading = dbLoading || overhead.isLoading;
  const hiddenCount = clientRows.length - filteredAndSortedData.length;

  const getTrendInfo = (current: number, previous: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      change,
      isPositive: change >= 0,
      label: `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`,
      previousValue: previous,
    };
  };

  const netEarnings = totals.finalDB - overhead.total;

  return (
    <div className="space-y-4">
      <ClientDBKPIs
        totalRevenue={totals.revenue}
        totalDB={totals.finalDB}
        dbPercent={totals.dbPercent}
        netEarnings={netEarnings}
        isLoading={isLoading}
      />

      <DbDataQualityPanel clientActivity={clientActivity} />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">DB per klient</CardTitle>
            {isCapped && <Badge variant="outline">Skåret ved i dag</Badge>}
            {settingsFallback && (
              <Badge variant="destructive">Standardsatser i brug</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch id="hide-zero" checked={hideZeroClients} onCheckedChange={setHideZeroClients} />
            <Label
              htmlFor="hide-zero"
              className="text-sm text-muted-foreground flex items-center gap-1.5"
            >
              {hideZeroClients ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Skjul inaktive
              {hiddenCount > 0 && <span className="text-xs">({hiddenCount})</span>}
            </Label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DBPeriodSelector
            periodStart={periodStart}
            periodEnd={periodEnd}
            onChange={handlePeriodChange}
            mode={periodMode}
            onModeChange={setPeriodMode}
            selectedPresetLabel={selectedPresetLabel}
            onPresetLabelChange={setSelectedPresetLabel}
          />

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Indlæser...</div>
          ) : filteredAndSortedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {hideZeroClients && clientRows.length > 0
                ? "Alle klienter er skjult (ingen aktivitet)"
                : "Ingen data for denne periode"}
            </div>
          ) : isMobile ? (
            <div className="space-y-2">
              {filteredAndSortedData.map((client) => (
                <div
                  key={client.clientId}
                  className="border rounded-lg p-3 space-y-2"
                  onClick={() =>
                    setSelectedClientForDaily({ id: client.clientId, name: client.clientName })
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate flex-1 mr-2">
                      {client.clientName}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums whitespace-nowrap",
                        client.finalDB >= 0 ? "text-primary" : "text-destructive"
                      )}
                    >
                      {formatCurrency(client.finalDB)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{client.teamName || "–"}</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        client.dbPercent >= 20
                          ? "text-primary"
                          : client.dbPercent >= 0
                            ? "text-muted-foreground"
                            : "text-destructive"
                      )}
                    >
                      {client.dbPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{client.sales} salg</span>
                    <span>Oms. {formatCurrency(client.adjustedRevenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead
                      className="min-w-[140px] cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("clientName")}
                    >
                      <div className="flex items-center gap-1">
                        Klient
                        <SortIcon column="clientName" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="min-w-[100px] cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("teamName")}
                    >
                      <div className="flex items-center gap-1">
                        Team
                        <SortIcon column="teamName" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[70px] text-right cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("sales")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        Salg
                        <SortIcon column="sales" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[120px] text-right cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("revenue")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        Omsætning
                        <SortIcon column="revenue" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[120px] text-right cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("costs")}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 ml-auto">
                            Omkostninger
                            <SortIcon column="costs" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Sælger + sygefravær + lokation + teamudgifter + assist. + leder + ATP
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead
                      className="w-[110px] text-right cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("finalDB")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        Final DB
                        <SortIcon column="finalDB" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[140px] text-right cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("dbPercent")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        DB%
                        <SortIcon column="dbPercent" />
                      </div>
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.map((client) => {
                    const prevData = previousPeriodData?.[client.clientId];
                    const trend = prevData
                      ? getTrendInfo(client.adjustedRevenue, prevData.previousRevenue)
                      : null;

                    return (
                      <ClientDBExpandableRow
                        key={client.clientId}
                        client={client}
                        trend={trend}
                        previousPeriodLabel={previousPeriodLabel}
                        onEditCancellation={handleEditCancellationClick}
                        onEditSickPay={handleEditSickPayClick}
                        onShowDaily={setSelectedClientForDaily}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <ClientDBSummaryCard
            teamDB={totals.finalDB}
            stabExpenses={overhead.stabExpenses}
            staffSalaries={overhead.staffSalaries}
            netEarnings={netEarnings}
            staffSalaryList={overhead.staffList}
            fullStabExpenses={isCapped ? overheadFullPeriod.stabExpenses : undefined}
            fullStaffSalaries={isCapped ? overheadFullPeriod.staffSalaries : undefined}
            staffMissingBasisCount={overhead.staffMissingBasisCount}
          />
        </CardContent>
      </Card>

      {/* Inline redigering af justeringsprocenter */}
      {editingClientId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setEditingClientId(null)}
        >
          <Card className="p-4 w-80" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">
              {editingType === "cancellation"
                ? "Rediger annulleringsprocent"
                : "Rediger sygefraværsprocent"}
            </h3>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, editingClientId)}
                className="flex-1"
                min={0}
                max={100}
                step={0.1}
                autoFocus
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditingClientId(null)}
                className="flex-1 px-3 py-2 text-sm border rounded-md hover:bg-muted"
              >
                Annuller
              </button>
              <button
                onClick={() => handleSaveAdjustmentPercent(editingClientId)}
                className="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Gem
              </button>
            </div>
          </Card>
        </div>
      )}

      <ClientDBDailyChart
        byDate={dailyAggregates?.byDate || {}}
        nettoTotal={chartTotals.nettoTotal}
        teamDB={chartTotals.teamDB}
        totalRevenue={chartTotals.totalRevenue}
        totalOverhead={chartTotals.totalOverhead}
        isLoading={chartDb.isLoading || chartOverhead.isLoading || dailyAggregatesLoading}
      />

      {selectedClientForDaily && (
        <ClientDBDailyBreakdown
          clientId={selectedClientForDaily.id}
          clientName={selectedClientForDaily.name}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onClose={() => setSelectedClientForDaily(null)}
        />
      )}
    </div>
  );
}
