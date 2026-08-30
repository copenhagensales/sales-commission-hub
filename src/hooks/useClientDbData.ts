import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { eachDayOfInterval, endOfMonth, isSameDay, parseISO, startOfMonth } from "date-fns";
import { countWorkDaysInPeriod } from "@/lib/calculations/dates";
import {
  allocateByWeights,
  computeAtpCost,
  computeLeaderSalary,
  prorationFactor as calcProrationFactor,
  resolveCompensation,
  withVacationPay,
  type LeaderSalaryResult,
  type MissingBasisReason,
} from "@/lib/calculations/dbModel";
import { useCalculationSettings } from "@/hooks/useCalculationSettings";
import { useAssistantHoursCalculation } from "@/hooks/useAssistantHoursCalculation";
import {
  useTeamAssistantLeaders,
  getActiveTeamAssistantIds,
  getAllActiveAssistantIds,
} from "@/hooks/useTeamAssistantLeaders";
import { useCpoRevenue } from "@/hooks/useCpoRevenue";
import type { KpiPeriod } from "@/hooks/usePrecomputedKpi";

/**
 * ÉN SANDHED for dækningsbidrag pr. klient og pr. team.
 *
 * Både "DB per klient" og "DB Oversigt" læser fra denne hook, så samme team
 * altid giver samme lederløn, samme assistentløn og samme ATP-omkostning.
 * Beregningsrækkefølgen ligger i `src/lib/calculations/dbModel.ts`.
 *
 * Grundlag (bekræftet i koden og aftalt som autoritativt):
 * - Omsætning følger KLIENTENS team (`team_clients`) — ikke sælgerens team.
 * - Sælgerløn = provision + feriepenge (sats fra `calculation_settings`).
 * - Lokationsudgifter medregnes for klienter markeret med `has_location_costs`.
 * - Teamudgifter medregnes, undtagen dynamiske lokationsudgifter (de ville
 *   dublere bookinger) og undtagen Stab-teamet (fællesomkostning, ikke team-DB).
 * - Kun AKTIVE medarbejdere tælles i ATP/barsel og som assistenter.
 */

export type DbPeriodMode = "payroll" | "month" | "week" | "day" | "custom";

export interface ClientDbRow {
  clientId: string;
  clientName: string;
  teamId: string | null;
  teamName: string | null;
  hasLocationCosts: boolean;
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
  teamExpenseAllocation: number;
  atpBarsselAllocation: number;
  dbBeforeLeader: number;
  leaderAllocation: number;
  leaderVacationPay: number;
  finalDB: number;
  dbPercent: number;
  fteCount: number;
  revenuePerFTE: number;
  sickPayAmount: number;
  cancellationRevenueDeduction: number;
  /** Fuldmåneds-tal til visning i parentes når perioden er skåret ved i dag */
  fullMonthAssistantAllocation: number;
  fullMonthLeaderAllocation: number;
  fullMonthLeaderVacationPay: number;
  fullMonthAtpBarsselAllocation: number;
  fullMonthTeamExpenseAllocation: number;
  /** false når teamets lederløn ikke kunne beregnes (mangler leder/lønrække/sats) */
  leaderHasBasis: boolean;
  /** false når mindst én assistent på teamet mangler lønrække eller sats */
  assistantsHaveBasis: boolean;
}

export interface TeamDbSummary {
  teamId: string;
  teamName: string;
  leaderId: string | null;
  leaderName: string;
  percentageRate: number;
  minimumSalary: number;
  /** Aktive assistenter på teamet */
  assistantIds: string[];
  assistantNames: string[];
  /** Assistenter uden brugbar lønrække — beløbet mangler grundlag */
  assistantsMissingBasis: { employeeId: string; reason: MissingBasisReason | null }[];
  activeMemberCount: number;
  clientCount: number;
  adjustedRevenue: number;
  commission: number;
  sellerSalaryCost: number;
  sickPayAmount: number;
  locationCosts: number;
  teamExpenses: number;
  assistantCost: number;
  atpCost: number;
  dbBeforeLeader: number;
  leader: LeaderSalaryResult;
  finalDb: number;
  prorationFactor: number;
}

