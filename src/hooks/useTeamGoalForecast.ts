import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";

export interface EmployeeForecast {
  employeeId: string;
  name: string;
  prevSales: number;
  prevShifts: number;
  salesPerDay: number;
  targetShifts: number;
  forecast: number;
  isNew: boolean;
  startDate: string | null;
}

export interface TeamGoalForecast {
  forecast: number;
  perEmployee: EmployeeForecast[];
  isLoading: boolean;
  prevMonthLabel: string;
}

/**
 * Hook that calculates a forecast-based sales target for a team in a given month.
 * 
 * Formula per employee:
 *   salesPerDay = prevMonthSales / prevMonthNormalShifts
 *   forecast = salesPerDay * targetMonthNormalShifts
 * 
 * Normal shift = shift exists (hierarchy: individual → employee_standard → team_standard)
 *                AND no approved absence (sick/vacation/no_show) on that date.
 */
export function useTeamGoalForecast(
  teamId: string | undefined,
  month: number,
  year: number
): TeamGoalForecast {
  const prevDate = subMonths(new Date(year, month - 1, 1), 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();

  const prevStart = startOfMonth(prevDate);
  const prevEnd = endOfMonth(prevDate);
  const targetStart = startOfMonth(new Date(year, month - 1, 1));
  const targetEnd = endOfMonth(new Date(year, month - 1, 1));

  const MONTH_NAMES = [
    "Januar", "Februar", "Marts", "April", "Maj", "Juni",
    "Juli", "August", "September", "Oktober", "November", "December"
  ];
  const prevMonthLabel = `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`;

  const { data, isLoading } = useQuery({
    queryKey: ["team-goal-forecast", teamId, month, year],
    queryFn: async () => {
      if (!teamId) return { forecast: 0, perEmployee: [] };

      // 1. Get team members
      const { data: members } = await supabase
        .from("team_members")
        .select("employee_id")
        .eq("team_id", teamId);

      if (!members?.length) return { forecast: 0, perEmployee: [] };

      const employeeIds = members.map(m => m.employee_id);

      // 2. Get employee info + agent emails
      const [empRes, agentRes] = await Promise.all([
        supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, team_id, employment_start_date")
          .in("id", employeeIds)
          .eq("is_active", true),
        supabase
          .from("employee_agent_mapping")
          .select("employee_id, agent_id, agents(email)")
          .in("employee_id", employeeIds),
      ]);

      const employees = empRes.data || [];
      if (!employees.length) return { forecast: 0, perEmployee: [] };

      const activeIds = employees.map(e => e.id);

      // Build employee -> agent emails map
      const empEmailMap = new Map<string, string[]>();
      (agentRes.data || []).forEach((m: any) => {
        const email = m.agents?.email;
        if (email) {
          if (!empEmailMap.has(m.employee_id)) empEmailMap.set(m.employee_id, []);
          empEmailMap.get(m.employee_id)!.push(email.toLowerCase());
        }
      });

      // 3. Get team's clients and their campaigns for sales filtering
      const { data: teamClients } = await supabase
        .from("team_clients")
        .select("client_id")
        .eq("team_id", teamId);

      const clientIds = (teamClients || []).map(tc => tc.client_id);

      let campaignIds: string[] = [];
      if (clientIds.length > 0) {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id")
          .in("client_id", clientIds);
        campaignIds = (campaigns || []).map(c => c.id);
      }

      // 4. Fetch sales for prev month (counts_as_sale only, filtered by team's campaigns)
      const allEmails = Array.from(new Set(
        Array.from(empEmailMap.values()).flat()
      ));

      const prevStartStr = format(prevStart, "yyyy-MM-dd");
      const prevEndStr = format(prevEnd, "yyyy-MM-dd");

      let salesByEmail: Record<string, number> = {};
      if (allEmails.length > 0 && campaignIds.length > 0) {
        const { data: salesData } = await supabase
          .from("sales")
          .select("agent_email, sale_items!inner(quantity, product_id, products!inner(counts_as_sale))")
          .gte("sale_datetime", prevStartStr)
          .lte("sale_datetime", prevEndStr + "T23:59:59")
          .in("agent_email", allEmails)
          .in("client_campaign_id", campaignIds);

        (salesData || []).forEach((s: any) => {
          const email = s.agent_email?.toLowerCase();
          if (!email) return;
          (s.sale_items || []).forEach((si: any) => {
            if (si.products?.counts_as_sale) {
              salesByEmail[email] = (salesByEmail[email] || 0) + (si.quantity || 1);
            }
          });
        });
      }

      // 4. Fetch shift data + absences for both months
      const overallStart = prevStartStr;
      const targetEndStr = format(targetEnd, "yyyy-MM-dd");

      const [
        individualShiftsRes,
        empStandardShiftsRes,
        teamStandardShiftsRes,
        shiftDaysRes,
        absencesRes,
        bookingAssignmentsRes,
      ] = await Promise.all([
        supabase
          .from("shift")
          .select("employee_id, date")
          .in("employee_id", activeIds)
          .gte("date", overallStart)
          .lte("date", targetEndStr),
        supabase
          .from("employee_standard_shifts")
          .select("employee_id, shift_id")
          .in("employee_id", activeIds),
        supabase
          .from("team_standard_shifts")
          .select("id, team_id, is_active")
          .eq("team_id", teamId),
        supabase
          .from("team_standard_shift_days")
          .select("shift_id, day_of_week"),
        supabase
          .from("absence_request_v2")
          .select("employee_id, start_date, end_date, type")
          .in("employee_id", activeIds)
          .eq("status", "approved")
          .in("type", ["sick", "vacation", "no_show"])
          .lte("start_date", targetEndStr)
          .gte("end_date", overallStart),
        supabase
          .from("booking_assignment")
          .select("employee_id, date")
          .in("employee_id", activeIds)
          .gte("date", overallStart)
          .lte("date", targetEndStr),
      ]);

      const individualShifts = individualShiftsRes.data || [];
      const empStandardShifts = empStandardShiftsRes.data || [];
      const teamStandardShifts = teamStandardShiftsRes.data || [];
      const shiftDays = shiftDaysRes.data || [];
      const absences = absencesRes.data || [];

      // Build maps
      const shiftDaysMap = new Map<string, number[]>();
      shiftDays.forEach(sd => {
        if (!shiftDaysMap.has(sd.shift_id)) shiftDaysMap.set(sd.shift_id, []);
        shiftDaysMap.get(sd.shift_id)!.push(sd.day_of_week);
      });

      const teamActiveShiftId = teamStandardShifts.find(s => s.is_active)?.id;
      const teamDays = teamActiveShiftId ? shiftDaysMap.get(teamActiveShiftId) : undefined;

      const individualShiftMap = new Map<string, Set<string>>();
      individualShifts.forEach(s => {
        if (!individualShiftMap.has(s.employee_id)) individualShiftMap.set(s.employee_id, new Set());
        individualShiftMap.get(s.employee_id)!.add(s.date);
      });

      const empShiftIdMap = new Map<string, string>();
      empStandardShifts.forEach(s => {
        empShiftIdMap.set(s.employee_id, s.shift_id);
      });

      // Build booking assignment map (FM employees' shifts)
      const bookingAssignmentMap = new Map<string, Set<string>>();
      (bookingAssignmentsRes.data || []).forEach((ba: any) => {
        if (!bookingAssignmentMap.has(ba.employee_id)) bookingAssignmentMap.set(ba.employee_id, new Set());
        bookingAssignmentMap.get(ba.employee_id)!.add(ba.date);
      });

      const absenceDateMap = new Map<string, Set<string>>();
      absences.forEach(a => {
        if (!absenceDateMap.has(a.employee_id)) absenceDateMap.set(a.employee_id, new Set());
        const absStart = new Date(a.start_date);
        const absEnd = new Date(a.end_date);
        const cur = new Date(absStart);
        while (cur <= absEnd) {
          absenceDateMap.get(a.employee_id)!.add(format(cur, "yyyy-MM-dd"));
          cur.setDate(cur.getDate() + 1);
        }
      });

      // Helper: count normal shifts for an employee in a date range
      // Hierarchy: individual shifts → booking assignments → employee standard → team standard
      function countNormalShifts(empId: string, rangeStart: Date, rangeEnd: Date, bookingOnly = false): number {
        const dates: string[] = [];
        const cur = new Date(rangeStart);
        while (cur <= rangeEnd) {
          dates.push(format(cur, "yyyy-MM-dd"));
          cur.setDate(cur.getDate() + 1);
        }

        const absenceDates = absenceDateMap.get(empId) || new Set();
        const individualDates = individualShiftMap.get(empId) || new Set();
        const bookingDates = bookingAssignmentMap.get(empId) || new Set();
        const empShiftId = empShiftIdMap.get(empId);
        const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;

        let count = 0;
        for (const dateStr of dates) {
          if (absenceDates.has(dateStr)) continue;

          const dayOfWeek = new Date(dateStr).getDay();
          const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

          if (individualDates.has(dateStr)) {
            count++;
          } else if (bookingDates.has(dateStr)) {
            count++;
          } else if (!bookingOnly) {
            // Only fall through to standard shifts if not in bookingOnly mode
            if (empStandardDays !== undefined) {
              if (empStandardDays.includes(dayNumber)) count++;
            } else if (teamDays && teamDays.includes(dayNumber)) {
              count++;
            }
          }
        }
        return count;
      }

      // 5. Calculate forecast per employee
      const perEmployee: EmployeeForecast[] = [];

      for (const emp of employees) {
        const emails = empEmailMap.get(emp.id) || [];
        const prevSales = emails.reduce((sum, email) => sum + (salesByEmail[email] || 0), 0);
        const prevShifts = countNormalShifts(emp.id, prevStart, prevEnd);

        // For target month: only use bookingOnly mode if the employee is a booking-based (FM) worker
        // Detected by having booking assignments in the PREVIOUS month but no standard/individual shifts
        const bookingDates = bookingAssignmentMap.get(emp.id) || new Set();
        const prevStartStr2 = format(prevStart, "yyyy-MM-dd");
        const prevEndStr2 = format(prevEnd, "yyyy-MM-dd");
        const hadPrevBookings = Array.from(bookingDates).some(d => d >= prevStartStr2 && d <= prevEndStr2);
        const empShiftId = empShiftIdMap.get(emp.id);
        const hasStandardShifts = empShiftId !== undefined || (teamDays && teamDays.length > 0);
        // Only restrict to booking-only if employee actually works via bookings and has no standard shift setup
        const useBookingOnly = hadPrevBookings && !hasStandardShifts;

        const targetShifts = countNormalShifts(emp.id, targetStart, targetEnd, useBookingOnly);

        const salesPerDay = prevShifts > 0 ? prevSales / prevShifts : 0;
        const forecast = Math.round(salesPerDay * targetShifts);

        const isNew = emp.employment_start_date
          ? differenceInDays(new Date(), new Date(emp.employment_start_date)) <= 20
          : false;

        perEmployee.push({
          employeeId: emp.id,
          name: `${emp.first_name} ${emp.last_name}`,
          prevSales,
          prevShifts,
          salesPerDay: Math.round(salesPerDay * 100) / 100,
          targetShifts,
          forecast,
          isNew,
          startDate: emp.employment_start_date || null,
        });
      }

      perEmployee.sort((a, b) => b.forecast - a.forecast);

      return {
        forecast: perEmployee.reduce((s, e) => s + e.forecast, 0),
        perEmployee,
      };
    },
    enabled: !!teamId,
    staleTime: 60000,
  });

  return {
    forecast: data?.forecast || 0,
    perEmployee: data?.perEmployee || [],
    isLoading,
    prevMonthLabel,
  };
}
