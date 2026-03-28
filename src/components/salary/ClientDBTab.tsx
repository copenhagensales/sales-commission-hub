import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { formatCurrency, STANDARD_MONTH_DAYS } from "@/lib/calculations";
import { countWorkDaysInPeriod } from "@/lib/calculations/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrendingUp, HelpCircle, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { VACATION_PAY_RATES } from "@/lib/calculations";
import { startOfMonth, endOfMonth, parseISO, isSameDay, isSameWeek, eachDayOfInterval } from "date-fns";

/**
 * Convert JavaScript getDay (0=Sunday) to booked_days format (0=Monday, 6=Sunday)
 */
function getBookedDayIndex(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}
import { DBPeriodSelector } from "./DBPeriodSelector";
import { ClientDBDailyBreakdown } from "./ClientDBDailyBreakdown";
import { ClientDBKPIs } from "./ClientDBKPIs";
import { ClientDBExpandableRow } from "./ClientDBExpandableRow";
import { ClientDBSummaryCard } from "./ClientDBSummaryCard";
import { ClientDBDailyChart } from "./ClientDBDailyChart";
import { useAssistantHoursCalculation } from "@/hooks/useAssistantHoursCalculation";
import { useTeamAssistantLeaders, getTeamAssistantIds, getAllAssistantIds } from "@/hooks/useTeamAssistantLeaders";
import { useStaffHoursCalculation } from "@/hooks/useStaffHoursCalculation";
import { useClientPeriodComparison } from "@/hooks/useClientPeriodComparison";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import type { KpiPeriod } from "@/hooks/usePrecomputedKpi";

type SortColumn = "clientName" | "teamName" | "sales" | "revenue" | "costs" | "finalDB" | "dbPercent" | "revenuePerFTE";
type SortDirection = "asc" | "desc";

type PeriodMode = "payroll" | "month" | "week" | "day" | "custom";

// Map UI period mode to KPI cache period_type
function mapPeriodModeToKpiPeriod(mode: PeriodMode, periodStart: Date): KpiPeriod | null {
  const now = new Date();
  switch (mode) {
    case "day":
      return isSameDay(periodStart, now) ? "today" : null;
    case "week":
      return isSameWeek(periodStart, now, { weekStartsOn: 1 }) ? "this_week" : null;
    case "month":
      return periodStart.getMonth() === now.getMonth() && 
             periodStart.getFullYear() === now.getFullYear() ? "this_month" : null;
    case "payroll":
      return "payroll_period";
    default:
      return null;
  }
}

interface ClientDBData {
  clientId: string;
  clientName: string;
  teamId: string | null;
  teamName: string | null;
  sales: number;
  revenue: number;
  commission: number;
  sellerVacationPay: number;
  sellerSalaryCost: number;
  locationCosts: number;
  fullMonthLocationCosts: number;
  cancellationPercent: number;
  sickPayPercent: number;
  adjustedRevenue: number;
  adjustedSellerCost: number;
  basisDB: number;
  assistantAllocation: number;
  dbBeforeLeader: number;
  leaderAllocation: number;
  leaderVacationPay: number;
  atpBarsselAllocation: number;
  finalDB: number;
  dbPercent: number;
  fteCount: number;
  revenuePerFTE: number;
  // Calculated deduction amounts
  sickPayAmount: number;
  cancellationRevenueDeduction: number;
  // Full-month expected values (for parenthesis display when period is capped)
  fullMonthAssistantAllocation: number;
  fullMonthLeaderAllocation: number;
  fullMonthLeaderVacationPay: number;
  fullMonthAtpBarsselAllocation: number;
}

interface TeamSalaryInfo {
  teamId: string;
  percentageRate: number;
  minimumSalary: number;
}

const FM_CLIENT_NAMES = ["Eesy FM", "Yousee"];