export interface ClientDbTotals {
  sales: number;
  revenue: number;
  adjustedRevenue: number;
  sellerSalaryCost: number;
  sickPayAmount: number;
  locationCosts: number;
  teamExpenses: number;
  assistantCost: number;
  atpCost: number;
  leaderCost: number;
  finalDB: number;
  fteCount: number;
  dbPercent: number;
}

export interface UseClientDbDataParams {
  periodStart: Date;
  periodEnd: Date;
  periodMode?: DbPeriodMode;
  /** Skær perioden ved i dag, så omkostninger matcher omsætningens tidslinje */
  capAtToday?: boolean;
  /** Spring KPI-cachen over (bruges til fx 31-dages grafvinduet) */
  forceDirectSales?: boolean;
  enabled?: boolean;
}

export interface UseClientDbDataResult {
  clientRows: ClientDbRow[];
  teamSummaries: TeamDbSummary[];
  teamSummaryById: Record<string, TeamDbSummary>;
  totals: ClientDbTotals;
  isLoading: boolean;
  isCapped: boolean;
  effectivePeriodEnd: Date;
  /** true når satserne ikke kunne læses og defaults er i brug */
  settingsFallback: boolean;
}

const KPI_CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Dynamiske lokationsudgifter dublerer bookinger og må ikke tælles to gange. */
const LOCATION_EXPENSE_FORMULA = "location_costs_total";

function mapPeriodModeToKpiPeriod(
  mode: DbPeriodMode,
  periodStart: Date
): KpiPeriod | null {
  const now = new Date();
  switch (mode) {
    case "day":
      return isSameDay(periodStart, now) ? "today" : null;
    case "week": {
      const startOfWeekNow = new Date(now);
      const day = (startOfWeekNow.getDay() + 6) % 7;
      startOfWeekNow.setDate(startOfWeekNow.getDate() - day);
      startOfWeekNow.setHours(0, 0, 0, 0);
      return isSameDay(periodStart, startOfWeekNow) ? "this_week" : null;
    }
    case "month":
      return periodStart.getMonth() === now.getMonth() &&
        periodStart.getFullYear() === now.getFullYear()
        ? "this_month"
        : null;
    case "payroll":
      return "payroll_period";
    default:
      return null;
  }
}

