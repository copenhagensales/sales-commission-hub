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
  vacationPay: number; // 12.5%
  totalSalary: number;
  isHourlyBased: boolean; // true if calculated from hours, false if fixed monthly
  hoursSource: 'shift' | 'timestamp'; // which source was used for calculation
}

const HOURLY_RATE_THRESHOLD = 1000; // Below this, it's likely an hourly rate, not monthly

 /**
  * Hook to calculate staff salary based on actual worked hours (for hourly employees).
  * Supports two modes based on personnel_salaries.hours_source:
  * - 'shift': Uses scheduled shifts from the shift hierarchy (default)
  * - 'timestamp': Uses actual clock-in/out data from time_stamps table
  * 
  * For 'shift' mode: Sick days count as worked (normal pay), vacation/off = 0 kr.
  * For 'timestamp' mode: Only actual clocked hours are counted.
  */
 export function useStaffHoursCalculation(
   periodStart: Date,
   periodEnd: Date,
   staffIds: string[],
   useNewAssignments?: boolean
 ) {
   return useQuery<Record<string, StaffHoursData>>({
     queryKey: ["staff-hours-calculation", periodStart.toISOString(), periodEnd.toISOString(), staffIds.sort().join(","), useNewAssignments],
     queryFn: async () => {
       if (staffIds.length === 0) return {};

       // When feature flag is on, resolve hours source from employee_time_clocks
       const hoursSourceMap = useNewAssignments
         ? await resolveHoursSourceBatch(staffIds)
         : null;
 
       // 1. Get salary info for staff from personnel_salaries (including hours_source)
       const { data: salaries } = await supabase
         .from("personnel_salaries")
         .select("employee_id, monthly_salary, hourly_rate, hours_source")
         .eq("salary_type", "staff")
         .eq("is_active", true)
         .in("employee_id", staffIds);
 
       // 2. Get team info via team_members (not employee_master_data.team_id)
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
 
       // 3. Get employee standard shift assignments → shift_id
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
 
       // 5. Get shift days (which weekdays each shift covers)
       const { data: shiftDays } = await supabase
         .from("team_standard_shift_days")
         .select("shift_id, day_of_week, start_time, end_time")
         .in("shift_id", allShiftIds.length > 0 ? allShiftIds : ["none"]);
 
       // 6. Get individual shifts in period (highest priority)
       const { data: individualShifts } = await supabase
         .from("shift")
         .select("employee_id, date, start_time, end_time")
         .in("employee_id", staffIds)
         .gte("date", format(periodStart, "yyyy-MM-dd"))
         .lte("date", format(periodEnd, "yyyy-MM-dd"));
 
       // 7. Get approved absences in period (with type for sick day handling)
       const { data: absences } = await supabase
         .from("absence_request_v2")
         .select("employee_id, start_date, end_date, is_full_day, type")
         .in("employee_id", staffIds)
         .eq("status", "approved")
         .lte("start_date", format(periodEnd, "yyyy-MM-dd"))
         .gte("end_date", format(periodStart, "yyyy-MM-dd"));
 
       // 8. Get time_stamps for employees using timestamp-based calculation
       const { data: timeStamps } = await supabase
         .from("time_stamps")
         .select("employee_id, clock_in, clock_out, break_minutes")
         .in("employee_id", staffIds)
         .gte("clock_in", format(periodStart, "yyyy-MM-dd") + "T00:00:00")
         .lte("clock_in", format(periodEnd, "yyyy-MM-dd") + "T23:59:59");
 
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
          // Use new resolver if feature flag is on, otherwise legacy
          const hoursSource: 'shift' | 'timestamp' = hoursSourceMap
            ? (hoursSourceMap[staffId]?.source === 'timestamp' ? 'timestamp' : 'shift')
            : ((salary?.hours_source as 'shift' | 'timestamp') || 'shift');
          
         // Determine if this is hourly-based or fixed monthly
         // Use hourly_rate if set, otherwise check if monthly_salary is low (likely hourly rate)
         const effectiveHourlyRate = hourlyRate > 0 ? hourlyRate : (monthlySalary < HOURLY_RATE_THRESHOLD ? monthlySalary : 0);
         const isHourlyBased = effectiveHourlyRate > 0;
         
         if (!isHourlyBased) {
          // Fixed monthly salary - prorate based on shift days in period vs full month
          const monthStart = startOfMonth(periodStart);
          const monthEnd = endOfMonth(periodStart);
          
          // Count shift days using the shift hierarchy already fetched
          const empShiftAssignment = employeeShiftAssignments?.find(a => a.employee_id === staffId);
          const empShiftId = empShiftAssignment?.shift_id;
          const empShiftDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
          const employeeTeamId = employeeTeamMap.get(staffId);
          const teamShift = teamStandardShifts?.find(s => s.team_id === employeeTeamId);
          const teamShiftDaysForProration = teamShift?.id ? shiftDaysMap.get(teamShift.id) : undefined;
          const applicableShiftDays = empShiftDays || teamShiftDaysForProration;
          
          const countShiftDays = (start: Date, end: Date) => {
            const days = eachDayOfInterval({ start, end });
            if (!applicableShiftDays || applicableShiftDays.length === 0) return days.length; // fallback
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
         
         // Get employee's assigned shift (via employee_standard_shifts)
         const empShiftAssignment = employeeShiftAssignments?.find(a => a.employee_id === staffId);
         const empShiftId = empShiftAssignment?.shift_id;
         const empShiftDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
 
         // Get team's default shift
         const teamShift = teamStandardShifts?.find(s => s.team_id === employeeTeamId);
         const teamShiftDays = teamShift?.id ? shiftDaysMap.get(teamShift.id) : undefined;
 
         // Individual shifts by date
         const individualShiftMap = new Map<string, { start: string; end: string }>();
         const empIndividualShifts = individualShifts?.filter(s => s.employee_id === staffId) || [];
         for (const shift of empIndividualShifts) {
           if (shift.start_time && shift.end_time) {
             individualShiftMap.set(shift.date, { start: shift.start_time, end: shift.end_time });
           }
         }
 
         // Absence days for this employee (with type info for sick day handling)
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
 
         // Calculate hours for each day in period
         let totalHours = 0;
 
         if (hoursSource === 'timestamp') {
           // === TIMESTAMP MODE: Use actual clock-in/out from time_stamps ===
           const empTimeStamps = (timeStamps || []).filter(ts => ts.employee_id === staffId);
           
           for (const ts of empTimeStamps) {
             if (ts.clock_in && ts.clock_out) {
               const clockIn = new Date(ts.clock_in);
               const clockOut = new Date(ts.clock_out);
               
               const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
               const breakMins = ts.break_minutes || 0;
               const netMinutes = Math.max(0, totalMinutes - breakMins);
               
               totalHours += Math.round((netMinutes / 60) * 100) / 100;
             }
           }
         } else {
           // === SHIFT MODE: Use scheduled shifts from hierarchy ===
           const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });
 
           for (const day of daysInPeriod) {
             const dateStr = format(day, "yyyy-MM-dd");
             const jsWeekday = getDay(day); // 0=Sunday, 1=Monday, ..., 6=Saturday
 
             const absenceInfo = absenceDateMap.get(dateStr);
             
             // Skip vacation/off/no_show (but NOT sick - sick pays as scheduled)
             if (absenceInfo && absenceInfo.type !== 'sick') {
               continue;
             }
 
             // Find shift for this day using hierarchy
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
 
             // Add scheduled hours (sick days are included - they get normal pay)
             if (scheduledHours > 0) {
               totalHours += scheduledHours;
             }
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