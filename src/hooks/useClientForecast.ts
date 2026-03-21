import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subWeeks, subMonths, startOfWeek, endOfWeek } from "date-fns";
import {
  calculateFullForecast,
  MOCK_RAMP_PROFILE,
  MOCK_SURVIVAL_PROFILE,
} from "@/lib/calculations/forecast";
import type {
  EmployeePerformance,
  CohortForecastInput,
  ForecastResult,
  ClientForecastCohort,
  TeamChurnRates,
  TenureBucketRates,
} from "@/types/forecast";

const HOURS_PER_SHIFT = 7.5;
const EWMA_WEEKS = 8;
const DEFAULT_WEEKLY_HOURS = 37;

/**
 * Hook that computes a real forecast for a given client (or "all" clients).
 * Fetches employees, sales (8 weeks EWMA), shifts, absences from DB.
 * Uses existing pure calculation functions from forecast.ts.
 */
export function useClientForecast(clientId: string) {
  return useQuery({
    queryKey: ["client-forecast", clientId],
    queryFn: async (): Promise<{
      forecast: ForecastResult;
      cohorts: ClientForecastCohort[];
      calculatedAt: string;
    }> => {
      const now = new Date();
      const forecastStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1));
      const forecastEnd = endOfMonth(forecastStart);
      const forecastStartStr = format(forecastStart, "yyyy-MM-dd");
      const forecastEndStr = format(forecastEnd, "yyyy-MM-dd");

      // 1. Find teams for this client (or all teams)
      let teamIds: string[] = [];
      let campaignIds: string[] = [];

      if (clientId === "all") {
        const { data: allTeamClients } = await supabase
          .from("team_clients")
          .select("team_id, client_id");
        teamIds = [...new Set((allTeamClients || []).map(tc => tc.team_id))];
        const clientIds = [...new Set((allTeamClients || []).map(tc => tc.client_id))];
        if (clientIds.length > 0) {
          const { data: campaigns } = await supabase
            .from("client_campaigns")
            .select("id")
            .in("client_id", clientIds);
          campaignIds = (campaigns || []).map(c => c.id);
        }
      } else {
        const { data: teamClients } = await supabase
          .from("team_clients")
          .select("team_id")
          .eq("client_id", clientId);
        teamIds = (teamClients || []).map(tc => tc.team_id);
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", clientId);
        campaignIds = (campaigns || []).map(c => c.id);
      }

      if (teamIds.length === 0) {
        return {
          forecast: emptyForecast(forecastStartStr, forecastEndStr, clientId),
          cohorts: [],
          calculatedAt: now.toISOString(),
        };
      }

      // 2. Get team members -> active employees
      const { data: members } = await supabase
        .from("team_members")
        .select("employee_id, team_id")
        .in("team_id", teamIds);

      if (!members?.length) {
        return {
          forecast: emptyForecast(forecastStartStr, forecastEndStr, clientId),
          cohorts: [],
          calculatedAt: now.toISOString(),
        };
      }

      const employeeIds = [...new Set(members.map(m => m.employee_id))];
      const employeeTeamMap = new Map(members.map(m => [m.employee_id, m.team_id]));

      // 3. Employee info + agent emails + team names
      const [empRes, agentRes, teamsRes] = await Promise.all([
        supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, team_id, avatar_url, employment_start_date")
          .in("id", employeeIds)
          .eq("is_active", true),
        supabase
          .from("employee_agent_mapping")
          .select("employee_id, agent_id, agents(email)")
          .in("employee_id", employeeIds),
        supabase.from("teams").select("id, name").in("id", teamIds),
      ]);

      const employees = empRes.data || [];
      if (!employees.length) {
        return {
          forecast: emptyForecast(forecastStartStr, forecastEndStr, clientId),
          cohorts: [],
          calculatedAt: now.toISOString(),
        };
      }

      const activeIds = employees.map(e => e.id);
      const teamNameMap = new Map((teamsRes.data || []).map(t => [t.id, t.name]));

      // Build employee -> agent emails map
      const empEmailMap = new Map<string, string[]>();
      (agentRes.data || []).forEach((m: any) => {
        const email = m.agents?.email;
        if (email) {
          if (!empEmailMap.has(m.employee_id)) empEmailMap.set(m.employee_id, []);
          empEmailMap.get(m.employee_id)!.push(email.toLowerCase());
        }
      });

      const allEmails = [...new Set(Array.from(empEmailMap.values()).flat())];

      // 4. Get weekly sales for the past 8 weeks
      const weeksAgo8 = subWeeks(now, EWMA_WEEKS);
      const salesStartStr = format(weeksAgo8, "yyyy-MM-dd");
      const salesEndStr = format(now, "yyyy-MM-dd");

      let salesByEmailByWeek = new Map<string, Map<number, number>>();
      if (allEmails.length > 0 && campaignIds.length > 0) {
        // Batch emails in chunks of 200
        const emailChunks = chunk(allEmails, 200);
        const campaignChunks = chunk(campaignIds, 200);

        for (const emailBatch of emailChunks) {
          for (const campaignBatch of campaignChunks) {
            const { data: salesData } = await supabase
              .from("sales")
              .select("agent_email, sale_datetime, sale_items!inner(quantity, product_id, products(counts_as_sale))")
              .gte("sale_datetime", salesStartStr)
              .lte("sale_datetime", salesEndStr + "T23:59:59")
              .in("agent_email", emailBatch)
              .in("client_campaign_id", campaignBatch);

            (salesData || []).forEach((s: any) => {
              const email = s.agent_email?.toLowerCase();
              if (!email) return;
              const saleDate = new Date(s.sale_datetime);
              const weekStart = startOfWeek(saleDate, { weekStartsOn: 1 });
              const weekKey = weekStart.getTime();

              (s.sale_items || []).forEach((si: any) => {
                if (si.products?.counts_as_sale !== false) {
                  if (!salesByEmailByWeek.has(email)) salesByEmailByWeek.set(email, new Map());
                  const weekMap = salesByEmailByWeek.get(email)!;
                  weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + (si.quantity || 1));
                }
              });
            });
          }
        }
      }

      // 5. Shift data + absences for forecast period + past 90 days (attendance)
      const ninetyDaysAgo = format(subWeeks(now, 13), "yyyy-MM-dd");

      const [
        individualShiftsRes,
        empStandardShiftsRes,
        teamStandardShiftsRes,
        shiftDaysRes,
        absencesRes,
      ] = await Promise.all([
        supabase
          .from("shift")
          .select("employee_id, date")
          .in("employee_id", activeIds)
          .gte("date", ninetyDaysAgo)
          .lte("date", forecastEndStr),
        supabase
          .from("employee_standard_shifts")
          .select("employee_id, shift_id")
          .in("employee_id", activeIds),
        supabase
          .from("team_standard_shifts")
          .select("id, team_id, is_active")
          .in("team_id", teamIds),
        supabase.from("team_standard_shift_days").select("shift_id, day_of_week"),
        supabase
          .from("absence_request_v2")
          .select("employee_id, start_date, end_date, type")
          .in("employee_id", activeIds)
          .eq("status", "approved")
          .in("type", ["sick", "vacation", "no_show"])
          .lte("start_date", forecastEndStr)
          .gte("end_date", ninetyDaysAgo),
      ]);

      // Build shift maps (same pattern as useTeamGoalForecast)
      const shiftDays = shiftDaysRes.data || [];
      const shiftDaysMap = new Map<string, number[]>();
      shiftDays.forEach(sd => {
        if (!shiftDaysMap.has(sd.shift_id)) shiftDaysMap.set(sd.shift_id, []);
        shiftDaysMap.get(sd.shift_id)!.push(sd.day_of_week);
      });

      // Map team -> active shift days
      const teamShiftDaysMap = new Map<string, number[]>();
      (teamStandardShiftsRes.data || []).forEach(s => {
        if (s.is_active) {
          const days = shiftDaysMap.get(s.id);
          if (days) teamShiftDaysMap.set(s.team_id, days);
        }
      });

      const individualShiftMap = new Map<string, Set<string>>();
      (individualShiftsRes.data || []).forEach(s => {
        if (!individualShiftMap.has(s.employee_id)) individualShiftMap.set(s.employee_id, new Set());
        individualShiftMap.get(s.employee_id)!.add(s.date);
      });

      const empShiftIdMap = new Map<string, string>();
      (empStandardShiftsRes.data || []).forEach(s => {
        empShiftIdMap.set(s.employee_id, s.shift_id);
      });

      const absenceDateMap = new Map<string, Set<string>>();
      (absencesRes.data || []).forEach(a => {
        if (!absenceDateMap.has(a.employee_id)) absenceDateMap.set(a.employee_id, new Set());
        const absStart = new Date(a.start_date);
        const absEnd = new Date(a.end_date);
        const cur = new Date(absStart);
        while (cur <= absEnd) {
          absenceDateMap.get(a.employee_id)!.add(format(cur, "yyyy-MM-dd"));
          cur.setDate(cur.getDate() + 1);
        }
      });

      // Count shifts in a range for an employee
      function countShifts(empId: string, rangeStart: Date, rangeEnd: Date, excludeAbsence: boolean): number {
        const empTeamId = employeeTeamMap.get(empId);
        const teamDays = empTeamId ? teamShiftDaysMap.get(empTeamId) : undefined;
        const absenceDates = absenceDateMap.get(empId) || new Set();
        const individualDates = individualShiftMap.get(empId) || new Set();
        const empShiftId = empShiftIdMap.get(empId);
        const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;

        let count = 0;
        const cur = new Date(rangeStart);
        while (cur <= rangeEnd) {
          const dateStr = format(cur, "yyyy-MM-dd");
          if (excludeAbsence && absenceDates.has(dateStr)) {
            cur.setDate(cur.getDate() + 1);
            continue;
          }
          const dayOfWeek = cur.getDay();
          const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

          if (individualDates.has(dateStr)) {
            count++;
          } else if (empStandardDays !== undefined) {
            if (empStandardDays.includes(dayNumber)) count++;
          } else if (teamDays && teamDays.includes(dayNumber)) {
            count++;
          }
          cur.setDate(cur.getDate() + 1);
        }
        return count;
      }

      // 6. Build EmployeePerformance for each active employee
      // For EWMA: get SPH per week (sales / shifts / 7.5)
      const weekStarts: Date[] = [];
      for (let i = 0; i < EWMA_WEEKS; i++) {
        weekStarts.push(startOfWeek(subWeeks(now, i + 1), { weekStartsOn: 1 }));
      }

      const employeePerformances: EmployeePerformance[] = [];

      for (const emp of employees) {
        const emails = empEmailMap.get(emp.id) || [];
        const empStartDate = emp.employment_start_date ? new Date(emp.employment_start_date) : null;
        const daysSinceStart = empStartDate
          ? Math.max(0, Math.floor((now.getTime() - empStartDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 365;

        const isEstablished = daysSinceStart > 60;

        // Weekly SPH (most recent first)
        const weeklySph: number[] = [];
        for (const ws of weekStarts) {
          const we = endOfWeek(ws, { weekStartsOn: 1 });
          const shiftsInWeek = countShifts(emp.id, ws, we, false);
          const hoursInWeek = shiftsInWeek * HOURS_PER_SHIFT;

          let salesInWeek = 0;
          for (const email of emails) {
            const weekMap = salesByEmailByWeek.get(email);
            if (weekMap) {
              salesInWeek += weekMap.get(ws.getTime()) || 0;
            }
          }

          const sph = hoursInWeek > 0 ? salesInWeek / hoursInWeek : 0;
          weeklySph.push(sph);
        }

        // Planned hours for forecast month (gross = full capacity, net = minus absences)
        const grossShifts = countShifts(emp.id, forecastStart, forecastEnd, false);
        const grossPlannedHours = grossShifts * HOURS_PER_SHIFT;
        const forecastShifts = countShifts(emp.id, forecastStart, forecastEnd, true);
        const plannedHours = forecastShifts * HOURS_PER_SHIFT;

        // Attendance factor: (shifts - absence days) / shifts over past 90 days
        const past90Start = subWeeks(now, 13);
        const totalShiftsPast90 = countShifts(emp.id, past90Start, now, false);
        const totalShiftsNoAbsence = countShifts(emp.id, past90Start, now, true);
        const attendanceFactor = totalShiftsPast90 > 0
          ? Math.min(1, totalShiftsNoAbsence / totalShiftsPast90)
          : 0.92;

        const teamId = employeeTeamMap.get(emp.id);
        const teamName = teamId ? teamNameMap.get(teamId) || null : null;

        employeePerformances.push({
          employeeId: emp.id,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          teamName,
          avatarUrl: emp.avatar_url || null,
          weeklySalesPerHour: weeklySph,
          grossPlannedHours,
          plannedHours,
          personalAttendanceFactor: attendanceFactor,
          isEstablished,
          daysSinceStart,
        });
      }

      // 7. Fetch cohorts from DB
      let cohortQuery = supabase.from("client_forecast_cohorts").select("*");
      if (clientId !== "all") {
        cohortQuery = cohortQuery.eq("client_id", clientId);
      }
      const { data: dbCohorts } = await cohortQuery;
      const cohorts: ClientForecastCohort[] = (dbCohorts || []) as ClientForecastCohort[];

      // Build CohortForecastInput
      const avgAttendance = employeePerformances.length > 0
        ? employeePerformances.reduce((s, e) => s + e.personalAttendanceFactor, 0) / employeePerformances.length
        : 0.92;

      // Baseline SPH = average SPH of established employees
      const establishedSphs = employeePerformances
        .filter(e => e.isEstablished && e.weeklySalesPerHour.some(s => s > 0))
        .map(e => {
          const sum = e.weeklySalesPerHour.reduce((a, b) => a + b, 0);
          return sum / e.weeklySalesPerHour.length;
        });
      const baselineSph = establishedSphs.length > 0
        ? establishedSphs.reduce((a, b) => a + b, 0) / establishedSphs.length
        : 0.45;

      const cohortInputs: CohortForecastInput[] = cohorts.map(c => ({
        cohort: c,
        rampProfile: MOCK_RAMP_PROFILE,
        survivalProfile: MOCK_SURVIVAL_PROFILE,
        campaignBaselineSph: baselineSph,
        weeklyHoursPerHead: DEFAULT_WEEKLY_HOURS,
        attendanceFactor: avgAttendance,
      }));

      // 8. Calculate full forecast
      const forecast = calculateFullForecast(
        employeePerformances,
        cohortInputs,
        forecastStartStr,
        forecastEndStr,
        clientId,
        null,
      );

      return {
        forecast,
        cohorts,
        calculatedAt: now.toISOString(),
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

function emptyForecast(periodStart: string, periodEnd: string, clientId: string): ForecastResult {
  return {
    periodStart,
    periodEnd,
    clientId,
    clientCampaignId: null,
    totalSalesExpected: 0,
    totalSalesLow: 0,
    totalSalesHigh: 0,
    totalHours: 0,
    totalHeads: 0,
    churnLoss: 0,
    absenceLoss: 0,
    establishedEmployees: [],
    cohorts: [],
    drivers: [],
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
