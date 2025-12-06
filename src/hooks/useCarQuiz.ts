import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInMonths, differenceInDays } from "date-fns";

// Check if quiz needs renewal (every 6 months)
function isQuizExpired(passedAt: string): boolean {
  const passedDate = new Date(passedAt);
  const monthsSincePassed = differenceInMonths(new Date(), passedDate);
  return monthsSincePassed >= 6;
}

export function useCarQuizCompletion() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["car-quiz-completion", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;

      // Get employee ID from email
      const { data: employee, error: employeeError } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

      if (employeeError) {
        console.error("Error fetching employee:", employeeError);
        return null;
      }

      if (!employee) return null;

      const { data, error } = await supabase
        .from("car_quiz_completions")
        .select("*")
        .eq("employee_id", employee.id)
        .order("passed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // If quiz is expired, return null to require retaking
      if (data && isQuizExpired(data.passed_at)) {
        return { ...data, isExpired: true };
      }
      
      return data ? { ...data, isExpired: false } : null;
    },
    enabled: !!user,
  });
}

interface SubmitQuizParams {
  answers: Record<number, string>;
  gpsAccepted: boolean;
  summaryAccepted: boolean;
}

export function useSubmitCarQuiz() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ answers, gpsAccepted, summaryAccepted }: SubmitQuizParams) => {
      if (!user?.email) throw new Error("Not authenticated");

      // Get employee data from email
      const { data: employee, error: employeeError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

      if (employeeError) throw new Error("Error finding employee");
      if (!employee) throw new Error("Employee not found");

      // Get IP address
      let ipAddress = "Unknown";
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn("Could not fetch IP address");
      }

      const userAgent = navigator.userAgent;
      const submittedAt = new Date().toISOString();
      const passed = gpsAccepted && summaryAccepted;

      // Save quiz submission to database
      const { error: submissionError } = await supabase
        .from("car_quiz_submissions")
        .insert({
          employee_id: employee.id,
          passed,
          answers,
          gps_accepted: gpsAccepted,
          summary_accepted: summaryAccepted,
          ip_address: ipAddress,
          user_agent: userAgent,
          submitted_at: submittedAt,
        });

      if (submissionError) throw submissionError;

      // If passed, also update the completions table
      if (passed) {
        const { error: completionError } = await supabase
          .from("car_quiz_completions")
          .insert({ employee_id: employee.id });

        if (completionError) throw completionError;
      }

      // Send email with result
      const employeeName = `${employee.first_name} ${employee.last_name}`;
      const employeeEmail = employee.private_email;

      if (employeeEmail) {
        try {
          await supabase.functions.invoke("send-car-quiz-result", {
            body: {
              employeeId: employee.id,
              employeeName,
              employeeEmail,
              passed,
              answers,
              gpsAccepted,
              summaryAccepted,
              submittedAt,
              ipAddress,
            },
          });
        } catch (emailError) {
          console.error("Failed to send quiz result email:", emailError);
          // Don't throw - the submission was successful, email is secondary
        }
      }

      return { passed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["car-quiz-completion"] });
      queryClient.invalidateQueries({ queryKey: ["car-quiz-all-completions"] });
      queryClient.invalidateQueries({ queryKey: ["car-quiz-lock"] });
      queryClient.invalidateQueries({ queryKey: ["car-quiz-submissions"] });
    },
  });
}

// Keep the old hook for backward compatibility
export function useCompleteCarQuiz() {
  const submitQuiz = useSubmitCarQuiz();
  
  return {
    ...submitQuiz,
    mutate: (_, options?: any) => {
      // Legacy wrapper - assumes all answers correct and accepted
      submitQuiz.mutate(
        { 
          answers: {}, 
          gpsAccepted: true, 
          summaryAccepted: true 
        },
        options
      );
    },
  };
}

export function useAllCarQuizCompletions() {
  return useQuery({
    queryKey: ["car-quiz-all-completions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("car_quiz_completions")
        .select(`
          id,
          employee_id,
          passed_at,
          employee_master_data (
            first_name,
            last_name,
            job_title
          )
        `)
        .order("passed_at", { ascending: false });

      if (error) throw error;
      
      // Add expiry status to each completion
      return data?.map(item => ({
        ...item,
        isExpired: isQuizExpired(item.passed_at),
        nextRenewalDate: new Date(new Date(item.passed_at).setMonth(new Date(item.passed_at).getMonth() + 6))
      }));
    },
  });
}

export function useCarQuizSubmissions(employeeId?: string) {
  return useQuery({
    queryKey: ["car-quiz-submissions", employeeId],
    queryFn: async () => {
      let query = supabase
        .from("car_quiz_submissions")
        .select(`
          id,
          employee_id,
          passed,
          answers,
          gps_accepted,
          summary_accepted,
          ip_address,
          user_agent,
          submitted_at,
          employee_master_data (
            first_name,
            last_name
          )
        `)
        .order("submitted_at", { ascending: false });

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: true,
  });
}

// Hook for checking if car quiz lock should be shown (for new Fieldmarketing employees)
export function useCarQuizLock() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["car-quiz-lock", user?.id],
    queryFn: async () => {
      if (!user?.email) return { isLocked: false, daysRemaining: null as number | null };

      try {
        // Get employee data
        const { data: employee, error: employeeError } = await supabase
          .from("employee_master_data")
          .select("id, job_title, employment_start_date")
          .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
          .maybeSingle();

        if (employeeError) {
          console.error("Error fetching employee for car quiz lock:", employeeError);
          return { isLocked: false, daysRemaining: null as number | null };
        }

        if (!employee) return { isLocked: false, daysRemaining: null as number | null };

        // Only applies to Fieldmarketing employees
        if (employee.job_title !== "Fieldmarketing") {
          return { isLocked: false, daysRemaining: null as number | null };
        }

        // Check if quiz has been completed (and not expired)
        const { data: completion, error: completionError } = await supabase
          .from("car_quiz_completions")
          .select("passed_at")
          .eq("employee_id", employee.id)
          .order("passed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (completionError) {
          console.error("Error fetching car quiz completion:", completionError);
          return { isLocked: false, daysRemaining: null as number | null };
        }

        // If completed and not expired, not locked
        if (completion && !isQuizExpired(completion.passed_at)) {
          return { isLocked: false, daysRemaining: null as number | null };
        }

        // Check if within 14 day grace period from employment start
        if (employee.employment_start_date) {
          const startDate = new Date(employee.employment_start_date);
          const daysSinceStart = differenceInDays(new Date(), startDate);
          
          if (daysSinceStart > 14) {
            // Past 14 days and no valid completion - locked!
            return { isLocked: true, daysRemaining: 0 };
          } else {
            // Within grace period - show remaining days
            return { isLocked: false, daysRemaining: 14 - daysSinceStart };
          }
        }

        // No start date - assume locked after 14 days by default
        return { isLocked: true, daysRemaining: 0 };
      } catch (error) {
        console.error("Error in useCarQuizLock:", error);
        return { isLocked: false, daysRemaining: null as number | null };
      }
    },
    enabled: !!user && !authLoading,
    refetchInterval: 60000,
    retry: 1,
    staleTime: 30000,
  });

  return {
    isLocked: data?.isLocked ?? false,
    daysRemaining: data?.daysRemaining ?? null,
    isLoading: authLoading || (!!user && queryLoading),
  };
}
