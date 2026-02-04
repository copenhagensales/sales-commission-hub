import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, HelpCircle } from "lucide-react";
import { startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { DBPeriodSelector } from "./DBPeriodSelector";
import { cn } from "@/lib/utils";

type PeriodMode = "payroll" | "month" | "week" | "day" | "custom";

interface ClientDBData {
  clientId: string;
  clientName: string;
  teamId: string | null;
  teamName: string | null;
  sales: number;
  revenue: number;
  commission: number;
  sellerVacationPay: number; // 12.5% of commission
  sellerSalaryCost: number; // commission + vacation pay
  locationCosts: number; // From bookings (FM clients)
  cancellationPercent: number;
  adjustedRevenue: number;
  adjustedSellerCost: number;
  basisDB: number;
  assistantAllocation: number;
  dbBeforeLeader: number;
  leaderAllocation: number;
  leaderVacationPay: number; // 1% of leader allocation
  finalDB: number;
}

interface TeamSalaryInfo {
  teamId: string;
  percentageRate: number;
  minimumSalary: number;
  assistantSalary: number;
}

const SELLER_VACATION_RATE = 0.125; // 12.5%
const LEADER_VACATION_RATE = 0.01; // 1%
const FM_CLIENT_NAMES = ["Eesy FM", "Yousee"];

export function ClientDBTab() {
  const [periodStart, setPeriodStart] = useState(() => startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState(() => endOfMonth(new Date()));
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");

  const handlePeriodChange = (start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // Fetch clients with team mapping
  const { data: clientsWithTeams } = useQuery({
    queryKey: ["clients-with-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, team_clients(team_id, teams(id, name))");
      if (error) throw error;
      return data;
    },
  });

  // Fetch adjustment percents per client
  const { data: adjustmentPercents } = useQuery({
    queryKey: ["client-adjustment-percents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_adjustment_percents")
        .select("client_id, cancellation_percent, deduction_percent");
      if (error) throw error;
      return data;
    },
  });

  // Fetch bookings for location costs (FM clients)
  const { data: bookings } = useQuery({
    queryKey: ["bookings-for-costs", periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select("id, client_id, start_date, end_date, booked_days, daily_rate_override, location:location_id(daily_rate)")
        .or("client_id.not.is.null");
      if (error) throw error;
      return data;
    },
  });

  // Fetch team salary info (leaders and assistants)
  const { data: teamSalaries } = useQuery({
    queryKey: ["team-salaries-for-client-db"],
    queryFn: async () => {
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, team_leader_id, assistant_team_leader_id");

      const leaderIds = teams?.map(t => t.team_leader_id).filter(Boolean) || [];
      const assistantIds = teams?.map(t => t.assistant_team_leader_id).filter(Boolean) || [];

      const { data: leaderSalaries } = await supabase
        .from("personnel_salaries")
        .select("employee_id, percentage_rate, minimum_salary")
        .eq("salary_type", "team_leader")
        .eq("is_active", true)
        .in("employee_id", leaderIds.length > 0 ? leaderIds : ["none"]);

      const { data: assistantSalaries } = await supabase
        .from("personnel_salaries")
        .select("employee_id, monthly_salary")
        .eq("salary_type", "assistant")
        .eq("is_active", true)
        .in("employee_id", assistantIds.length > 0 ? assistantIds : ["none"]);

      const result: Record<string, TeamSalaryInfo> = {};
      for (const team of teams || []) {
        const leader = leaderSalaries?.find(l => l.employee_id === team.team_leader_id);
        const assistant = assistantSalaries?.find(a => a.employee_id === team.assistant_team_leader_id);
        
        result[team.id] = {
          teamId: team.id,
          percentageRate: Number(leader?.percentage_rate) || 0,
          minimumSalary: Number(leader?.minimum_salary) || 0,
          assistantSalary: Number(assistant?.monthly_salary) || 0,
        };
      }
      return result;
    },
  });

  // Fetch sales aggregates per client
  const clientIds = clientsWithTeams?.map(c => c.id) || [];
  
  // We need to fetch aggregates for each client
  const { data: allAggregates, isLoading: aggregatesLoading } = useSalesAggregatesExtended({
    periodStart,
    periodEnd,
    groupBy: ['employee'],
    enabled: true,
  });

  // Fetch sales by client directly
  const { data: salesByClient, isLoading: salesLoading } = useQuery({
    queryKey: ["sales-by-client", periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          client_campaign_id,
          client_campaigns!inner(client_id),
          sale_items(quantity, mapped_commission, mapped_revenue, products(counts_as_sale))
        `)
        .gte("sale_datetime", periodStart.toISOString())
        .lte("sale_datetime", periodEnd.toISOString());
      
      if (error) throw error;

      // Group by client
      const byClient: Record<string, { sales: number; commission: number; revenue: number }> = {};
      
      for (const sale of data || []) {
        const clientId = (sale.client_campaigns as any)?.client_id;
        if (!clientId) continue;

        if (!byClient[clientId]) {
          byClient[clientId] = { sales: 0, commission: 0, revenue: 0 };
        }

        for (const item of sale.sale_items || []) {
          const countsAsSale = (item.products as any)?.counts_as_sale !== false;
          const qty = Number(item.quantity) || 1;
          if (countsAsSale) byClient[clientId].sales += qty;
          byClient[clientId].commission += Number(item.mapped_commission) || 0;
          byClient[clientId].revenue += Number(item.mapped_revenue) || 0;
        }
      }

      return byClient;
    },
    enabled: clientsWithTeams !== undefined,
  });

  // Calculate client DB data
  const clientDBData = useMemo((): ClientDBData[] => {
    if (!clientsWithTeams || !salesByClient || !teamSalaries) return [];

    const adjustmentMap = new Map(adjustmentPercents?.map(a => [a.client_id, a]) || []);

    // Calculate location costs per client from bookings
    const locationCostsMap = new Map<string, number>();
    for (const booking of bookings || []) {
      if (!booking.client_id) continue;
      
      // Check if booking overlaps with period
      const bookingStart = parseISO(booking.start_date);
      const bookingEnd = parseISO(booking.end_date);
      
      const overlapsStart = bookingStart <= periodEnd;
      const overlapsEnd = bookingEnd >= periodStart;
      
      if (overlapsStart && overlapsEnd) {
        const dailyRate = booking.daily_rate_override || (booking.location as any)?.daily_rate || 0;
        const bookedDays = (booking.booked_days as number[])?.length || 7;
        const cost = dailyRate * bookedDays;
        
        locationCostsMap.set(
          booking.client_id, 
          (locationCostsMap.get(booking.client_id) || 0) + cost
        );
      }
    }

    // Build client data
    const clientDataList: ClientDBData[] = [];
    
    // Group clients by team for allocation calculations
    const clientsByTeam: Record<string, ClientDBData[]> = {};

    for (const client of clientsWithTeams) {
      const teamClientData = (client.team_clients as any[])?.[0];
      const teamId = teamClientData?.team_id || null;
      const teamName = teamClientData?.teams?.name || null;
      
      const salesData = salesByClient[client.id] || { sales: 0, commission: 0, revenue: 0 };
      const adjustment = adjustmentMap.get(client.id);
      const cancellationPercent = Number(adjustment?.cancellation_percent) || 0;
      
      // Only include location costs for FM clients
      const isFMClient = FM_CLIENT_NAMES.includes(client.name);
      const locationCosts = isFMClient ? (locationCostsMap.get(client.id) || 0) : 0;

      // Calculate seller salary cost
      const commission = salesData.commission;
      const sellerVacationPay = commission * SELLER_VACATION_RATE;
      const sellerSalaryCost = commission + sellerVacationPay;

      // Apply cancellation adjustment
      const cancellationFactor = 1 - (cancellationPercent / 100);
      const adjustedRevenue = salesData.revenue * cancellationFactor;
      const adjustedSellerCost = sellerSalaryCost * cancellationFactor;

      // Basis DB (before team allocations)
      const basisDB = adjustedRevenue - adjustedSellerCost - locationCosts;

      const clientData: ClientDBData = {
        clientId: client.id,
        clientName: client.name,
        teamId,
        teamName,
        sales: salesData.sales,
        revenue: salesData.revenue,
        commission,
        sellerVacationPay,
        sellerSalaryCost,
        locationCosts,
        cancellationPercent,
        adjustedRevenue,
        adjustedSellerCost,
        basisDB,
        assistantAllocation: 0, // Calculated later
        dbBeforeLeader: 0, // Calculated later
        leaderAllocation: 0, // Calculated later
        leaderVacationPay: 0, // Calculated later
        finalDB: basisDB, // Updated later
      };

      clientDataList.push(clientData);

      // Group by team for allocation
      if (teamId) {
        if (!clientsByTeam[teamId]) clientsByTeam[teamId] = [];
        clientsByTeam[teamId].push(clientData);
      }
    }

    // Calculate team allocations
    for (const [teamId, teamClients] of Object.entries(clientsByTeam)) {
      const teamInfo = teamSalaries[teamId];
      if (!teamInfo) continue;

      // Total team adjusted revenue for proportional allocation
      const teamTotalRevenue = teamClients.reduce((sum, c) => sum + c.adjustedRevenue, 0);
      if (teamTotalRevenue === 0) continue;

      // Allocate assistant salary proportionally by revenue
      for (const client of teamClients) {
        const revenueShare = client.adjustedRevenue / teamTotalRevenue;
        client.assistantAllocation = teamInfo.assistantSalary * revenueShare;
        client.dbBeforeLeader = client.basisDB - client.assistantAllocation;
      }

      // Calculate team-level leader salary
      const teamTotalDBBeforeLeader = teamClients.reduce((sum, c) => sum + c.dbBeforeLeader, 0);
      const calculatedLeaderSalary = teamTotalDBBeforeLeader * (teamInfo.percentageRate / 100);
      const finalTeamLeaderSalary = Math.max(calculatedLeaderSalary, teamInfo.minimumSalary);

      // Allocate leader salary proportionally by DB before leader
      const teamDBForAllocation = Math.max(teamTotalDBBeforeLeader, 1); // Avoid division by zero
      for (const client of teamClients) {
        const dbShare = Math.max(client.dbBeforeLeader, 0) / teamDBForAllocation;
        client.leaderAllocation = finalTeamLeaderSalary * dbShare;
        client.leaderVacationPay = client.leaderAllocation * LEADER_VACATION_RATE;
        client.finalDB = client.dbBeforeLeader - client.leaderAllocation - client.leaderVacationPay;
      }
    }

    // Clients without team: finalDB = basisDB
    for (const client of clientDataList) {
      if (!client.teamId) {
        client.finalDB = client.basisDB;
      }
    }

    return clientDataList.sort((a, b) => b.finalDB - a.finalDB);
  }, [clientsWithTeams, salesByClient, adjustmentPercents, bookings, teamSalaries, periodStart, periodEnd]);

  const isLoading = salesLoading || aggregatesLoading;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("da-DK", { 
      style: "currency", 
      currency: "DKK", 
      maximumFractionDigits: 0 
    }).format(amount);

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const totals = useMemo(() => {
    return clientDBData.reduce(
      (acc, c) => ({
        sales: acc.sales + c.sales,
        revenue: acc.revenue + c.revenue,
        sellerSalaryCost: acc.sellerSalaryCost + c.adjustedSellerCost,
        locationCosts: acc.locationCosts + c.locationCosts,
        assistantAllocation: acc.assistantAllocation + c.assistantAllocation,
        leaderAllocation: acc.leaderAllocation + c.leaderAllocation + c.leaderVacationPay,
        finalDB: acc.finalDB + c.finalDB,
      }),
      { sales: 0, revenue: 0, sellerSalaryCost: 0, locationCosts: 0, assistantAllocation: 0, leaderAllocation: 0, finalDB: 0 }
    );
  }, [clientDBData]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>DB per Klient</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    <strong>Sælgerløn</strong> = provision + 12,5% feriepenge<br/>
                    <strong>Lederløn</strong> = proportionel andel + 1% feriepenge<br/>
                    <strong>Assist.løn</strong> = fordelt efter omsætningsandel
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DBPeriodSelector
            periodStart={periodStart}
            periodEnd={periodEnd}
            onChange={handlePeriodChange}
            mode={periodMode}
            onModeChange={setPeriodMode}
          />

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klient</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Salg</TableHead>
                  <TableHead className="text-right">Omsætning</TableHead>
                  <TableHead className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Sælgerløn*
                        </TooltipTrigger>
                        <TooltipContent>Provision + 12,5% feriepenge (efter annullering)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-right">Centre/Boder</TableHead>
                  <TableHead className="text-right">Assist.løn</TableHead>
                  <TableHead className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Lederløn**
                        </TooltipTrigger>
                        <TooltipContent>Proportionel andel + 1% feriepenge</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-right">Annul. %</TableHead>
                  <TableHead className="text-right">Final DB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : clientDBData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Ingen data for denne periode
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {clientDBData.map((client) => (
                      <TableRow key={client.clientId}>
                        <TableCell className="font-medium">{client.clientName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {client.teamName || "Ikke tildelt"}
                        </TableCell>
                        <TableCell className="text-right">{client.sales}</TableCell>
                        <TableCell className="text-right">{formatCurrency(client.adjustedRevenue)}</TableCell>
                        <TableCell className="text-right text-destructive">
                          -{formatCurrency(client.adjustedSellerCost)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {client.locationCosts > 0 ? `-${formatCurrency(client.locationCosts)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {client.assistantAllocation > 0 ? `-${formatCurrency(client.assistantAllocation)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {client.leaderAllocation > 0 
                            ? `-${formatCurrency(client.leaderAllocation + client.leaderVacationPay)}` 
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {client.cancellationPercent > 0 ? formatPercent(client.cancellationPercent) : "-"}
                        </TableCell>
                        <TableCell 
                          className={cn(
                            "text-right font-medium",
                            client.finalDB >= 0 ? "text-primary" : "text-destructive"
                          )}
                        >
                          {formatCurrency(client.finalDB)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{totals.sales}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">
                        -{formatCurrency(totals.sellerSalaryCost)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {totals.locationCosts > 0 ? `-${formatCurrency(totals.locationCosts)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -{formatCurrency(totals.assistantAllocation)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -{formatCurrency(totals.leaderAllocation)}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell 
                        className={cn(
                          "text-right font-medium",
                          totals.finalDB >= 0 ? "text-primary" : "text-destructive"
                        )}
                      >
                        {formatCurrency(totals.finalDB)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          
          <p className="text-xs text-muted-foreground">
            *Sælgerløn = provision + 12,5% feriepenge | **Lederløn = proportionel andel + 1% feriepenge
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
