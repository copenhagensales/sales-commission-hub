import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
        .maybeSingle();

      if (error) throw error;
      return data;
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
      return data;
    },
  });
}
