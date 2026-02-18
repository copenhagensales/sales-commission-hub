import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, subWeeks, subDays, format, isWeekend, isToday, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { REFRESH_PROFILES } from "@/utils/tvMode";

export interface PersonalWeekStats {
  weekTotal: number;
  bestDay: {
    date: string;
    commission: number;
  } | null;
}

export interface DailyCommissionEntry {
  date: string;           // "2026-01-28"
  dayName: string;        // "Tir"
  commission: number;     // 2350
  isToday: boolean;
  isWeekend: boolean;
}

export interface PersonalWeeklyData {
  currentWeek: PersonalWeekStats;
  lastWeek: PersonalWeekStats;
  dailyBreakdown: DailyCommissionEntry[];
}

export function usePersonalWeeklyStats(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["personal-weekly-stats", employeeId],
    queryFn: async (): Promise<PersonalWeeklyData> => {
      if (!employeeId) {
        return {
          currentWeek: { weekTotal: 0, bestDay: null },
          lastWeek: { weekTotal: 0, bestDay: null },
          dailyBreakdown: [],
        };
      }

      // Calculate date boundaries
      const now = new Date();
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const fourteenDaysAgo = subDays(now, 13); // 14 days including today

      // Fetch all daily commission data using the optimized RPC function
      const { data: dailyData, error } = await supabase
        .rpc('get_personal_daily_commission', {
          p_employee_id: employeeId,
          p_start_date: format(lastWeekStart, 'yyyy-MM-dd'),
          p_end_date: format(now, 'yyyy-MM-dd')
        });

      if (error) {
        console.error('Error fetching personal daily commission:', error);
        return {
          currentWeek: { weekTotal: 0, bestDay: null },
          lastWeek: { weekTotal: 0, bestDay: null },
          dailyBreakdown: [],
        };
      }

      // Build a map of date -> commission from RPC results
      const commissionMap: Record<string, number> = {};
      if (dailyData) {
        for (const row of dailyData) {
          commissionMap[row.sale_date] = Number(row.commission) || 0;
        }
      }

      // Calculate current week stats
      const currentWeekStats = calculateWeekStats(
        commissionMap,
        currentWeekStart,
        currentWeekEnd
      );

      // Calculate last week stats
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekStats = calculateWeekStats(
        commissionMap,
        lastWeekStart,
        lastWeekEnd
      );

      // Build daily breakdown for the last 14 days
      const dailyBreakdown = buildDailyBreakdown(
        commissionMap,
        fourteenDaysAgo,
        now
      );

      return {
        currentWeek: currentWeekStats,
        lastWeek: lastWeekStats,
        dailyBreakdown,
      };
    },
    enabled: !!employeeId,
    ...REFRESH_PROFILES.dashboard,
  });
}

function calculateWeekStats(
  commissionMap: Record<string, number>,
  weekStart: Date,
  weekEnd: Date
): PersonalWeekStats {
  let weekTotal = 0;
  let bestDay: { date: string; commission: number } | null = null;

  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = format(d, 'yyyy-MM-dd');
    const commission = commissionMap[dateStr] || 0;
    
    weekTotal += commission;
    
    if (commission > 0 && (!bestDay || commission > bestDay.commission)) {
      bestDay = { date: dateStr, commission };
    }
  }

  return { weekTotal, bestDay };
}

function buildDailyBreakdown(
  commissionMap: Record<string, number>,
  startDate: Date,
  endDate: Date
): DailyCommissionEntry[] {
  const entries: DailyCommissionEntry[] = [];
  const today = new Date();

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayDate = new Date(d);

    entries.push({
      date: dateStr,
      dayName: format(dayDate, "EEE", { locale: da }).charAt(0).toUpperCase() + 
               format(dayDate, "EEE", { locale: da }).slice(1, 3),
      commission: commissionMap[dateStr] || 0,
      isToday: isToday(dayDate),
      isWeekend: isWeekend(dayDate),
    });
  }

  return entries;
}