/** Konverterer JS getDay (0=søndag) til booked_days-format (0=mandag) */
function getBookedDayIndex(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

interface SalesByClient {
  [clientId: string]: { sales: number; commission: number; revenue: number };
}

export function useClientDbData({
  periodStart,
  periodEnd,
  periodMode = "custom",
  capAtToday = false,
  forceDirectSales = false,
  enabled = true,
}: UseClientDbDataParams): UseClientDbDataResult {
  const { settings, fingerprint, isFallback: settingsFallback, isLoading: settingsLoading } =
    useCalculationSettings();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const isCapped = capAtToday && today < periodEnd;
  const effectivePeriodEnd = isCapped ? today : periodEnd;

  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();
  const effectiveEndIso = effectivePeriodEnd.toISOString();

  // --- Stamdata ------------------------------------------------------------

  const { data: clientsWithTeams } = useQuery({
    queryKey: ["clients-with-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, has_location_costs, team_clients(team_id, teams(id, name))");
      if (error) throw error;
      return data;
    },
    enabled,
  });

  const { data: adjustmentPercents } = useQuery({
    queryKey: ["client-adjustment-percents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_adjustment_percents")
        .select("client_id, cancellation_percent, deduction_percent, sick_pay_percent");
      if (error) throw error;
      return data;
    },
    enabled,
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings-for-costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(
          "id, client_id, start_date, end_date, booked_days, daily_rate_override, location:location_id(daily_rate)"
        )
        .or("client_id.not.is.null");
      if (error) throw error;
      return data;
    },
    enabled,
  });

  /** Teams med leder, lederens lønmodel og aktive medlemstal */
  const { data: teamStructure } = useQuery({
    queryKey: ["db-team-structure", fingerprint],
    queryFn: async () => {
      const [{ data: teams }, { data: members }, { data: activeEmployees }] = await Promise.all([
        supabase.from("teams").select("id, name, team_leader_id"),
        supabase.from("team_members").select("team_id, employee_id"),
        supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, is_active")
          .eq("is_active", true),
      ]);

      const leaderIds = (teams ?? []).map((t) => t.team_leader_id).filter(Boolean) as string[];

      const { data: leaderSalaries } = await supabase
        .from("personnel_salaries")
        .select(
          "employee_id, compensation_model, monthly_salary, hourly_rate, percentage_rate, minimum_salary"
        )
        .eq("salary_type", "team_leader")
        .eq("is_active", true)
        .in("employee_id", leaderIds.length > 0 ? leaderIds : ["00000000-0000-0000-0000-000000000000"]);

      const activeIds = new Set((activeEmployees ?? []).map((e) => e.id));
      const nameById = new Map(
        (activeEmployees ?? []).map((e) => [e.id, `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim()])
      );

      return {
        teams: teams ?? [],
        members: members ?? [],
        leaderSalaries: leaderSalaries ?? [],
        activeIds,
        nameById,
      };
    },
    enabled,
  });

  /** Teamudgifter — uden Stab og uden dynamiske lokationsudgifter */
  const { data: teamExpenseRows } = useQuery({
    queryKey: ["db-team-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_expenses")
        .select(
          "team_id, amount, expense_date, all_days, is_recurring, calculation_formula, description"
        );
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });

  const { data: teamAssistants = [] } = useTeamAssistantLeaders();

  const activeAssistantIds = useMemo(
    () => getAllActiveAssistantIds(teamAssistants),
    [teamAssistants]
  );

  const { data: assistantHoursData, isLoading: assistantHoursLoading } =
    useAssistantHoursCalculation(periodStart, effectivePeriodEnd, activeAssistantIds);

  const { data: fullMonthAssistantHoursData } = useAssistantHoursCalculation(
    periodStart,
    periodEnd,
    isCapped ? activeAssistantIds : []
  );

  // --- Salg ---------------------------------------------------------------

  const kpiPeriodType = forceDirectSales
    ? null
    : mapPeriodModeToKpiPeriod(periodMode, periodStart);

  const { data: kpiClientResult, isLoading: kpiLoading } = useQuery({
    queryKey: ["kpi-client-sales", kpiPeriodType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_cached_values")
        .select("scope_id, kpi_slug, value, calculated_at")
        .eq("scope_type", "client")
        .eq("period_type", kpiPeriodType!)
        .in("kpi_slug", ["sales_count", "total_commission", "total_revenue"]);
      if (error) throw error;

      const byClient: SalesByClient = {};
      let newestCalculatedAt: number | null = null;

      for (const row of data ?? []) {
        if (!row.scope_id) continue;
        const ts = row.calculated_at ? new Date(row.calculated_at).getTime() : null;
        if (ts !== null && (newestCalculatedAt === null || ts > newestCalculatedAt)) {
          newestCalculatedAt = ts;
        }
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

      const ageMs = newestCalculatedAt !== null ? Date.now() - newestCalculatedAt : null;
      return { byClient, ageMs, isStale: ageMs === null || ageMs > KPI_CACHE_MAX_AGE_MS };
    },
    enabled: enabled && !!kpiPeriodType,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const useKpiCache = !!kpiPeriodType && !!kpiClientResult && !kpiClientResult.isStale;

  const { data: salesByClientDirect, isLoading: directSalesLoading } = useQuery({
    queryKey: ["sales-by-client-direct", startIso, endIso],
    queryFn: async () => {
      const salesData = await fetchAllRows<{
        id: string;
        client_campaigns: { client_id: string } | null;
        sale_items: {
          quantity: number | null;
          mapped_commission: number | null;
          mapped_revenue: number | null;
          products: { counts_as_sale: boolean | null } | null;
        }[];
      }>(
        "sales",
        `id, client_campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, mapped_revenue, products(counts_as_sale))`,
        (q) => q.gte("sale_datetime", startIso).lte("sale_datetime", endIso),
        { orderBy: "sale_datetime", ascending: false }
      );

      const byClient: SalesByClient = {};
      for (const sale of salesData ?? []) {
        const clientId = sale.client_campaigns?.client_id;
        if (!clientId) continue;
        if (!byClient[clientId]) byClient[clientId] = { sales: 0, commission: 0, revenue: 0 };
        for (const item of sale.sale_items ?? []) {
          const countsAsSale = item.products?.counts_as_sale !== false;
          const qty = Number(item.quantity) || 1;
          if (countsAsSale) byClient[clientId].sales += qty;
          byClient[clientId].commission += Number(item.mapped_commission) || 0;
          byClient[clientId].revenue += Number(item.mapped_revenue) || 0;
        }
      }
      return byClient;
    },
    enabled: enabled && !useKpiCache && clientsWithTeams !== undefined,
  });

  const { data: cpoRevenue } = useCpoRevenue({ periodStart, periodEnd, enabled });

  const salesByClient: SalesByClient = useMemo(() => {
    if (useKpiCache && kpiClientResult?.byClient) return kpiClientResult.byClient;
    return salesByClientDirect ?? {};
  }, [useKpiCache, kpiClientResult, salesByClientDirect]);

  // --- Beregning ----------------------------------------------------------

  const computed = useMemo(() => {
    const empty = {
      clientRows: [] as ClientDbRow[],
      teamSummaries: [] as TeamDbSummary[],
    };
    if (!clientsWithTeams || !teamStructure) return empty;

    const rates = settings.vacationPayRates;
    const stabTeamId = settings.stabTeamId;
    const workdaysPerMonth = settings.workdaysPerMonth;

    const workdaysInPeriod = countWorkDaysInPeriod(periodStart, effectivePeriodEnd);
    const fullMonthWorkdays = isCapped
      ? countWorkDaysInPeriod(periodStart, periodEnd)
      : workdaysInPeriod;
    const proration = calcProrationFactor(workdaysInPeriod, workdaysPerMonth);
    const fullMonthProration = calcProrationFactor(fullMonthWorkdays, workdaysPerMonth);

    const isFullPeriodMode = periodMode === "month" || periodMode === "payroll";
    // Faste månedsudgifter tælles fuldt i en hel måned/lønperiode, ellers prorateres de
    const expenseFactor = isFullPeriodMode && !isCapped ? 1 : proration;
    const fullMonthExpenseFactor = isFullPeriodMode ? 1 : fullMonthProration;

    // Lokationsudgifter pr. klient ud fra bookinger
    const locationCostsMap = new Map<string, number>();
    const fullMonthLocationCostsMap = new Map<string, number>();
    const periodDaysArray = eachDayOfInterval({ start: periodStart, end: effectivePeriodEnd });
    const monthStart = startOfMonth(periodStart);
    const monthEnd = endOfMonth(periodStart);
    const isFullMonth = isSameDay(periodStart, monthStart) && isSameDay(periodEnd, monthEnd);
    const fullMonthDaysArray = isFullMonth
      ? periodDaysArray
      : eachDayOfInterval({ start: monthStart, end: monthEnd });

    for (const booking of bookings ?? []) {
      if (!booking.client_id) continue;
      const bookingStart = parseISO(booking.start_date);
      const bookingEnd = parseISO(booking.end_date);
      const bookedDays = (booking.booked_days as number[]) ?? [];
      const dailyRate =
        Number(booking.daily_rate_override) ||
        Number((booking.location as { daily_rate?: number } | null)?.daily_rate) ||
        0;

      for (const day of periodDaysArray) {
        if (
          day >= bookingStart &&
          day <= bookingEnd &&
          bookedDays.includes(getBookedDayIndex(day))
        ) {
          locationCostsMap.set(
            booking.client_id,
            (locationCostsMap.get(booking.client_id) ?? 0) + dailyRate
          );
        }
      }

      if (!isFullMonth) {
        for (const day of fullMonthDaysArray) {
          if (
            day >= bookingStart &&
            day <= bookingEnd &&
            bookedDays.includes(getBookedDayIndex(day))
          ) {
            fullMonthLocationCostsMap.set(
              booking.client_id,
              (fullMonthLocationCostsMap.get(booking.client_id) ?? 0) + dailyRate
            );
          }
        }
      }
    }

    // Teamudgifter pr. team (uden Stab og uden dynamiske lokationsudgifter)
    const teamExpenseMap = new Map<string, number>();
    const fullMonthTeamExpenseMap = new Map<string, number>();
    for (const expense of teamExpenseRows ?? []) {
      if (!expense.team_id) continue;
      if (stabTeamId && expense.team_id === stabTeamId) continue;
      if (expense.calculation_formula === LOCATION_EXPENSE_FORMULA) continue;

      const amount = Number(expense.amount) || 0;
      if (expense.is_recurring || expense.all_days) {
        teamExpenseMap.set(
          expense.team_id,
          (teamExpenseMap.get(expense.team_id) ?? 0) + amount * expenseFactor
        );
        fullMonthTeamExpenseMap.set(
          expense.team_id,
          (fullMonthTeamExpenseMap.get(expense.team_id) ?? 0) + amount * fullMonthExpenseFactor
        );
      } else if (expense.expense_date) {
        const expenseDate = new Date(expense.expense_date);
        if (expenseDate >= periodStart && expenseDate <= effectivePeriodEnd) {
          teamExpenseMap.set(expense.team_id, (teamExpenseMap.get(expense.team_id) ?? 0) + amount);
        }
        if (expenseDate >= periodStart && expenseDate <= periodEnd) {
          fullMonthTeamExpenseMap.set(
            expense.team_id,
            (fullMonthTeamExpenseMap.get(expense.team_id) ?? 0) + amount
          );
        }
      }
    }

    // Aktive medlemstal pr. team (sælgere + aktive assistenter + aktiv leder)
    const activeMemberCounts = new Map<string, number>();
    for (const team of teamStructure.teams) {
      const sellerCount = teamStructure.members.filter(
        (m) => m.team_id === team.id && teamStructure.activeIds.has(m.employee_id)
      ).length;
      const assistantCount = getActiveTeamAssistantIds(teamAssistants, team.id).length;
      const hasActiveLeader =
        !!team.team_leader_id && teamStructure.activeIds.has(team.team_leader_id);
      activeMemberCounts.set(team.id, sellerCount + assistantCount + (hasActiveLeader ? 1 : 0));
    }

    const adjustmentMap = new Map(
      (adjustmentPercents ?? []).map((a) => [a.client_id, a])
    );

    // --- Klientrækker (før team-fordelte omkostninger) ---
    const clientRows: ClientDbRow[] = [];
    const rowsByTeam = new Map<string, ClientDbRow[]>();

    for (const client of clientsWithTeams) {
      const teamClientArr = Array.isArray(client.team_clients)
        ? client.team_clients
        : [client.team_clients].filter(Boolean);
      const teamClientData = teamClientArr[0] as
        | { team_id: string | null; teams: { id: string; name: string } | null }
        | undefined;
      const teamId = teamClientData?.team_id ?? null;
      const teamName = teamClientData?.teams?.name ?? null;

      const salesData = salesByClient[client.id] ?? { sales: 0, commission: 0, revenue: 0 };
      const clientCpoRevenue = cpoRevenue?.byClient[client.id] ?? 0;
      const totalRevenue = salesData.revenue + clientCpoRevenue;

      const adjustment = adjustmentMap.get(client.id);
      const cancellationPercent = Number(adjustment?.cancellation_percent) || 0;
      const sickPayPercent = Number(adjustment?.sick_pay_percent) || 0;

      const hasLocationCosts = client.has_location_costs === true;
      const locationCosts = hasLocationCosts ? locationCostsMap.get(client.id) ?? 0 : 0;

      const commission = salesData.commission;
      const seller = withVacationPay(commission, rates.seller);

      const cancellationFactor = 1 - cancellationPercent / 100;
      const adjustedRevenue = salesData.revenue * cancellationFactor + clientCpoRevenue;
      const adjustedSellerCost = seller.total * cancellationFactor;
      const sickPayAmount = seller.total * (sickPayPercent / 100);
      const cancellationRevenueDeduction = salesData.revenue * (cancellationPercent / 100);

      const basisDB = adjustedRevenue - adjustedSellerCost - sickPayAmount - locationCosts;
      const fteCount = teamId ? activeMemberCounts.get(teamId) ?? 0 : 0;

      const row: ClientDbRow = {
        clientId: client.id,
        clientName: client.name,
        teamId,
        teamName,
        hasLocationCosts,
        sales: salesData.sales,
        revenue: totalRevenue,
        commission,
        sellerVacationPay: seller.vacationPay,
        sellerSalaryCost: seller.total,
        locationCosts,
        fullMonthLocationCosts: hasLocationCosts
          ? isFullMonth
            ? locationCosts
            : fullMonthLocationCostsMap.get(client.id) ?? 0
          : 0,
        cancellationPercent,
        sickPayPercent,
        adjustedRevenue,
        adjustedSellerCost,
        basisDB,
        assistantAllocation: 0,
        teamExpenseAllocation: 0,
        atpBarsselAllocation: 0,
        dbBeforeLeader: basisDB,
        leaderAllocation: 0,
        leaderVacationPay: 0,
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
        fullMonthTeamExpenseAllocation: 0,
        leaderHasBasis: true,
        assistantsHaveBasis: true,
      };

      clientRows.push(row);
      if (teamId) {
        const list = rowsByTeam.get(teamId) ?? [];
        list.push(row);
        rowsByTeam.set(teamId, list);
      }
    }

    // --- Team-niveau: assistent, ATP, teamudgifter og lederløn ---
    const teamSummaries: TeamDbSummary[] = [];

    for (const team of teamStructure.teams) {
      const teamRows = rowsByTeam.get(team.id) ?? [];
      const isStabTeam = !!stabTeamId && team.id === stabTeamId;

      const leaderSalaryRow =
        teamStructure.leaderSalaries.find((l) => l.employee_id === team.team_leader_id) ?? null;
      const leaderCompensation = resolveCompensation(leaderSalaryRow);
      const leaderHasBasis =
        !!team.team_leader_id && !!leaderSalaryRow && leaderCompensation.hasBasis;

      const activeAssistants = getActiveTeamAssistantIds(teamAssistants, team.id);
      let assistantCost = 0;
      let fullMonthAssistantCost = 0;
      const assistantsMissingBasis: TeamDbSummary["assistantsMissingBasis"] = [];
      for (const aId of activeAssistants) {
        const data = assistantHoursData?.[aId];
        assistantCost += data?.totalSalary ?? 0;
        if (isCapped) {
          fullMonthAssistantCost += fullMonthAssistantHoursData?.[aId]?.totalSalary ?? 0;
        }
        if (!data || !data.hasBasis) {
          assistantsMissingBasis.push({
            employeeId: aId,
            reason: data?.missingReason ?? "no_salary_row",
          });
        }
      }
      if (!isCapped) fullMonthAssistantCost = assistantCost;

      const activeMemberCount = activeMemberCounts.get(team.id) ?? 0;
      const atpCost = computeAtpCost({
        activeMemberCount,
        ratePerMember: settings.atpBarselRate,
        prorationFactor: proration,
      });
      const fullMonthAtpCost = isCapped
        ? computeAtpCost({
            activeMemberCount,
            ratePerMember: settings.atpBarselRate,
            prorationFactor: fullMonthProration,
          })
        : atpCost;

      const teamExpenses = isStabTeam ? 0 : teamExpenseMap.get(team.id) ?? 0;
      const fullMonthTeamExpenses = isStabTeam ? 0 : fullMonthTeamExpenseMap.get(team.id) ?? 0;

      const teamRevenue = teamRows.reduce((sum, r) => sum + r.adjustedRevenue, 0);
      const teamCommission = teamRows.reduce((sum, r) => sum + r.commission, 0);
      const teamSellerCost = teamRows.reduce((sum, r) => sum + r.adjustedSellerCost, 0);
      const teamSickPay = teamRows.reduce((sum, r) => sum + r.sickPayAmount, 0);
      const teamLocationCosts = teamRows.reduce((sum, r) => sum + r.locationCosts, 0);
      const teamBasisDb = teamRows.reduce((sum, r) => sum + r.basisDB, 0);

      // Fordel team-omkostninger ud på klienterne efter omsætningsandel
      const revenueWeights = teamRows.map((r) => r.adjustedRevenue);
      const assistantShares = allocateByWeights(assistantCost, revenueWeights);
      const atpShares = allocateByWeights(atpCost, revenueWeights);
      const expenseShares = allocateByWeights(teamExpenses, revenueWeights);
      const fullAssistantShares = allocateByWeights(fullMonthAssistantCost, revenueWeights);
      const fullAtpShares = allocateByWeights(fullMonthAtpCost, revenueWeights);
      const fullExpenseShares = allocateByWeights(fullMonthTeamExpenses, revenueWeights);

      teamRows.forEach((row, i) => {
        row.assistantAllocation = assistantShares[i] ?? 0;
        row.atpBarsselAllocation = atpShares[i] ?? 0;
        row.teamExpenseAllocation = expenseShares[i] ?? 0;
        row.dbBeforeLeader =
          row.basisDB - row.assistantAllocation - row.atpBarsselAllocation - row.teamExpenseAllocation;
        row.fullMonthAssistantAllocation = fullAssistantShares[i] ?? 0;
        row.fullMonthAtpBarsselAllocation = fullAtpShares[i] ?? 0;
        row.fullMonthTeamExpenseAllocation = fullExpenseShares[i] ?? 0;
        row.leaderHasBasis = leaderHasBasis;
        row.assistantsHaveBasis = assistantsMissingBasis.length === 0;
      });

      const dbBeforeLeader = teamBasisDb - assistantCost - atpCost - teamExpenses;

      const leader = computeLeaderSalary({
        dbBeforeLeader,
        percentageRate: leaderCompensation.percentageRate,
        minimumSalary: leaderCompensation.minimumSalary,
        prorationFactor: proration,
        leaderVacationRate: rates.leader,
        hasBasis: leaderHasBasis,
      });

      const fullMonthLeader = isCapped
        ? computeLeaderSalary({
            dbBeforeLeader,
            percentageRate: leaderCompensation.percentageRate,
            minimumSalary: leaderCompensation.minimumSalary,
            prorationFactor: fullMonthProration,
            leaderVacationRate: rates.leader,
            hasBasis: leaderHasBasis,
          })
        : leader;

      // Lederlønnen fordeles efter DB-andel (ikke omsætning), som hidtil
      const dbWeights = teamRows.map((r) => r.dbBeforeLeader);
      const leaderShares = allocateByWeights(leader.salary, dbWeights);
      const fullLeaderShares = allocateByWeights(fullMonthLeader.salary, dbWeights);

      teamRows.forEach((row, i) => {
        row.leaderAllocation = leaderShares[i] ?? 0;
        row.leaderVacationPay = row.leaderAllocation * rates.leader;
        row.finalDB = row.dbBeforeLeader - row.leaderAllocation - row.leaderVacationPay;
        row.fullMonthLeaderAllocation = fullLeaderShares[i] ?? 0;
        row.fullMonthLeaderVacationPay = row.fullMonthLeaderAllocation * rates.leader;
      });

      teamSummaries.push({
        teamId: team.id,
        teamName: team.name,
        leaderId: team.team_leader_id ?? null,
        leaderName: team.team_leader_id
          ? teamStructure.nameById.get(team.team_leader_id) ?? "Ukendt"
          : "Ikke tildelt",
        percentageRate: leaderCompensation.percentageRate,
        minimumSalary: leaderCompensation.minimumSalary,
        assistantIds: activeAssistants,
        assistantNames: activeAssistants.map(
          (id) => teamStructure.nameById.get(id) ?? "Ukendt"
        ),
        assistantsMissingBasis,
        activeMemberCount,
        clientCount: teamRows.length,
        adjustedRevenue: teamRevenue,
        commission: teamCommission,
        sellerSalaryCost: teamSellerCost,
        sickPayAmount: teamSickPay,
        locationCosts: teamLocationCosts,
        teamExpenses,
        assistantCost,
        atpCost,
        dbBeforeLeader,
        leader,
        finalDb: dbBeforeLeader - leader.totalCost,
        prorationFactor: proration,
      });
    }

    for (const row of clientRows) {
      if (!row.teamId) {
        row.dbBeforeLeader = row.basisDB;
        row.finalDB = row.basisDB;
      }
      row.dbPercent = row.adjustedRevenue > 0 ? (row.finalDB / row.adjustedRevenue) * 100 : 0;
    }

    return { clientRows, teamSummaries };
  }, [
    clientsWithTeams,
    teamStructure,
    teamExpenseRows,
    adjustmentPercents,
    bookings,
    salesByClient,
    cpoRevenue,
    assistantHoursData,
    fullMonthAssistantHoursData,
    teamAssistants,
    settings,
    periodStart,
    periodEnd,
    effectivePeriodEnd,
    isCapped,
    periodMode,
  ]);

  const totals: ClientDbTotals = useMemo(() => {
    const base = computed.clientRows.reduce(
      (acc, c) => ({
        sales: acc.sales + c.sales,
        revenue: acc.revenue + c.revenue,
        adjustedRevenue: acc.adjustedRevenue + c.adjustedRevenue,
        sellerSalaryCost: acc.sellerSalaryCost + c.adjustedSellerCost,
        sickPayAmount: acc.sickPayAmount + c.sickPayAmount,
        locationCosts: acc.locationCosts + c.locationCosts,
        teamExpenses: acc.teamExpenses + c.teamExpenseAllocation,
        assistantCost: acc.assistantCost + c.assistantAllocation,
        atpCost: acc.atpCost + c.atpBarsselAllocation,
        leaderCost: acc.leaderCost + c.leaderAllocation + c.leaderVacationPay,
        finalDB: acc.finalDB + c.finalDB,
        fteCount: acc.fteCount + c.fteCount,
      }),
      {
        sales: 0,
        revenue: 0,
        adjustedRevenue: 0,
        sellerSalaryCost: 0,
        sickPayAmount: 0,
        locationCosts: 0,
        teamExpenses: 0,
        assistantCost: 0,
        atpCost: 0,
        leaderCost: 0,
        finalDB: 0,
        fteCount: 0,
      }
    );
    return {
      ...base,
      dbPercent: base.revenue > 0 ? (base.finalDB / base.revenue) * 100 : 0,
    };
  }, [computed.clientRows]);

  const teamSummaryById = useMemo(() => {
    const map: Record<string, TeamDbSummary> = {};
    for (const summary of computed.teamSummaries) map[summary.teamId] = summary;
    return map;
  }, [computed.teamSummaries]);

  const isLoading =
    settingsLoading ||
    (useKpiCache ? kpiLoading : directSalesLoading) ||
    assistantHoursLoading ||
    !clientsWithTeams ||
    !teamStructure;

  return {
    clientRows: computed.clientRows,
    teamSummaries: computed.teamSummaries,
    teamSummaryById,
    totals,
    isLoading: !!isLoading,
    isCapped,
    effectivePeriodEnd,
    settingsFallback,
  };
}
