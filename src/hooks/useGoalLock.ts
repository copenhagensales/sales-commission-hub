import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface PayrollPeriod {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
}

function calculatePayrollPeriod(): PayrollPeriod {
  const today = new Date();
  const currentDay = today.getDate();
  
  let start: Date;
  let end: Date;
  
  if (currentDay >= 15) {
    start = new Date(today.getFullYear(), today.getMonth(), 15);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 14);
  } else {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    end = new Date(today.getFullYear(), today.getMonth(), 14);
  }
  
  return {
    start,
    end,
    startStr: format(start, "yyyy-MM-dd"),
    endStr: format(end, "yyyy-MM-dd"),
  };
}

interface GoalLockResult {
  isLocked: boolean;
  employeeId: string | null;
  payrollPeriod: PayrollPeriod | null;
}

export function useGoalLock() {
  const { user } = useAuth();
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["goal-lock-check", user?.id],
    queryFn: async (): Promise<GoalLockResult> => {
      if (!user?.id) return { isLocked: false, employeeId: null, payrollPeriod: null };
      
      // Get employee data to check salary type
      // @ts-ignore - Supabase type chain too deep
      const { data: employee, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, salary_type")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (empError) throw empError;
      if (!employee) return { isLocked: false, employeeId: null, payrollPeriod: null };
      
      // Only applies to commission-based employees
      if (employee.salary_type !== "provision") {
        return { isLocked: false, employeeId: employee.id, payrollPeriod: null };
      }
      
      const payrollPeriod = calculatePayrollPeriod();
      
      // Check if goal exists for current period
      const { data: existingGoal, error: goalError } = await supabase
        .from("employee_sales_goals")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("period_start", payrollPeriod.startStr)
        .eq("period_end", payrollPeriod.endStr)
        .maybeSingle();
      
      if (goalError) throw goalError;
      
      // Locked if no goal exists for current period
      const isLocked = !existingGoal;
      
      return {
        isLocked,
        employeeId: employee.id,
        payrollPeriod,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60, // Cache for 1 minute
  });
  
  return {
    isLocked: data?.isLocked ?? false,
    employeeId: data?.employeeId ?? null,
    payrollPeriod: data?.payrollPeriod ?? null,
    isLoading,
    refetch,
  };
}
