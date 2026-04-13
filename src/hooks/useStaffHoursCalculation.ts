import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, format, getDay, startOfMonth, endOfMonth } from "date-fns";
import { VACATION_PAY_RATES, calculateHoursFromShift } from "@/lib/calculations";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { resolveHoursSourceBatch } from "@/lib/resolveHoursSource";
 
interface StaffHoursData {
  employeeId: string;
  hourlyRate: number;
  workedHours: number;
  baseSalary: number;
  vacationPay: number;
  totalSalary: number;
  isHourlyBased: boolean;
  hoursSource: 'shift' | 'timestamp';
}

const HOURLY_RATE_THRESHOLD = 1000;

 export function useStaffHoursCalculation(
   periodStart: Date,
   periodEnd: Date,
   staffIds: string[],
   useNewAssignments?: boolean,
   clientId?: string
 ) {
   return useQuery<Record<string, StaffHoursData>>({
     queryKey: ["staff-hours-calculation", periodStart.toISOString(), periodEnd.toISOString(), staffIds.sort().join(","), useNewAssignments, clientId],
     queryFn: async () => {
       if (staffIds.length === 0) return {};

       // Resolve hours source, now with optional clientId
       const hoursSourceMap = useNewAssignments
         ? await resolveHoursSourceBatch(staffIds, clientId)
         : null;
 
       // 1. Get salary info
       const { data: salaries } = await supabase
         .from("personnel_salaries")
         .select("employee_id, monthly_salary, hourly_rate, hours_source")
         .eq("salary_type", "staff")
         .eq("is_active", true)
         .in("employee_id", staffIds);
 
       // 2. Get team info
       const { data: teamMemberships } = await supabase
         .from("team_members")
         .select("employee_id, team_id")
         .in("employee_id", staffIds);

       const employeeTeamMap = new Map<string, string>();
       for (const tm of teamMemberships || []) {
         employeeTeamMap.set(tm.employee_id, tm.team_id);
       }

       const teamIds = [...new Set(
         (teamMemberships || []).map(tm => tm.team_id).filter(Boolean)
       )] as string[];

       // 3. Get employee standard shift assignments
       const { data: employeeShiftAssignments } = await supabase
         .from("employee_standard_shifts")
         .select("employee_id, shift_id")
         .in("employee_id", staffIds);

       const empShiftIds = [...new Set((employeeShiftAssignments || []).map(a => a.shift_id).filter(Boolean))] as string[];

       // 4. Get team standard shifts
       const { data: teamStandardShifts } = await supabase
         .from("team_standard_shifts")
         .select("id, team_id, start_time, end_time")
         .eq("is_active", true)
         .in("team_id", teamIds.length > 0 ? teamIds : ["none"]);

       const teamShiftIds = (teamStandardShifts || []).map(s => s.id);
       const allShiftIds = [...new Set([...empShiftIds, ...teamShiftIds])];

       // 5. Get shift days
       const { data: shiftDays } = await supabase
         .from("team_standard_shift_days")
         .select("shift_id, day_of_week, start_time, end_time")
         .in("shift_id", allShiftIds.length > 0 ? allShiftIds : ["none"]);

       // 6. Get individual shifts
       const { data: individualShifts } = await supabase
         .from("shift")
         .select("employee_id, date, start_time, end_time")
         .in("employee_id", staffIds)
         .gte("date", format(periodStart, "yyyy-MM-dd"))
         .lte("date", format(periodEnd, "yyyy-MM-dd"));

       // 7. Get absences
       const { data: absences } = await supabase
         .from("absence_request_v2")
         .select("employee_id, start_date, end_date, is_full_day, type")
         .in("employee_id", staffIds)
         .eq("status", "approved")
         .lte("start_date", format(periodEnd, "yyyy-MM-dd"))
         .gte("end_date", format(periodStart, "yyyy-MM-dd"));

       // 8. Get time_stamps — filter by client_id if provided
       let tsQuery = supabase
         .from("time_stamps")
         .select("employee_id, clock_in, clock_out, break_minutes, client_id")
         .in("employee_id", staffIds)
         .gte("clock_in", format(periodStart, "yyyy-MM-dd") + "T00:00:00")
         .lte("clock_in", format(periodEnd, "yyyy-MM-dd") + "T23:59:59");

       if (clientId) {
         tsQuery = tsQuery.eq("client_id", clientId);
       }

       const { data: timeStamps } = await tsQuery;

       // Also fetch ALL timestamps (no client filter) for anti-double-counting in shift mode
       let allTimeStamps = timeStamps;
       if (clientId) {
         const { data: allTs } = await supabase
           .from("time_stamps")
           .select("employee_id, clock_in, clock_out, break_minutes, client_id")
           .in("employee_id", staffIds)
           .gte("clock_in", format(periodStart, "yyyy-MM-dd") + "T00:00:00")
           .lte("clock_in", format(periodEnd, "yyyy-MM-dd") + "T23:59:59");
         allTimeStamps = allTs;
       }

       // Build lookup maps
       const shiftDaysMap = new Map<string, Array<{ dayOfWeek: number; startTime: string; endTime: string }>>();
       for (const sd of shiftDays || []) {
         if (!shiftDaysMap.has(sd.shift_id)) {
           shiftDaysMap.set(sd.shift_id, []);
         }
         shiftDaysMap.get(sd.shift_id)!.push({
           dayOfWeek: sd.day_of_week,
           startTime: sd.start_time,
           endTime: sd.end_time,
         });
       }

       // Build result
       const result: Record<string, StaffHoursData> = {};

       for (const staffId of staffIds) {
         const salary = salaries?.find(s => s.employee_id === staffId);
         const monthlySalary = Number(salary?.monthly_salary) || 0;
         const hourlyRate = Number(salary?.hourly_rate) || 0;
         const hoursSource: 'shift' | 'timestamp' = hoursSourceMap
           ? (hoursSourceMap[staffId]?.source === 'timestamp' ? 'timestamp' : 'shift')
           : ((salary?.hours_source as 'shift' | 'timestamp') || 'shift');
          
         const effectiveHourlyRate = hourlyRate > 0 ? hourlyRate : (monthlySalary < HOURLY_RATE_THRESHOLD ? monthlySalary : 0);
         const isHourlyBased = effectiveHourlyRate > 0;
         
         if (!isHourlyBased) {
          const monthStart = startOfMonth(periodStart);
          const monthEnd = endOfMonth(periodStart);
          
          const empShiftAssignment = employeeShiftAssignments?.find(a => a.employee_id === staffId);
          const empShiftId = empShiftAssignment?.shift_id;
          const empShiftDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
          const employeeTeamId = employeeTeamMap.get(staffId);
          const teamShift = teamStandardShifts?.find(s => s.team_id === employeeTeamId);
          const teamShiftDaysForProration = teamShift?.id ? shiftDaysMap.get(teamShift.id) : undefined;
          const applicableShiftDays = empShiftDays || teamShiftDaysForProration;
          
          const countShiftDays = (start: Date, end: Date) => {
            const days = eachDayOfInterval({ start, end });
            if (!applicableShiftDays || applicableShiftDays.length === 0) return days.length;
            return days.filter(d => {
              const dow = getDay(d);
              return applicableShiftDays.some(sd => sd.dayOfWeek === dow);
            }).length;
          };
          
          const workdaysInPeriod = countShiftDays(periodStart, periodEnd);
          const workdaysInMonth = countShiftDays(monthStart, monthEnd);
          
          const prorationFactor = workdaysInMonth > 0 ? workdaysInPeriod / workdaysInMonth : 1;
          const baseSalary = Math.round(monthlySalary * prorationFactor * 100) / 100;
           const vacationPay = baseSalary * VACATION_PAY_RATES.STAFF;
          
           result[staffId] = {
             employeeId: staffId,
             hourlyRate: 0,
            workedHours: workdaysInPeriod,
             baseSalary,
             vacationPay,
             totalSalary: baseSalary + vacationPay,
             isHourlyBased: false,
             hoursSource,
           };
           continue;
         }

         // Hourly-based calculation
         const employeeTeamId = employeeTeamMap.get(staffId);
         
         const empShiftAssignment = employeeShiftAssignments?.find(a => a.employee_id === staffId);
         const empShiftId = empShiftAssignment?.shift_id;
         const empShiftDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;

         const teamShift = teamStandardShifts?.find(s => s.team_id === employeeTeamId);
         const teamShiftDays = teamShift?.id ? shiftDaysMap.get(teamShift.id) : undefined;

         const individualShiftMap = new Map<string, { start: string; end: string }>();
         const empIndividualShifts = individualShifts?.filter(s => s.employee_id === staffId) || [];
         for (const shift of empIndividualShifts) {
           if (shift.start_time && shift.end_time) {
             individualShiftMap.set(shift.date, { start: shift.start_time, end: shift.end_time });
           }
         }

         const empAbsences = absences?.filter(a => a.employee_id === staffId) || [];
         const absenceDateMap = new Map<string, { type: string }>();
         for (const absence of empAbsences) {
           const start = new Date(absence.start_date);
           const end = new Date(absence.end_date);
           const days = eachDayOfInterval({ start, end });
           for (const day of days) {
             absenceDateMap.set(format(day, "yyyy-MM-dd"), { type: absence.type });
           }
         }

         let totalHours = 0;

         if (hoursSource === 'timestamp') {
           // TIMESTAMP MODE: Use actual clock-in/out (already filtered by clientId if set)
           const empTimeStamps = (timeStamps || []).filter(ts => ts.employee_id === staffId);
           
           for (const ts of empTimeStamps) {
             if (ts.clock_in && ts.clock_out) {
               const ci = new Date(ts.clock_in);
               const co = new Date(ts.clock_out);
               const totalMinutes = (co.getTime() - ci.getTime()) / (1000 * 60);
               const breakMins = ts.break_minutes || 0;
               const netMinutes = Math.max(0, totalMinutes - breakMins);
               totalHours += Math.round((netMinutes / 60) * 100) / 100;
             }
           }
         } else {
           // SHIFT MODE: Use scheduled shifts
           const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });

           for (const day of daysInPeriod) {
             const dateStr = format(day, "yyyy-MM-dd");
             const jsWeekday = getDay(day);

             const absenceInfo = absenceDateMap.get(dateStr);
             if (absenceInfo && absenceInfo.type !== 'sick') {
               continue;
             }

             let scheduledHours = 0;

             if (individualShiftMap.has(dateStr)) {
               const shift = individualShiftMap.get(dateStr)!;
               if (shift.start !== "00:00" && shift.start !== "00:00:00") {
                 scheduledHours = calculateHoursFromShift(shift.start, shift.end);
               }
             } else if (empShiftDays) {
               const dayShift = empShiftDays.find(d => d.dayOfWeek === jsWeekday);
               if (dayShift && dayShift.startTime !== "00:00" && dayShift.startTime !== "00:00:00") {
                 scheduledHours = calculateHoursFromShift(dayShift.startTime, dayShift.endTime);
               }
             } else if (teamShiftDays) {
               const dayShift = teamShiftDays.find(d => d.dayOfWeek === jsWeekday);
               if (dayShift && dayShift.startTime !== "00:00" && dayShift.startTime !== "00:00:00") {
                 scheduledHours = calculateHoursFromShift(dayShift.startTime, dayShift.endTime);
               }
             }

             if (scheduledHours > 0) {
               totalHours += scheduledHours;
             }
           }

           // ANTI-DOUBLE-COUNTING: If clientId is set and source is shift,
           // subtract hours from timestamps assigned to OTHER clients
           if (clientId && allTimeStamps) {
             const secondaryStamps = (allTimeStamps || []).filter(
               ts => ts.employee_id === staffId && ts.client_id !== null && ts.client_id !== clientId
             );
             let secondaryHours = 0;
             for (const ts of secondaryStamps) {
               if (ts.clock_in && ts.clock_out) {
                 const ci = new Date(ts.clock_in);
                 const co = new Date(ts.clock_out);
                 const totalMinutes = (co.getTime() - ci.getTime()) / (1000 * 60);
                 const breakMins = ts.break_minutes || 0;
                 secondaryHours += Math.max(0, (totalMinutes - breakMins) / 60);
               }
             }
             totalHours = Math.max(0, totalHours - secondaryHours);
           }
         }

         const baseSalary = totalHours * effectiveHourlyRate;
          const vacationPay = baseSalary * VACATION_PAY_RATES.STAFF;
          const totalSalary = baseSalary + vacationPay;

         result[staffId] = {
           employeeId: staffId,
           hourlyRate: effectiveHourlyRate,
           workedHours: totalHours,
           baseSalary,
           vacationPay,
           totalSalary,
           isHourlyBased: true,
           hoursSource,
         };
       }

       return result;
     },
     enabled: staffIds.length > 0,
     staleTime: 60000,
   });
 }
 
// Note: calculateHoursFromShift is now imported from @/lib/calculations
