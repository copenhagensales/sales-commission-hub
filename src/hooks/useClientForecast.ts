import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subWeeks, subMonths, startOfWeek, endOfWeek } from "date-fns";
import {
  calculateFullForecast,
  MOCK_RAMP_PROFILE,
  MOCK_SURVIVAL_PROFILE,
  LOW_FACTOR,
  HIGH_FACTOR,
} from "@/lib/calculations/forecast";
import type {
  EmployeePerformance,
  CohortForecastInput,
  ForecastResult,
  ClientForecastCohort,
  TeamChurnRates,
  TenureBucketRates,
  ForecastRampProfile,
} from "@/types/forecast";

const HOURS_PER_SHIFT = 7.5;
const EWMA_WEEKS = 8;
const DEFAULT_WEEKLY_HOURS = 37;

/**
 * Hook that computes a real forecast for a given client (or "all" clients).
 * Fetches employees, sales (8 weeks EWMA), shifts, absences from DB.
 * Uses existing pure calculation functions from forecast.ts.
 */
export function useClientForecast(clientId: string, period: "current" | "next" | number = "next") {
  // Normalize period to monthOffset for backward compat
  const monthOffset = typeof period === "number" ? period : period === "current" ? 0 : 1;

  const FORECAST_LOGIC_VERSION = 6; // bump: campaign-specific ramp profiles
  return useQuery({
    queryKey: ["client-forecast", clientId, monthOffset, FORECAST_LOGIC_VERSION],
    queryFn: async (): Promise<{
      forecast: ForecastResult;
      cohorts: ClientForecastCohort[];
      calculatedAt: string;
      activeRampProfile: ForecastRampProfile;
    }> => {
      const now = new Date();
      const forecastStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() + monthOffset, 1));
      const forecastEnd = endOfMonth(forecastStart);
      const forecastStartStr = format(forecastStart, "yyyy-MM-dd");
      const forecastEndStr = format(forecastEnd, "yyyy-MM-dd");
      const isCurrentPeriod = monthOffset === 0;

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
          activeRampProfile: MOCK_RAMP_PROFILE,
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
          activeRampProfile: MOCK_RAMP_PROFILE,
        };
      }

      const employeeIds = [...new Set(members.map(m => m.employee_id))];
      const employeeTeamMap = new Map(members.map(m => [m.employee_id, m.team_id]));

      // 3. Employee info + agent emails + team names
      const [empRes, agentRes, teamsRes] = await Promise.all([
        supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, team_id, avatar_url, employment_start_date, work_email, employment_end_date, expected_monthly_shifts")
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
          activeRampProfile: MOCK_RAMP_PROFILE,
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

      // Fallback for FM employees: use work_email when no agent mapping exists
      for (const emp of employees) {
        if (!empEmailMap.has(emp.id) && (emp as any).work_email) {
          empEmailMap.set(emp.id, [(emp as any).work_email.toLowerCase()]);
        }
      }

      const allEmails = [...new Set(Array.from(empEmailMap.values()).flat())];

      // 4. Get weekly sales for the past 8 weeks
      const weeksAgo8 = subWeeks(now, EWMA_WEEKS);
      const salesStartStr = format(weeksAgo8, "yyyy-MM-dd");
      const salesEndStr = format(now, "yyyy-MM-dd");

      // Unified sales attribution: deduplicate by sale.id so FM sales matched via
      // both agent_email AND fm_seller_id are only counted once per employee.
      // Build: salesByEmployeeByWeek Map<employeeId, Map<weekKey, count>>
      const salesByEmployeeByWeek = new Map<string, Map<number, number>>();

      // Build reverse lookup: email -> employeeId
      const emailToEmployeeId = new Map<string, string>();
      for (const [empId, emails] of empEmailMap) {
        for (const email of emails) {
          emailToEmployeeId.set(email, empId);
        }
      }

      // Track attributed sale item IDs per employee to prevent double-counting
      const attributedSaleItems = new Map<string, Set<string>>(); // empId -> Set<saleId:itemIdx>

      function attributeSaleItems(empId: string, sale: any) {
        const saleDate = new Date(sale.sale_datetime);
        const weekStart = startOfWeek(saleDate, { weekStartsOn: 1 });
        const weekKey = weekStart.getTime();
        const saleId = sale.id;

        if (!attributedSaleItems.has(empId)) attributedSaleItems.set(empId, new Set());
        const seen = attributedSaleItems.get(empId)!;

        (sale.sale_items || []).forEach((si: any, idx: number) => {
          const itemKey = `${saleId}:${idx}`;
          if (seen.has(itemKey)) return; // already counted
          if (si.products?.counts_as_sale === false) return;
          seen.add(itemKey);

          if (!salesByEmployeeByWeek.has(empId)) salesByEmployeeByWeek.set(empId, new Map());
          const weekMap = salesByEmployeeByWeek.get(empId)!;
          weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + (si.quantity || 1));
        });
      }

      if (campaignIds.length > 0) {
        const campaignChunks = chunk(campaignIds, 200);

        // Pass 1: FM sales by fm_seller_id (highest priority)
        for (const campaignBatch of campaignChunks) {
          const { data: fmSalesData } = await supabase
            .from("sales")
            .select("id, raw_payload, agent_email, sale_datetime, sale_items!inner(quantity, product_id, products(counts_as_sale))")
            .eq("source", "fieldmarketing")
            .gte("sale_datetime", salesStartStr)
            .lte("sale_datetime", salesEndStr + "T23:59:59")
            .in("client_campaign_id", campaignBatch)
            .limit(10000);

          (fmSalesData || []).forEach((s: any) => {
            const sellerId = s.raw_payload?.fm_seller_id;
            if (sellerId && activeIds.includes(sellerId)) {
              attributeSaleItems(sellerId, s);
            }
          });
        }

        // Pass 2: All sales by agent_email (only adds items not yet attributed)
        if (allEmails.length > 0) {
          const emailChunks = chunk(allEmails, 200);
          for (const emailBatch of emailChunks) {
            for (const campaignBatch of campaignChunks) {
              const { data: salesData } = await supabase
                .from("sales")
                .select("id, agent_email, sale_datetime, sale_items!inner(quantity, product_id, products(counts_as_sale))")
                .gte("sale_datetime", salesStartStr)
                .lte("sale_datetime", salesEndStr + "T23:59:59")
                .in("agent_email", emailBatch)
                .in("client_campaign_id", campaignBatch)
                .limit(10000);

              (salesData || []).forEach((s: any) => {
                const email = s.agent_email?.toLowerCase();
                if (!email) return;
                const empId = emailToEmployeeId.get(email);
                if (!empId) return;
                attributeSaleItems(empId, s);
              });
            }
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
        holidaysRes,
        bookingAssignmentsRes,
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
          .in("type", ["sick", "vacation", "no_show", "day_off"])
          .lte("start_date", forecastEndStr)
          .gte("end_date", ninetyDaysAgo),
        (supabase as any)
          .from("danish_holiday")
          .select("date")
          .gte("date", ninetyDaysAgo)
          .lte("date", forecastEndStr),
        supabase
          .from("booking_assignment")
          .select("employee_id, date")
          .in("employee_id", activeIds)
          .gte("date", ninetyDaysAgo)
          .lte("date", forecastEndStr),
      ]);

      // Build holiday set
      const holidayDates = new Set<string>(
        (holidaysRes.data || []).map((h: any) => h.date)
      );

      // Build shift maps (same pattern as useTeamGoalForecast)
      const shiftDays = shiftDaysRes.data || [];
      const shiftDaysMap = new Map<string, number[]>();
      shiftDays.forEach(sd => {
        if (!shiftDaysMap.has(sd.shift_id)) shiftDaysMap.set(sd.shift_id, []);
        shiftDaysMap.get(sd.shift_id)!.push(sd.day_of_week);
      });

      // Map team -> active shift days (merge all active shifts, filter out empty ones)
      const teamShiftDaysMap = new Map<string, number[]>();
      (teamStandardShiftsRes.data || []).forEach(s => {
        if (s.is_active) {
          const days = shiftDaysMap.get(s.id);
          if (days && days.length > 0) {
            // Merge days for same team (dedup)
            const existing = teamShiftDaysMap.get(s.team_id) || [];
            const merged = [...new Set([...existing, ...days])];
            teamShiftDaysMap.set(s.team_id, merged);
          }
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
      const sickOnlyAbsenceDateMap = new Map<string, Set<string>>();
      (absencesRes.data || []).forEach(a => {
        if (!absenceDateMap.has(a.employee_id)) absenceDateMap.set(a.employee_id, new Set());
        if (!sickOnlyAbsenceDateMap.has(a.employee_id)) sickOnlyAbsenceDateMap.set(a.employee_id, new Set());
        const absStart = new Date(a.start_date);
        const absEnd = new Date(a.end_date);
        const cur = new Date(absStart);
        while (cur <= absEnd) {
          const dateStr = format(cur, "yyyy-MM-dd");
          absenceDateMap.get(a.employee_id)!.add(dateStr);
          // Only sick/no_show count toward attendance factor penalty
          if (a.type === 'sick' || a.type === 'no_show') {
            sickOnlyAbsenceDateMap.get(a.employee_id)!.add(dateStr);
          }
          cur.setDate(cur.getDate() + 1);
        }
      });

      // Build booking assignment map (FM employees' shifts from booking system)
      const bookingAssignmentMap = new Map<string, Set<string>>();
      (bookingAssignmentsRes.data || []).forEach((ba: any) => {
        if (!bookingAssignmentMap.has(ba.employee_id)) bookingAssignmentMap.set(ba.employee_id, new Set());
        bookingAssignmentMap.get(ba.employee_id)!.add(ba.date);
      });

      // Count shifts in a range for an employee
      // absenceMode: 'all' = exclude all absences, 'sick_only' = exclude only sick/no_show, false = no exclusion
      // Hierarchy: individual shifts → booking assignments → employee standard → team standard
      function countShifts(empId: string, rangeStart: Date, rangeEnd: Date, excludeAbsence: boolean | 'sick_only' = false): number {
        const empTeamId = employeeTeamMap.get(empId);
        const teamDays = empTeamId ? teamShiftDaysMap.get(empTeamId) : undefined;
        const absenceDates = excludeAbsence === 'sick_only'
          ? (sickOnlyAbsenceDateMap.get(empId) || new Set())
          : (absenceDateMap.get(empId) || new Set());
        const individualDates = individualShiftMap.get(empId) || new Set();
        const bookingDates = bookingAssignmentMap.get(empId) || new Set();
        const empShiftId = empShiftIdMap.get(empId);
        const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;

        let count = 0;
        const cur = new Date(rangeStart);
        while (cur <= rangeEnd) {
          const dateStr = format(cur, "yyyy-MM-dd");
          // Skip holidays — they are never working days
          if (holidayDates.has(dateStr)) {
            cur.setDate(cur.getDate() + 1);
            continue;
          }
          if (excludeAbsence && absenceDates.has(dateStr)) {
            cur.setDate(cur.getDate() + 1);
            continue;
          }
          const dayOfWeek = cur.getDay();
          const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

          if (individualDates.has(dateStr)) {
            count++;
          } else if (bookingDates.has(dateStr)) {
            count++;
          } else {
            // Employee standard or team standard fallback
            const empHasSpecialShift = empShiftIdMap.has(empId);
            if (empHasSpecialShift) {
              // Employee has a special shift — use ONLY its days (even if 0)
              if (empStandardDays && empStandardDays.includes(dayNumber)) count++;
            } else if (teamDays && teamDays.includes(dayNumber)) {
              count++;
            }
          }
          cur.setDate(cur.getDate() + 1);
        }
        return count;
      }

      // Helper: count only "concrete" shifts (individual + booking assignments) — no standard fallback
      function countConcreteShifts(empId: string, rangeStart: Date, rangeEnd: Date): number {
        const individualDates = individualShiftMap.get(empId) || new Set();
        const bookingDates = bookingAssignmentMap.get(empId) || new Set();
        const absenceDates = absenceDateMap.get(empId) || new Set();
        let count = 0;
        const cur = new Date(rangeStart);
        while (cur <= rangeEnd) {
          const dateStr = format(cur, "yyyy-MM-dd");
          if (holidayDates.has(dateStr) || absenceDates.has(dateStr)) {
            cur.setDate(cur.getDate() + 1);
            continue;
          }
          if (individualDates.has(dateStr) || bookingDates.has(dateStr)) {
            count++;
          }
          cur.setDate(cur.getDate() + 1);
        }
        return count;
      }

      // Helper: get normal weekly shift count for an employee (from standard schedule, no absences)
      // For FM employees with bookings but no standard shifts, average their recent booking frequency
      function getNormalWeeklyShifts(empId: string): number {
        const empHasSpecialShift = empShiftIdMap.has(empId);
        const empShiftId = empShiftIdMap.get(empId);
        const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
        if (empHasSpecialShift) {
          // Special shift assigned — use ONLY its days (even if 0)
          return empStandardDays ? empStandardDays.length : 0;
        }

        const empTeamId = employeeTeamMap.get(empId);
        const teamDays = empTeamId ? teamShiftDaysMap.get(empTeamId) : undefined;
        if (teamDays?.length) return teamDays.length;
        
        // Fallback: average bookings per week over the last 8 weeks
        const bookingDates = bookingAssignmentMap.get(empId);
        if (bookingDates && bookingDates.size > 0) {
          const eightWeeksAgo = subWeeks(now, EWMA_WEEKS);
          let bookingsInPeriod = 0;
          bookingDates.forEach(dateStr => {
            const d = new Date(dateStr);
            if (d >= eightWeeksAgo && d <= now) bookingsInPeriod++;
          });
          if (bookingsInPeriod > 0) {
            return Math.max(1, Math.round(bookingsInPeriod / EWMA_WEEKS));
          }
        }
        
        return 0;
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
        const empEndDate = (emp as any).employment_end_date ? new Date((emp as any).employment_end_date) : null;
        
        // Skip employees whose planned end date is before the forecast period starts
        if (empEndDate && empEndDate < forecastStart) continue;
        
        // Effective forecast end for this employee (capped by their end date)
        const empForecastEnd = empEndDate && empEndDate < forecastEnd ? empEndDate : forecastEnd;
        
        const daysSinceStart = empStartDate
          ? Math.max(0, Math.floor((now.getTime() - empStartDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 365;

        const isEstablished = daysSinceStart > 60;

        // Detect FM employee by team name
        // Weekly SPH (most recent first) — use absence-adjusted shifts
        const weeklySph: number[] = [];
        const normalWeeklyShifts = getNormalWeeklyShifts(emp.id);
        for (const ws of weekStarts) {
          const we = endOfWeek(ws, { weekStartsOn: 1 });
          const shiftsInWeek = countShifts(emp.id, ws, we, true); // exclude absences
          
          // Skip weeks with less than 50% of normal capacity (partial vacation weeks)
          if (shiftsInWeek < normalWeeklyShifts * 0.5) continue;
          
          const hoursInWeek = shiftsInWeek * HOURS_PER_SHIFT;

          let salesInWeek = 0;
          const empWeekMap = salesByEmployeeByWeek.get(emp.id);
          if (empWeekMap) {
            salesInWeek = empWeekMap.get(ws.getTime()) || 0;
          }

          // Skip weeks with 0 sales and no concrete shifts (individual/booking)
          // This handles cases where team standard gives shifts but employee didn't actually work
          const concreteShiftsInWeek = countConcreteShifts(emp.id, ws, we);
          if (salesInWeek === 0 && concreteShiftsInWeek === 0) continue;
          if (salesInWeek === 0 && shiftsInWeek <= 2) continue;

          const sph = hoursInWeek > 0 ? salesInWeek / hoursInWeek : 0;
        weeklySph.push(sph);
        }

        // Planned hours for forecast month (gross = full capacity, net = minus absences)
        // Use empForecastEnd to cap hours for employees with planned departure
        let grossShifts = countShifts(emp.id, forecastStart, empForecastEnd, false);
        let forecastShifts = countShifts(emp.id, forecastStart, empForecastEnd, true);

        let grossPlannedHours = grossShifts * HOURS_PER_SHIFT;
        let plannedHours = forecastShifts * HOURS_PER_SHIFT;

        // Attendance factor: only sick/no_show reduces attendance (vacation is planned, not a penalty)
        const past90Start = subWeeks(now, 13);
        const totalShiftsPast90 = countShifts(emp.id, past90Start, now, false);
        const totalShiftsNoSick = countShifts(emp.id, past90Start, now, 'sick_only');
        const attendanceFactor = totalShiftsPast90 > 0
          ? Math.min(1, totalShiftsNoSick / totalShiftsPast90)
          : 0.92;

        const teamId = employeeTeamMap.get(emp.id);
        const teamName = teamId ? teamNameMap.get(teamId) || null : null;

        const hasFmSales = salesByEmployeeByWeek.has(emp.id);
        const missingAgentMapping = emails.length === 0 && !hasFmSales;

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
          missingAgentMapping,
          plannedEndDate: (emp as any).employment_end_date || undefined,
          isOnCall: false,
        });
      }

      // 6b. Fetch team churn rates from historical_employment (last 12 months)
      const twelveMonthsAgo = format(subMonths(now, 12), "yyyy-MM-dd");
      const { data: histData } = await supabase
        .from("historical_employment")
        .select("team_name, start_date, end_date")
        .gte("end_date", twelveMonthsAgo);

      const teamChurnRates: TeamChurnRates = new Map();
      
      if (histData && histData.length > 0) {
        // Group exits by team and tenure bucket
        const teamExits = new Map<string, { bucket0_60: number; bucket61_180: number; bucket180plus: number }>();
        // Count total starters per team (people who entered each bucket) for proper denominator
        const teamStarters = new Map<string, { entered0_60: number; entered61_180: number; entered180plus: number }>();
        
        for (const h of histData) {
          if (!h.team_name || !h.start_date || !h.end_date) continue;
          const tenureDays = Math.floor((new Date(h.end_date).getTime() - new Date(h.start_date).getTime()) / (1000 * 60 * 60 * 24));
          
          if (!teamExits.has(h.team_name)) {
            teamExits.set(h.team_name, { bucket0_60: 0, bucket61_180: 0, bucket180plus: 0 });
          }
          if (!teamStarters.has(h.team_name)) {
            teamStarters.set(h.team_name, { entered0_60: 0, entered61_180: 0, entered180plus: 0 });
          }
          const buckets = teamExits.get(h.team_name)!;
          const starters = teamStarters.get(h.team_name)!;
          
          // Every employee who left entered the 0-60 bucket
          starters.entered0_60++;
          if (tenureDays <= 60) {
            buckets.bucket0_60++;
          } else {
            // They survived 0-60, so they entered 61-180
            starters.entered61_180++;
            if (tenureDays <= 180) {
              buckets.bucket61_180++;
            } else {
              // They survived 61-180, so they entered 180+
              starters.entered180plus++;
              buckets.bucket180plus++;
            }
          }
        }

        // Also count current employees as starters (they entered but didn't exit)
        for (const emp of employeePerformances) {
          if (!emp.teamName) continue;
          if (!teamStarters.has(emp.teamName)) {
            teamStarters.set(emp.teamName, { entered0_60: 0, entered61_180: 0, entered180plus: 0 });
          }
          const starters = teamStarters.get(emp.teamName)!;
          starters.entered0_60++;
          if (emp.daysSinceStart > 60) starters.entered61_180++;
          if (emp.daysSinceStart > 180) starters.entered180plus++;
        }

        const monthsObserved = 12;
        for (const [teamName, exits] of teamExits) {
          const starters = teamStarters.get(teamName) || { entered0_60: 1, entered61_180: 1, entered180plus: 1 };
          const rates: TenureBucketRates = {
            // Monthly rate = exits / (people who entered bucket) / months observed
            bucket0_60: Math.min(exits.bucket0_60 / (Math.max(starters.entered0_60, 1) * monthsObserved), 0.25),
            bucket61_180: Math.min(exits.bucket61_180 / (Math.max(starters.entered61_180, 1) * monthsObserved), 0.12),
            bucket180plus: Math.min(exits.bucket180plus / (Math.max(starters.entered180plus, 1) * monthsObserved), 0.05),
          };
          teamChurnRates.set(teamName, rates);
        }
      }

      // 7. Fetch cohorts and campaign-specific ramp profiles from DB
      let cohortQuery = supabase.from("client_forecast_cohorts").select("*");
      if (clientId !== "all") {
        cohortQuery = cohortQuery.eq("client_id", clientId);
      }
      const [cohortsRes, rampProfilesRes] = await Promise.all([
        cohortQuery,
        campaignIds.length > 0
          ? supabase
              .from("forecast_ramp_profiles")
              .select("*")
              .in("client_campaign_id", campaignIds)
          : Promise.resolve({ data: [] }),
      ]);
      const cohorts: ClientForecastCohort[] = (cohortsRes.data || []) as ClientForecastCohort[];

      // Build campaign -> ramp profile map
      const campaignRampMap = new Map<string, ForecastRampProfile>();
      ((rampProfilesRes as any).data || []).forEach((p: any) => {
        if (p.client_campaign_id) {
          campaignRampMap.set(p.client_campaign_id, p as ForecastRampProfile);
        }
      });

      // Determine the active ramp profile (campaign-specific or fallback)
      const activeRampProfile: ForecastRampProfile = campaignRampMap.size > 0
        ? campaignRampMap.values().next().value!
        : MOCK_RAMP_PROFILE;

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

      const cohortInputs: CohortForecastInput[] = cohorts.map(c => {
        // Use campaign-specific ramp profile if available for this cohort's campaign
        const ramp = (c.client_campaign_id && campaignRampMap.has(c.client_campaign_id))
          ? campaignRampMap.get(c.client_campaign_id)!
          : activeRampProfile;
        return {
          cohort: c,
          rampProfile: ramp,
          survivalProfile: MOCK_SURVIVAL_PROFILE,
          campaignBaselineSph: baselineSph,
          weeklyHoursPerHead: DEFAULT_WEEKLY_HOURS,
          attendanceFactor: avgAttendance,
          periodStart: format(forecastStart, "yyyy-MM-dd"),
          periodEnd: format(forecastEnd, "yyyy-MM-dd"),
        };
      });

      // 8. For current period: fetch actual sales to date
      let actualSalesToDate = 0;
      let daysElapsed = 0;
      let daysRemaining = 0;
      
      if (isCurrentPeriod) {
        const todayStr = format(now, "yyyy-MM-dd");
        
        // Count working days elapsed and remaining (exclude weekends + holidays)
        const cur2 = new Date(forecastStart);
        while (cur2 <= forecastEnd) {
          const dow = cur2.getDay();
          const ds = format(cur2, "yyyy-MM-dd");
          if (dow !== 0 && dow !== 6 && !holidayDates.has(ds)) {
            if (cur2 <= now) daysElapsed++;
            else daysRemaining++;
          }
          cur2.setDate(cur2.getDate() + 1);
        }
        
        // Fetch actual sales this month — per agent email
        const actualSalesPerEmail = new Map<string, number>();
        if (allEmails.length > 0 && campaignIds.length > 0) {
          const emailChunks2 = chunk(allEmails, 200);
          const campaignChunks2 = chunk(campaignIds, 200);
          for (const emailBatch of emailChunks2) {
            for (const campaignBatch of campaignChunks2) {
              const { data: actualSalesData } = await supabase
                .from("sales")
                .select("agent_email, sale_items!inner(quantity, products(counts_as_sale))")
                .gte("sale_datetime", forecastStartStr)
                .lte("sale_datetime", todayStr + "T23:59:59")
                .in("agent_email", emailBatch)
                .in("client_campaign_id", campaignBatch)
                .limit(10000);
              
              (actualSalesData || []).forEach((s: any) => {
                const email = s.agent_email?.toLowerCase();
                if (!email) return;
                (s.sale_items || []).forEach((si: any) => {
                  if (si.products?.counts_as_sale !== false) {
                    const qty = si.quantity || 1;
                    actualSalesToDate += qty;
                    actualSalesPerEmail.set(email, (actualSalesPerEmail.get(email) || 0) + qty);
                  }
                });
              });
            }
          }
        }
        
        // Map actual sales back to employees
        const actualSalesPerEmployee = new Map<string, number>();
        for (const emp of employees) {
          const emails = empEmailMap.get(emp.id) || [];
          let empActual = 0;
          for (const email of emails) {
            empActual += actualSalesPerEmail.get(email) || 0;
          }
          if (empActual > 0) actualSalesPerEmployee.set(emp.id, empActual);
        }
        
        // Recalculate forecast for REMAINING days only
        // Adjust planned hours to only count from tomorrow onwards
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const remainingPerformances: EmployeePerformance[] = employeePerformances.map(ep => {
          const remainingGross = countShifts(ep.employeeId, tomorrow, forecastEnd, false);
          const remainingNet = countShifts(ep.employeeId, tomorrow, forecastEnd, true);
          return {
            ...ep,
            grossPlannedHours: remainingGross * HOURS_PER_SHIFT,
            plannedHours: remainingNet * HOURS_PER_SHIFT,
          };
        });
        
        const remainingForecast = calculateFullForecast(
          remainingPerformances,
          cohortInputs,
          format(tomorrow, "yyyy-MM-dd"),
          forecastEndStr,
          clientId,
          null,
          teamChurnRates,
          activeRampProfile,
          baselineSph,
        );
        
        // Combine: actual + remaining
        const totalExpected = actualSalesToDate + remainingForecast.totalSalesExpected;
        
        // Enrich established employees with actual sales
        const enrichedEmployees = remainingForecast.establishedEmployees.map(emp => ({
          ...emp,
          actualSales: actualSalesPerEmployee.get(emp.employeeId) || 0,
        }));
        
        const combinedForecast: ForecastResult = {
          ...remainingForecast,
          establishedEmployees: enrichedEmployees,
          periodStart: forecastStartStr,
          totalSalesExpected: totalExpected,
          totalSalesLow: Math.round(actualSalesToDate + remainingForecast.totalSalesExpected * LOW_FACTOR),
          totalSalesHigh: Math.round(actualSalesToDate + remainingForecast.totalSalesExpected * HIGH_FACTOR),
          totalHours: employeePerformances.reduce((s, e) => s + e.plannedHours, 0) + remainingForecast.cohorts.reduce((s, c) => s + c.forecastHours, 0),
          totalHeads: employees.length + remainingForecast.cohorts.reduce((s, c) => s + c.effectiveHeads, 0),
          actualSalesToDate,
          remainingForecast: remainingForecast.totalSalesExpected,
          daysElapsed,
          daysRemaining,
        };
        
        // Calculate full-month absence loss for drivers
        let fullMonthKnownAbsenceLoss = 0;
        let fullMonthPredictedAbsenceLoss = 0;
        let avgAttendancePct = 0;
        let attendanceCount = 0;
        
        for (const ep of employeePerformances) {
          const ewmaSph = ep.weeklySalesPerHour.length > 0
            ? ep.weeklySalesPerHour.reduce((s, v, i) => {
                const w = Math.pow(0.85, i);
                return { sum: s.sum + v * w, wt: s.wt + w };
              }, { sum: 0, wt: 0 })
            : { sum: 0, wt: 1 };
          const sph = ewmaSph.sum / ewmaSph.wt;
          
          const knownLostHours = ep.grossPlannedHours - ep.plannedHours;
          fullMonthKnownAbsenceLoss += knownLostHours * sph;
          
          const predictedLostHours = ep.plannedHours * (1 - ep.personalAttendanceFactor);
          fullMonthPredictedAbsenceLoss += predictedLostHours * sph;
          
          avgAttendancePct += ep.personalAttendanceFactor;
          attendanceCount++;
        }
        
        fullMonthKnownAbsenceLoss = Math.round(fullMonthKnownAbsenceLoss);
        fullMonthPredictedAbsenceLoss = Math.round(fullMonthPredictedAbsenceLoss);
        const totalAbsenceLoss = fullMonthKnownAbsenceLoss + fullMonthPredictedAbsenceLoss;
        const avgAtt = attendanceCount > 0 ? Math.round((avgAttendancePct / attendanceCount) * 100) : 95;
        
        combinedForecast.absenceLoss = totalAbsenceLoss;
        
        // Build drivers with full-month absence breakdown
        const absenceDriver = {
          key: 'absence_loss',
          label: 'Fraværseffekt (hele måneden)',
          impact: 'negative' as const,
          value: `-${totalAbsenceLoss} salg`,
          description: `Planlagt fravær (ferie/fridage): -${fullMonthKnownAbsenceLoss} salg. Forventet uforudset sygdom (~${100 - avgAtt}%): -${fullMonthPredictedAbsenceLoss} salg. Total fraværseffekt: -${totalAbsenceLoss} salg.`,
        };
        
        // Replace existing absence driver with full-month version
        const driversWithoutAbsence = remainingForecast.drivers.filter(d => d.key !== 'absence_loss');
        
        combinedForecast.drivers = [
          {
            key: 'actual_sales',
            label: 'Faktiske salg til dato',
            impact: 'positive' as const,
            value: `${actualSalesToDate} salg`,
            description: `${actualSalesToDate} salg registreret i de første ${daysElapsed} arbejdsdage. ${daysRemaining} arbejdsdage tilbage.`,
          },
          absenceDriver,
          ...driversWithoutAbsence,
        ];
        
        return {
          forecast: combinedForecast,
          cohorts,
          calculatedAt: now.toISOString(),
          activeRampProfile,
        };
      }

      // 8b. Calculate full forecast (next month - original logic)
      const forecast = calculateFullForecast(
        employeePerformances,
        cohortInputs,
        forecastStartStr,
        forecastEndStr,
        clientId,
        null,
        teamChurnRates,
        activeRampProfile,
        baselineSph,
        true, // isFuturePeriod — apply momentum correction
      );

      return {
        forecast,
        cohorts,
        calculatedAt: now.toISOString(),
        activeRampProfile,
      };
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
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
    establishedChurnLoss: 0,
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
