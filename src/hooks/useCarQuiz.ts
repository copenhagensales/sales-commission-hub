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
      if (!user) return null;

      // Get employee ID from email
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

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

export function useCompleteCarQuiz() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Get employee ID from email
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

      if (!employee) throw new Error("Employee not found");

      const { error } = await supabase
        .from("car_quiz_completions")
        .insert({ employee_id: employee.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["car-quiz-completion"] });
      queryClient.invalidateQueries({ queryKey: ["car-quiz-all-completions"] });
      queryClient.invalidateQueries({ queryKey: ["car-quiz-lock"] });
    },
  });
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

// Hook for checking if car quiz lock should be shown (for new Fieldmarketing employees)
export function useCarQuizLock() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["car-quiz-lock", user?.id],
    queryFn: async () => {
      if (!user) return { isLocked: false, daysRemaining: null as number | null };

      // Get employee data
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id, job_title, employment_start_date")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

      if (!employee) return { isLocked: false, daysRemaining: null as number | null };

      // Only applies to Fieldmarketing employees
      if (employee.job_title !== "Fieldmarketing") {
        return { isLocked: false, daysRemaining: null as number | null };
      }

      // Check if quiz has been completed (and not expired)
      const { data: completion } = await supabase
        .from("car_quiz_completions")
        .select("passed_at")
        .eq("employee_id", employee.id)
        .order("passed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

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
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  return {
    isLocked: data?.isLocked ?? false,
    daysRemaining: data?.daysRemaining ?? null,
    isLoading,
  };
}
