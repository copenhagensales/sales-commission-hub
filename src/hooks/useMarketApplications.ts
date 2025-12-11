import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVagtEmployee } from "./useVagtEmployee";
import { useToast } from "./use-toast";
import { useAuth } from "./useAuth";

export type MarketApplicationStatus = "pending" | "approved" | "rejected";

export interface MarketApplication {
  id: string;
  booking_id: string;
  employee_id: string;
  status: MarketApplicationStatus;
  applied_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  note: string | null;
  booking?: {
    id: string;
    start_date: string;
    end_date: string;
    application_deadline: string | null;
    location: {
      name: string;
      address_city: string | null;
    };
    brand: {
      name: string;
      color_hex: string;
    };
  };
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Fetch open markets that employee can apply to
export function useOpenMarkets() {
  const { data: employee } = useVagtEmployee();

  return useQuery({
    queryKey: ["open-markets", employee?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location (name, address_street, address_city, contact_person_name),
          brand (name, color_hex)
        `)
        .eq("open_for_applications", true)
        .lte("visible_from", today)
        .gte("application_deadline", today)
        .order("start_date");

      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });
}

// Fetch employee's own applications
export function useMyApplications() {
  const { data: employee } = useVagtEmployee();

  return useQuery({
    queryKey: ["my-market-applications", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];

      const { data, error } = await supabase
        .from("market_application")
        .select(`
          *,
          booking (
            id, start_date, end_date, application_deadline,
            location (name, address_city),
            brand (name, color_hex)
          )
        `)
        .eq("employee_id", employee.id)
        .order("applied_at", { ascending: false });

      if (error) throw error;
      return data as MarketApplication[];
    },
    enabled: !!employee?.id,
  });
}

// Fetch all applications for a booking (teamleder view)
export function useBookingApplications(bookingId: string | null) {
  return useQuery({
    queryKey: ["booking-applications", bookingId],
    queryFn: async () => {
      if (!bookingId) return [];

      const { data, error } = await supabase
        .from("market_application")
        .select(`
          *,
          employee:employee_id (id, first_name, last_name, department)
        `)
        .eq("booking_id", bookingId)
        .order("applied_at");

      if (error) throw error;
      return data;
    },
    enabled: !!bookingId,
  });
}

// Fetch all pending applications (teamleder overview)
export function usePendingApplications() {
  return useQuery({
    queryKey: ["pending-market-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_application")
        .select(`
          *,
          booking (
            id, start_date, end_date,
            location (name, address_city),
            brand (name, color_hex)
          ),
          employee:employee_id (id, first_name, last_name, department)
        `)
        .eq("status", "pending")
        .order("applied_at");

      if (error) throw error;
      return data;
    },
  });
}

// Apply to a market
export function useApplyToMarket() {
  const { data: employee } = useVagtEmployee();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      if (!employee?.id) throw new Error("Ikke logget ind");

      const { error } = await supabase.from("market_application").insert({
        booking_id: bookingId,
        employee_id: employee.id,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Ansøgning sendt!", description: "Du får besked når din ansøgning er behandlet." });
      queryClient.invalidateQueries({ queryKey: ["my-market-applications"] });
      queryClient.invalidateQueries({ queryKey: ["open-markets"] });
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast({ title: "Du har allerede ansøgt", variant: "destructive" });
      } else {
        toast({ title: "Fejl", description: error.message, variant: "destructive" });
      }
    },
  });
}

// Review application (approve/reject)
export function useReviewApplication() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      applicationId,
      status,
      note,
      createAssignment,
    }: {
      applicationId: string;
      status: "approved" | "rejected";
      note?: string;
      createAssignment?: boolean;
    }) => {
      if (!user?.email) throw new Error("Ikke logget ind");

      // Get the current user's employee ID (works for any job_title)
      const { data: employeeData, error: empError } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .eq("is_active", true)
        .maybeSingle();

      if (empError) throw empError;
      if (!employeeData?.id) throw new Error("Medarbejder ikke fundet");

      const employeeId = employeeData.id;

      // Update application status
      const { data: application, error: updateError } = await supabase
        .from("market_application")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: employeeId,
          note,
        })
        .eq("id", applicationId)
        .select(`*, booking (start_date, end_date, booked_days)`)
        .single();

      if (updateError) throw updateError;

      // If approved and should create assignment, create booking_assignment
      if (status === "approved" && createAssignment && application) {
        const booking = application.booking as any;
        const bookedDays = booking.booked_days || [0, 1, 2, 3, 4];
        const startDate = new Date(booking.start_date);

        // Create assignment for each booked day
        for (const dayOffset of bookedDays) {
          const assignmentDate = new Date(startDate);
          assignmentDate.setDate(assignmentDate.getDate() + dayOffset - bookedDays[0]);

          const { error: assignmentError } = await supabase
            .from("booking_assignment")
            .insert({
              booking_id: application.booking_id,
              employee_id: application.employee_id,
              date: assignmentDate.toISOString().split("T")[0],
              start_time: "09:00",
              end_time: "17:00",
            });

          if (assignmentError && !assignmentError.message?.includes("duplicate")) {
            console.error("Assignment error:", assignmentError);
          }
        }
      }

      return application;
    },
    onSuccess: (_, variables) => {
      const message = variables.status === "approved" ? "Ansøgning godkendt!" : "Ansøgning afvist";
      toast({ title: message });
      queryClient.invalidateQueries({ queryKey: ["pending-market-applications"] });
      queryClient.invalidateQueries({ queryKey: ["booking-applications"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-week-bookings-capacity"] });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });
}