export function ClientDBTab() {
  const [periodStart, setPeriodStart] = useState(() => startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState(() => endOfMonth(new Date()));
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | undefined>("Denne måned");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"cancellation" | "sickPay">("cancellation");
  const [editValue, setEditValue] = useState<string>("");
  const [selectedClientForDaily, setSelectedClientForDaily] = useState<{ id: string; name: string } | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("finalDB");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hideZeroClients, setHideZeroClients] = useState(true);
  const queryClient = useQueryClient();

  // Stable "today" reference to prevent infinite query loops (new Date() changes every render)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  // Cap period at today for month/payroll modes so costs match revenue timeline
  const isCapped = (periodMode === "month" || periodMode === "payroll") && today < periodEnd;
  const effectivePeriodEnd = isCapped ? today : periodEnd;
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3" /> 
      : <ArrowDown className="h-3 w-3" />;
  };

  const handlePeriodChange = (start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
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
    const successMessage = editingType === "cancellation" ? "Annulleringsprocent opdateret" : "Sygefraværsprocent opdateret";
    const errorMessage = editingType === "cancellation" ? "Kunne ikke opdatere annulleringsprocent" : "Kunne ikke opdatere sygefraværsprocent";

    try {
      const { data: existing } = await supabase
        .from("client_adjustment_percents")
        .select("id")
        .eq("client_id", clientId)
        .single();

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
    if (e.key === "Enter") {
      handleSaveAdjustmentPercent(clientId);
    } else if (e.key === "Escape") {
      setEditingClientId(null);
    }
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
        .select("client_id, cancellation_percent, deduction_percent, sick_pay_percent");
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

  // Fetch Stab team expenses
  const STAB_TEAM_ID = "09012ce9-e307-4f6d-a51e-f72af7200d74";
  const { data: stabExpenses } = useQuery({
    queryKey: ["stab-expenses", periodStart.toISOString(), periodEnd.toISOString(), periodMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_expenses")
        .select("amount, expense_date, all_days, is_recurring")
        .eq("team_id", STAB_TEAM_ID);
      
      if (error) throw error;
      
      const isFullPeriod = periodMode === "month" || periodMode === "payroll";
      let totalStabExpenses = 0;
      const WORKDAYS_PER_MONTH = 22;
      const workdaysInPeriod = countWorkDaysInPeriod(periodStart, periodEnd);
      
      for (const expense of data || []) {
        if (expense.is_recurring || expense.all_days) {
          const monthlyAmount = Number(expense.amount) || 0;
          if (isFullPeriod) {
            totalStabExpenses += monthlyAmount;
          } else {
            totalStabExpenses += (monthlyAmount / WORKDAYS_PER_MONTH) * workdaysInPeriod;
          }
        } else {
          const expenseDate = new Date(expense.expense_date);
          if (expenseDate >= periodStart && expenseDate <= periodEnd) {
            totalStabExpenses += Number(expense.amount) || 0;
          }
        }
      }
      
      return totalStabExpenses;
    },
  });

  // Fetch staff employee IDs for hours calculation
  const { data: staffEmployees } = useQuery({
    queryKey: ["staff-employees-for-client-db"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_salaries")
        .select(`
          employee_id,
          employee:employee_master_data(first_name, last_name, job_title)
        `)
        .eq("salary_type", "staff")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const staffEmployeeIds = useMemo(() => 
    (staffEmployees || []).map(s => s.employee_id), 
    [staffEmployees]
  );

  // Calculate staff salaries based on hours
  const { data: staffHoursData, isLoading: staffHoursLoading } = useStaffHoursCalculation(
    periodStart,
    periodEnd,
    staffEmployeeIds
  );

  // Staff salary list with names for display
  const staffSalaryList = useMemo(() => {
    if (!staffHoursData || !staffEmployees) return [];
    
    return staffEmployees
      .map(staff => {
        const hours = staffHoursData[staff.employee_id];
        if (!hours) return null;
        
        const employee = staff.employee as { first_name: string; last_name: string; job_title: string | null } | null;
        return {
          employeeId: staff.employee_id,
          name: employee ? `${employee.first_name} ${employee.last_name}` : "Ukendt",
          jobTitle: employee?.job_title || null,
          hourlyRate: hours.hourlyRate,
          workedHours: hours.workedHours,
          baseSalary: hours.baseSalary,
          vacationPay: hours.vacationPay,
          totalSalary: hours.totalSalary,
          isHourlyBased: hours.isHourlyBased,
          hoursSource: hours.hoursSource,
        };
      })
      .filter(Boolean) as {
        employeeId: string;
        name: string;
        jobTitle: string | null;
        workedHours: number;
        totalSalary: number;
        isHourlyBased: boolean;
      }[];
  }, [staffHoursData, staffEmployees]);

  // Total staff salary cost
  const totalStaffSalaryCost = useMemo(() => {
    if (!staffHoursData) return 0;
    return Object.values(staffHoursData).reduce((sum, s) => sum + s.totalSalary, 0);
  }, [staffHoursData]);

  // Fixed 31-day window for NETTO chart (independent of selected period)
  const FIXED_MONTHLY_OVERHEAD = 988876; // Stab 932.000 + Stabsløn 56.876
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

  

  // Fetch team assistant leaders from junction table
  const { data: teamAssistants = [] } = useTeamAssistantLeaders();

  // Fetch ATP + Barsel rate
  const { data: atpBarsselRate } = useQuery({
    queryKey: ["atp-barsel-rate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_types")
        .select("amount")
        .ilike("name", "%ATP%Barsel%")
        .eq("is_active", true)
        .single();
      if (error) console.warn("ATP + Barsel rate not found, using default 381");
      return Number(data?.amount) || 381;
    },
  });

  // Fetch team member counts
  const { data: teamMemberCounts } = useQuery({
    queryKey: ["team-member-counts"],
    queryFn: async () => {
      const { data: teams } = await supabase
        .from("teams")
        .select("id, team_leader_id");

      const { data: members } = await supabase
        .from("team_members")
        .select("team_id");

      const { data: assistants } = await supabase
        .from("team_assistant_leaders")
        .select("team_id");

      const counts: Record<string, number> = {};
      for (const team of teams || []) {
        const sellerCount = (members || []).filter(m => m.team_id === team.id).length;
        const assistantCount = (assistants || []).filter(a => a.team_id === team.id).length;
        const hasLeader = !!team.team_leader_id;
        counts[team.id] = sellerCount + assistantCount + (hasLeader ? 1 : 0);
      }
      return counts;
    },
  });

  // Fetch team salary info
  const { data: teamSalaries } = useQuery({
    queryKey: ["team-salaries-for-client-db"],
    queryFn: async () => {
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, team_leader_id");

      const leaderIds = teams?.map(t => t.team_leader_id).filter(Boolean) || [];

      const { data: leaderSalaries } = await supabase
        .from("personnel_salaries")
        .select("employee_id, percentage_rate, minimum_salary")
        .eq("salary_type", "team_leader")
        .eq("is_active", true)
        .in("employee_id", leaderIds.length > 0 ? leaderIds : ["none"]);

      const result: Record<string, TeamSalaryInfo> = {};
      for (const team of teams || []) {
        const leader = leaderSalaries?.find(l => l.employee_id === team.team_leader_id);
        result[team.id] = {
          teamId: team.id,
          percentageRate: Number(leader?.percentage_rate) || 0,
          minimumSalary: Number(leader?.minimum_salary) || 0,
        };
      }
      return result;
    },
  });

  // Get all assistant IDs for hours calculation
  const allAssistantIds = useMemo(() => {
    return getAllAssistantIds(teamAssistants);
  }, [teamAssistants]);

  // Calculate assistant salaries based on hours (capped at today for current periods)
  const { data: assistantHoursData, isLoading: assistantHoursLoading } = useAssistantHoursCalculation(
    periodStart,
    effectivePeriodEnd,
    allAssistantIds
  );

  // Full-month assistant salary calculation (for parenthesis display)
  const { data: fullMonthAssistantHoursData } = useAssistantHoursCalculation(
    periodStart,
    periodEnd,
    isCapped ? allAssistantIds : [] // Only fetch when capping is active
  );

  // Fetch sales by client for the 31-day chart window (full DB calculation)
  const { data: chartSalesByClient } = useQuery({
    queryKey: ["chart-sales-by-client", chartPeriodStart.toISOString(), chartPeriodEnd.toISOString()],
    queryFn: async () => {
      // Fetch all sales (TM + FM) - FM sales have sale_items created by DB trigger
      const salesData = await fetchAllRows<any>(
        "sales",
        `id, client_campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, mapped_revenue, products(counts_as_sale))`,
        (q) => q.gte("sale_datetime", chartPeriodStart.toISOString())
                .lte("sale_datetime", chartPeriodEnd.toISOString()),
        { orderBy: "sale_datetime", ascending: false }
      );
      
      const byClient: Record<string, { sales: number; commission: number; revenue: number }> = {};
      for (const sale of salesData || []) {
        const clientId = (sale.client_campaigns as any)?.client_id;
        if (!clientId) continue;
        if (!byClient[clientId]) byClient[clientId] = { sales: 0, commission: 0, revenue: 0 };
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
    enabled: !!clientsWithTeams,
    staleTime: 60000,
  });

  // Calculate chart header totals using full DB-per-klient logic on 31-day data
  const chartTotals = useMemo(() => {
    if (!chartSalesByClient || !clientsWithTeams || !teamSalaries) {
      // Fallback: use simple calculation from dailyAggregates while full calculation loads
      const byDate = dailyAggregates?.byDate;
      if (!byDate || Object.keys(byDate).length === 0) {
        return { nettoTotal: 0, teamDB: 0, totalRevenue: 0, isLoading: true };
      }
      let totalRevenue = 0;
      let totalCommission = 0;
      for (const day of Object.values(byDate)) {
        totalRevenue += day.revenue;
        totalCommission += day.commission;
      }
      const teamDB = totalRevenue - totalCommission * 1.125;
      return {
        totalRevenue: Math.round(totalRevenue),
        teamDB: Math.round(teamDB),
        nettoTotal: Math.round(teamDB - FIXED_MONTHLY_OVERHEAD),
        isLoading: true,
      };
    }
    const adjustmentMap = new Map(adjustmentPercents?.map(a => [a.client_id, a]) || []);
    const atpRate = atpBarsselRate || 381;
    const chartDaysArray = eachDayOfInterval({ start: chartPeriodStart, end: chartPeriodEnd });
    const chartLocationCostsMap = new Map<string, number>();
    for (const booking of bookings || []) {
      if (!booking.client_id) continue;
      const bookingStart = parseISO(booking.start_date);
      const bookingEnd = parseISO(booking.end_date);
      const bookedDays = (booking.booked_days as number[]) || [];
      const dailyRate = booking.daily_rate_override || (booking.location as any)?.daily_rate || 0;
      for (const day of chartDaysArray) {
        const dayIndex = getBookedDayIndex(day);
        if (day >= bookingStart && day <= bookingEnd && bookedDays.includes(dayIndex)) {
          chartLocationCostsMap.set(booking.client_id, (chartLocationCostsMap.get(booking.client_id) || 0) + dailyRate);
        }
      }
    }
    interface ChartClientData {
      clientId: string; teamId: string | null; adjustedRevenue: number; basisDB: number;
      assistantAllocation: number; atpBarsselAllocation: number; dbBeforeLeader: number;
      leaderAllocation: number; leaderVacationPay: number; finalDB: number;
    }
    const chartClientsByTeam: Record<string, ChartClientData[]> = {};
    const allChartClients: ChartClientData[] = [];
    for (const client of clientsWithTeams) {
      const salesData = chartSalesByClient[client.id];
      if (!salesData || (salesData.sales === 0 && salesData.revenue === 0)) continue;
      const teamClientData = (client.team_clients as any[])?.[0];
      const teamId = teamClientData?.team_id || null;
      const adjustment = adjustmentMap.get(client.id);
      const cancellationPercent = Number(adjustment?.cancellation_percent) || 0;
      const sickPayPercent = Number(adjustment?.sick_pay_percent) || 0;
      const isFMClient = FM_CLIENT_NAMES.includes(client.name);
      const locationCosts = isFMClient ? (chartLocationCostsMap.get(client.id) || 0) : 0;
      const commission = salesData.commission;
      const sellerVacationPay = commission * VACATION_PAY_RATES.SELLER;
      const sellerSalaryCost = commission + sellerVacationPay;
      const cancellationFactor = 1 - (cancellationPercent / 100);
      const adjustedRevenue = salesData.revenue * cancellationFactor;
      const adjustedSellerCost = sellerSalaryCost * cancellationFactor;
      const sickPayAmount = sellerSalaryCost * (sickPayPercent / 100);
      const basisDB = adjustedRevenue - adjustedSellerCost - sickPayAmount - locationCosts;
      const cd: ChartClientData = {
        clientId: client.id, teamId, adjustedRevenue, basisDB,
        assistantAllocation: 0, atpBarsselAllocation: 0, dbBeforeLeader: 0,
        leaderAllocation: 0, leaderVacationPay: 0, finalDB: basisDB,
      };
      allChartClients.push(cd);
      if (teamId) {
        if (!chartClientsByTeam[teamId]) chartClientsByTeam[teamId] = [];
        chartClientsByTeam[teamId].push(cd);
      }
    }
    const WORKDAYS_PER_MONTH = 22;
    const chartWorkdays = countWorkDaysInPeriod(chartPeriodStart, chartPeriodEnd);
    const chartProration = chartWorkdays / WORKDAYS_PER_MONTH;
    for (const [teamId, teamClients] of Object.entries(chartClientsByTeam)) {
      const teamInfo = teamSalaries[teamId];
      if (!teamInfo) continue;
      const teamTotalRevenue = teamClients.reduce((sum, c) => sum + c.adjustedRevenue, 0);
      if (teamTotalRevenue === 0) continue;
      const teamAssistantIds = getTeamAssistantIds(teamAssistants, teamId);
      let totalAssistantSalary = 0;
      for (const aId of teamAssistantIds) {
        totalAssistantSalary += assistantHoursData?.[aId]?.totalSalary || 0;
      }
      const teamMemberCount = teamMemberCounts?.[teamId] || 0;
      const teamAtpBarsselCost = teamMemberCount * atpRate * chartProration;
      for (const client of teamClients) {
        const revenueShare = client.adjustedRevenue / teamTotalRevenue;
        client.assistantAllocation = totalAssistantSalary * revenueShare;
        client.atpBarsselAllocation = teamAtpBarsselCost * revenueShare;
        client.dbBeforeLeader = client.basisDB - client.assistantAllocation - client.atpBarsselAllocation;
      }
      const teamTotalDBBeforeLeader = teamClients.reduce((sum, c) => sum + c.dbBeforeLeader, 0);
      const calculatedLeaderSalary = teamTotalDBBeforeLeader * (teamInfo.percentageRate / 100);
      const proratedMinimumSalary = teamInfo.minimumSalary * chartProration;
      const finalTeamLeaderSalary = Math.max(calculatedLeaderSalary, proratedMinimumSalary);
      const teamDBForAllocation = Math.max(teamTotalDBBeforeLeader, 1);
      for (const client of teamClients) {
        const dbShare = Math.max(client.dbBeforeLeader, 0) / teamDBForAllocation;
        client.leaderAllocation = finalTeamLeaderSalary * dbShare;
        client.leaderVacationPay = client.leaderAllocation * VACATION_PAY_RATES.LEADER;
        client.finalDB = client.dbBeforeLeader - client.leaderAllocation - client.leaderVacationPay;
      }
    }
    for (const c of allChartClients) {
      if (!c.teamId) c.finalDB = c.basisDB;
    }
    const chartTeamDB = allChartClients.reduce((sum, c) => sum + c.finalDB, 0);
    const chartRevenue = allChartClients.reduce((sum, c) => sum + c.adjustedRevenue, 0);
    return {
      totalRevenue: Math.round(chartRevenue),
      teamDB: Math.round(chartTeamDB),
      nettoTotal: Math.round(chartTeamDB - FIXED_MONTHLY_OVERHEAD),
      isLoading: false,
    };
  }, [chartSalesByClient, clientsWithTeams, adjustmentPercents, bookings, teamSalaries, assistantHoursData, teamAssistants, teamMemberCounts, atpBarsselRate, chartPeriodStart, chartPeriodEnd, dailyAggregates]);

  // Fetch previous period comparison data
  const { data: previousPeriodData, previousPeriodLabel } = useClientPeriodComparison(
    periodStart,
    periodEnd,
    periodMode
  );

  // Determine if we should use KPI cache
  const kpiPeriodType = mapPeriodModeToKpiPeriod(periodMode, periodStart);
  const useKpiCache = !!kpiPeriodType;

  // Fetch KPI-cached sales data per client
  const { data: kpiClientData, isLoading: kpiLoading } = useQuery({
    queryKey: ["kpi-client-sales", kpiPeriodType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_cached_values")
        .select("scope_id, kpi_slug, value")
        .eq("scope_type", "client")
        .eq("period_type", kpiPeriodType!)
        .in("kpi_slug", ["sales_count", "total_commission", "total_revenue"]);

      if (error) throw error;

      const byClient: Record<string, { sales: number; commission: number; revenue: number }> = {};
      
      for (const row of data || []) {
        if (!row.scope_id) continue;
        
        if (!byClient[row.scope_id]) {
          byClient[row.scope_id] = { sales: 0, commission: 0, revenue: 0 };
        }

        switch (row.kpi_slug) {
          case "sales_count":
            byClient[row.scope_id].sales = Number(row.value) || 0;
            break;
          case "total_commission":
            byClient[row.scope_id].commission = Number(row.value) || 0;
            break;
          case "total_revenue":
            byClient[row.scope_id].revenue = Number(row.value) || 0;
            break;
        }
      }

      return byClient;
    },
    enabled: useKpiCache,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch sales by client directly (fallback for custom periods)
  const { data: salesByClientDirect, isLoading: directSalesLoading } = useQuery({
    queryKey: ["sales-by-client-direct", periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      // Fetch all sales (TM + FM) - FM sales have sale_items created by DB trigger
      const salesData = await fetchAllRows<any>(
        "sales",
        `id, client_campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, mapped_revenue, products(counts_as_sale))`,
        (q) => q.gte("sale_datetime", periodStart.toISOString())
                .lte("sale_datetime", periodEnd.toISOString()),
        { orderBy: "sale_datetime", ascending: false }
      );

      const byClient: Record<string, { sales: number; commission: number; revenue: number }> = {};
      
      for (const sale of salesData || []) {
        const clientId = (sale.client_campaigns as any)?.client_id;
        if (!clientId) continue;
        if (!byClient[clientId]) byClient[clientId] = { sales: 0, commission: 0, revenue: 0 };
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
    enabled: !useKpiCache && clientsWithTeams !== undefined,
  });

  // Merge data sources
  const salesByClient = useMemo(() => {
    if (useKpiCache && kpiClientData) {
      return kpiClientData;
    }
    return salesByClientDirect || {};
  }, [useKpiCache, kpiClientData, salesByClientDirect]);

  // Calculate client DB data
  const clientDBData = useMemo((): ClientDBData[] => {
    if (!clientsWithTeams || !salesByClient || !teamSalaries) return [];

    const adjustmentMap = new Map(adjustmentPercents?.map(a => [a.client_id, a]) || []);

    // Calculate location costs per client from bookings
    const locationCostsMap = new Map<string, number>();
    const fullMonthLocationCostsMap = new Map<string, number>();
    // Reuse the stable 'today' and component-level 'effectivePeriodEnd' / 'isCapped'
    const periodDaysArray = eachDayOfInterval({ start: periodStart, end: effectivePeriodEnd });

    // Check if period is already a full month
    const monthStart = startOfMonth(periodStart);
    const monthEnd = endOfMonth(periodStart);
    const isFullMonth = isSameDay(periodStart, monthStart) && isSameDay(periodEnd, monthEnd);
    const fullMonthDaysArray = isFullMonth ? periodDaysArray : eachDayOfInterval({ start: monthStart, end: monthEnd });

    for (const booking of bookings || []) {
      if (!booking.client_id) continue;
      
      const bookingStart = parseISO(booking.start_date);
      const bookingEnd = parseISO(booking.end_date);
      const bookedDays = (booking.booked_days as number[]) || [];
      const dailyRate = booking.daily_rate_override || (booking.location as any)?.daily_rate || 0;
      
      // Period-specific costs
      for (const day of periodDaysArray) {
        const dayIndex = getBookedDayIndex(day);
        if (day >= bookingStart && day <= bookingEnd && bookedDays.includes(dayIndex)) {
          locationCostsMap.set(
            booking.client_id,
            (locationCostsMap.get(booking.client_id) || 0) + dailyRate
          );
        }
      }

      // Full month costs (only calculate separately if not already full month)
      if (!isFullMonth) {
        for (const day of fullMonthDaysArray) {
          const dayIndex = getBookedDayIndex(day);
          if (day >= bookingStart && day <= bookingEnd && bookedDays.includes(dayIndex)) {
            fullMonthLocationCostsMap.set(
              booking.client_id,
              (fullMonthLocationCostsMap.get(booking.client_id) || 0) + dailyRate
            );
          }
        }
      }
    }

    const clientDataList: ClientDBData[] = [];
    const clientsByTeam: Record<string, ClientDBData[]> = {};

    for (const client of clientsWithTeams) {
      const teamClientData = (client.team_clients as any[])?.[0];
      const teamId = teamClientData?.team_id || null;
      const teamName = teamClientData?.teams?.name || null;
      
      const salesData = salesByClient[client.id] || { sales: 0, commission: 0, revenue: 0 };
      const adjustment = adjustmentMap.get(client.id);
      const cancellationPercent = Number(adjustment?.cancellation_percent) || 0;
      const sickPayPercent = Number(adjustment?.sick_pay_percent) || 0;
      
      const isFMClient = FM_CLIENT_NAMES.includes(client.name);
      const locationCosts = isFMClient ? (locationCostsMap.get(client.id) || 0) : 0;

      const commission = salesData.commission;
      const sellerVacationPay = commission * VACATION_PAY_RATES.SELLER;
      const sellerSalaryCost = commission + sellerVacationPay;

      // Cancellation reduces revenue and seller cost proportionally
      const cancellationFactor = 1 - (cancellationPercent / 100);
      const adjustedRevenue = salesData.revenue * cancellationFactor;
      const adjustedSellerCost = sellerSalaryCost * cancellationFactor;

      // Sick pay is a fixed expense independent of cancellations
      const sickPayAmount = sellerSalaryCost * (sickPayPercent / 100);
      const cancellationRevenueDeduction = salesData.revenue * (cancellationPercent / 100);

      const basisDB = adjustedRevenue - adjustedSellerCost - sickPayAmount - locationCosts;
      const fteCount = teamId ? (teamMemberCounts?.[teamId] || 0) : 0;

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
        fullMonthLocationCosts: isFMClient ? (isFullMonth ? locationCosts : (fullMonthLocationCostsMap.get(client.id) || 0)) : 0,
        cancellationPercent,
        sickPayPercent,
        adjustedRevenue,
        adjustedSellerCost,
        basisDB,
        assistantAllocation: 0,
        dbBeforeLeader: 0,
        leaderAllocation: 0,
        leaderVacationPay: 0,
        atpBarsselAllocation: 0,
        finalDB: basisDB,
        dbPercent: 0,
        fteCount,
        revenuePerFTE: fteCount > 0 ? adjustedRevenue / fteCount : 0,
        sickPayAmount,
        cancellationRevenueDeduction,
        fullMonthAssistantAllocation: 0,
        fullMonthLeaderAllocation: 0,
        fullMonthLeaderVacationPay: 0,
        fullMonthAtpBarsselAllocation: 0,
      };

      clientDataList.push(clientData);

      if (teamId) {
        if (!clientsByTeam[teamId]) clientsByTeam[teamId] = [];
        clientsByTeam[teamId].push(clientData);
      }
    }

    // Calculate team allocations
    const workdaysInPeriod = countWorkDaysInPeriod(periodStart, effectivePeriodEnd);
    const fullMonthWorkdays = isCapped ? countWorkDaysInPeriod(periodStart, periodEnd) : workdaysInPeriod;
    const WORKDAYS_PER_MONTH = 22;
    const prorationFactor = workdaysInPeriod / WORKDAYS_PER_MONTH;
    const fullMonthProrationFactor = fullMonthWorkdays / WORKDAYS_PER_MONTH;
    const atpRate = atpBarsselRate || 381;

    for (const [teamId, teamClients] of Object.entries(clientsByTeam)) {
      const teamInfo = teamSalaries[teamId];
      if (!teamInfo) continue;

      const teamTotalRevenue = teamClients.reduce((sum, c) => sum + c.adjustedRevenue, 0);
      if (teamTotalRevenue === 0) continue;

      const teamAssistantIds = getTeamAssistantIds(teamAssistants, teamId);
      let totalAssistantSalary = 0;
      let fullMonthTotalAssistantSalary = 0;
      for (const aId of teamAssistantIds) {
        const assistantData = assistantHoursData ? assistantHoursData[aId] : null;
        totalAssistantSalary += assistantData?.totalSalary || 0;
        if (isCapped) {
          const fullData = fullMonthAssistantHoursData ? fullMonthAssistantHoursData[aId] : null;
          fullMonthTotalAssistantSalary += fullData?.totalSalary || 0;
        }
      }

      const teamMemberCount = teamMemberCounts?.[teamId] || 0;
      const teamAtpBarsselCost = teamMemberCount * atpRate * prorationFactor;
      const fullMonthAtpBarsselCost = isCapped ? teamMemberCount * atpRate * fullMonthProrationFactor : teamAtpBarsselCost;

      for (const client of teamClients) {
        const revenueShare = client.adjustedRevenue / teamTotalRevenue;
        client.assistantAllocation = totalAssistantSalary * revenueShare;
        client.atpBarsselAllocation = teamAtpBarsselCost * revenueShare;
        client.dbBeforeLeader = client.basisDB - client.assistantAllocation - client.atpBarsselAllocation;
        if (isCapped) {
          client.fullMonthAssistantAllocation = fullMonthTotalAssistantSalary * revenueShare;
          client.fullMonthAtpBarsselAllocation = fullMonthAtpBarsselCost * revenueShare;
        }
      }

      const teamTotalDBBeforeLeader = teamClients.reduce((sum, c) => sum + c.dbBeforeLeader, 0);
      const calculatedLeaderSalary = teamTotalDBBeforeLeader * (teamInfo.percentageRate / 100);
      const proratedMinimumSalary = teamInfo.minimumSalary * prorationFactor;
      const finalTeamLeaderSalary = Math.max(calculatedLeaderSalary, proratedMinimumSalary);

      console.log(`[LeaderDB] Team=${teamId} | rate=${teamInfo.percentageRate}% | minSalary=${teamInfo.minimumSalary} | teamDBBeforeLeader=${teamTotalDBBeforeLeader.toFixed(0)} | calcLeader=${calculatedLeaderSalary.toFixed(0)} | proratedMin=${proratedMinimumSalary.toFixed(0)} | FINAL=${finalTeamLeaderSalary.toFixed(0)} | prorationFactor=${prorationFactor.toFixed(4)}`);

      // Full-month leader salary
      const fullMonthProratedMinSalary = isCapped ? teamInfo.minimumSalary * fullMonthProrationFactor : proratedMinimumSalary;
      const fullMonthLeaderSalary = isCapped ? Math.max(calculatedLeaderSalary, fullMonthProratedMinSalary) : finalTeamLeaderSalary;

      const teamDBForAllocation = Math.max(teamTotalDBBeforeLeader, 1);
      for (const client of teamClients) {
        const dbShare = Math.max(client.dbBeforeLeader, 0) / teamDBForAllocation;
        client.leaderAllocation = finalTeamLeaderSalary * dbShare;
        client.leaderVacationPay = client.leaderAllocation * VACATION_PAY_RATES.LEADER;
        client.finalDB = client.dbBeforeLeader - client.leaderAllocation - client.leaderVacationPay;
        console.log(`[LeaderDB]   Client=${client.clientName} | dbBeforeLeader=${client.dbBeforeLeader.toFixed(0)} | dbShare=${dbShare.toFixed(4)} | leaderAlloc=${client.leaderAllocation.toFixed(0)} | leaderVacPay=${client.leaderVacationPay.toFixed(0)} | finalDB=${client.finalDB.toFixed(0)}`);
        if (isCapped) {
          client.fullMonthLeaderAllocation = fullMonthLeaderSalary * dbShare;
          client.fullMonthLeaderVacationPay = client.fullMonthLeaderAllocation * VACATION_PAY_RATES.LEADER;
        }
      }
    }

    // Calculate DB%
    for (const client of clientDataList) {
      if (!client.teamId) {
        client.finalDB = client.basisDB;
      }
      client.dbPercent = client.adjustedRevenue > 0 
        ? (client.finalDB / client.adjustedRevenue) * 100 
        : 0;
    }

    return clientDataList;
  }, [clientsWithTeams, salesByClient, adjustmentPercents, bookings, teamSalaries, assistantHoursData, fullMonthAssistantHoursData, teamAssistants, periodStart, periodEnd, effectivePeriodEnd, isCapped, teamMemberCounts, atpBarsselRate]);

  // Filtered and sorted client data
  const filteredAndSortedData = useMemo(() => {
    let data = [...clientDBData];
    
    // Filter out zero-activity clients if toggle is on
    if (hideZeroClients) {
      data = data.filter(c => c.sales > 0 || c.revenue > 0);
    }
    
    // Sort
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
          aVal = a.adjustedSellerCost + a.sickPayAmount + a.locationCosts + a.assistantAllocation + a.leaderAllocation + a.leaderVacationPay + a.atpBarsselAllocation;
          bVal = b.adjustedSellerCost + b.sickPayAmount + b.locationCosts + b.assistantAllocation + b.leaderAllocation + b.leaderVacationPay + b.atpBarsselAllocation;
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
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return data;
  }, [clientDBData, sortColumn, sortDirection, hideZeroClients]);

  const isLoading = (useKpiCache ? kpiLoading : directSalesLoading) || assistantHoursLoading || staffHoursLoading;

  // Helper to calculate trend
  const getTrendInfo = (current: number, previous: number): { change: number; isPositive: boolean; label: string; previousValue: number } | null => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      change,
      isPositive: change >= 0,
      label: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
      previousValue: previous,
    };
  };

  // Calculate totals
  const stabExpenseAmount = stabExpenses || 0;
  
  const totals = useMemo(() => {
    const base = clientDBData.reduce(
      (acc, c) => ({
        sales: acc.sales + c.sales,
        revenue: acc.revenue + c.revenue,
        sellerSalaryCost: acc.sellerSalaryCost + c.adjustedSellerCost,
        locationCosts: acc.locationCosts + c.locationCosts,
        assistantAllocation: acc.assistantAllocation + c.assistantAllocation,
        leaderAllocation: acc.leaderAllocation + c.leaderAllocation + c.leaderVacationPay,
        atpBarsselAllocation: acc.atpBarsselAllocation + c.atpBarsselAllocation,
        finalDB: acc.finalDB + c.finalDB,
        fteCount: acc.fteCount + c.fteCount,
      }),
      { sales: 0, revenue: 0, sellerSalaryCost: 0, locationCosts: 0, assistantAllocation: 0, leaderAllocation: 0, atpBarsselAllocation: 0, finalDB: 0, fteCount: 0 }
    );
    
    const totalOverhead = stabExpenseAmount + totalStaffSalaryCost;
    const dbPercent = base.revenue > 0 ? (base.finalDB / base.revenue) * 100 : 0;
    const revenuePerFTE = base.fteCount > 0 ? base.revenue / base.fteCount : 0;
    
    return {
      ...base,
      dbPercent,
      revenuePerFTE,
      stabExpenses: stabExpenseAmount,
      staffSalaries: totalStaffSalaryCost,
      totalOverhead,
      netEarnings: base.finalDB - totalOverhead,
    };
  }, [clientDBData, stabExpenseAmount, totalStaffSalaryCost]);

  const hiddenCount = clientDBData.length - filteredAndSortedData.length;

  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      {/* KPI Dashboard */}
      <ClientDBKPIs
        totalRevenue={totals.revenue}
        totalDB={totals.finalDB}
        dbPercent={totals.dbPercent}
        netEarnings={totals.netEarnings}
        isLoading={isLoading}
      />

      <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">DB per Klient</CardTitle>
          </div>
          
          {/* Hide zero toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="hide-zero"
              checked={hideZeroClients}
              onCheckedChange={setHideZeroClients}
            />
            <Label htmlFor="hide-zero" className="text-sm text-muted-foreground flex items-center gap-1.5">
              {hideZeroClients ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
              {hideZeroClients && clientDBData.length > 0 
                ? "Alle klienter er skjult (ingen aktivitet)"
                : "Ingen data for denne periode"
              }
            </div>
          ) : isMobile ? (
            /* Mobile card layout */
            <div className="space-y-2">
              {filteredAndSortedData.map((client) => (
                <div 
                  key={client.clientId} 
                  className="border rounded-lg p-3 space-y-2"
                  onClick={() => setSelectedClientForDaily({ id: client.clientId, name: client.clientName })}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate flex-1 mr-2">{client.clientName}</span>
                    <span className={cn(
                      "text-sm font-semibold tabular-nums whitespace-nowrap",
                      client.finalDB >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {formatCurrency(client.finalDB)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{client.teamName || "–"}</span>
                    <span className={cn(
                      "tabular-nums",
                      client.dbPercent >= 20 ? "text-primary" : 
                      client.dbPercent >= 0 ? "text-muted-foreground" : "text-destructive"
                    )}>
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
            /* Desktop table */
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
                          <TooltipContent>Samlet: Sælger + Lokation + Assist. + Leder + ATP</TooltipContent>
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
                    const trend = prevData ? getTrendInfo(client.adjustedRevenue, prevData.previousRevenue) : null;
                    
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

          {/* Summary Card */}
          {(() => {
            // Calculate proration factor for month/payroll modes
            let prorationFactor = 1;
            if (periodMode === "month" || periodMode === "payroll") {
              const today = new Date();
              const effectiveEnd = today < periodEnd ? today : periodEnd;
              const daysPassed = Math.floor((effectiveEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const totalDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              prorationFactor = totalDays > 0 ? daysPassed / totalDays : 1;
            }
            const isProrated = prorationFactor < 1;
            const proratedStabExpenses = totals.stabExpenses * prorationFactor;
            const proratedStaffSalaries = totals.staffSalaries * prorationFactor;
            const proratedNetEarnings = totals.finalDB - proratedStabExpenses - proratedStaffSalaries;

            return (
              <ClientDBSummaryCard
                teamDB={totals.finalDB}
                stabExpenses={proratedStabExpenses}
                staffSalaries={proratedStaffSalaries}
                netEarnings={proratedNetEarnings}
                staffSalaryList={staffSalaryList}
                fullStabExpenses={isProrated ? totals.stabExpenses : undefined}
                fullStaffSalaries={isProrated ? totals.staffSalaries : undefined}
              />
            );
          })()}
        </CardContent>
      </Card>

      {/* Inline edit modal for adjustment percent */}
      {editingClientId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingClientId(null)}>
          <Card className="p-4 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">
              {editingType === "cancellation" ? "Rediger annulleringsprocent" : "Rediger sygefraværsprocent"}
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

      {/* Daily NETTO chart */}
      <ClientDBDailyChart
        byDate={dailyAggregates?.byDate || {}}
        nettoTotal={chartTotals.nettoTotal}
        teamDB={chartTotals.teamDB}
        totalRevenue={chartTotals.totalRevenue}
        totalOverhead={FIXED_MONTHLY_OVERHEAD}
        isLoading={isLoading || dailyAggregatesLoading}
      />

      {/* Daily breakdown modal */}
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
