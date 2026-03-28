import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BookingConflict {
  employeeId: string;
  employeeName: string;
  date: string;
  bookingId: string;
}

export function useFmBookingConflicts(enabled: boolean = true) {
  const { data, ...rest } = useQuery({
    queryKey: ["fm-booking-conflicts"],
    queryFn: async () => {
      // Get ALL booking assignments with employee name and booking id
      const { data: assignments } = await supabase
        .from("booking_assignment")
        .select("employee_id, date, booking_id, employee:employee_id(first_name, last_name)");

      if (!assignments || assignments.length === 0) return [];

      // Get ALL approved absences
      const { data: absences } = await supabase
        .from("absence_request_v2")
        .select("employee_id, start_date, end_date")
        .eq("status", "approved");

      if (!absences || absences.length === 0) return [];

      const conflicts: BookingConflict[] = [];

      for (const assignment of assignments) {
        const hasConflict = absences.some(
          (absence) =>
            absence.employee_id === assignment.employee_id &&
            assignment.date >= absence.start_date &&
            assignment.date <= absence.end_date
        );
        if (hasConflict && assignment.employee_id) {
          const emp = assignment.employee as any;
          conflicts.push({
            employeeId: assignment.employee_id,
            employeeName: emp
              ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
              : "Ukendt",
            date: assignment.date,
            bookingId: assignment.booking_id,
          });
        }
      }

      return conflicts;
    },
    enabled,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const conflicts = data ?? [];
  const uniqueEmployees = new Set(conflicts.map((c) => c.employeeId));

  return {
    conflicts,
    count: uniqueEmployees.size,
    ...rest,
  };
}
