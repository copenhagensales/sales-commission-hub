import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { countWorkDaysInPeriod } from "@/lib/calculations/dates";
import { prorationFactor as calcProrationFactor } from "@/lib/calculations/dbModel";
import { useCalculationSettings } from "@/hooks/useCalculationSettings";
import { useStaffHoursCalculation } from "@/hooks/useStaffHoursCalculation";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

/**
 * Fællesomkostninger (overhead) beregnet ud fra DATA — ikke et hardkodet tal.
 *
 * Erstatter den tidligere konstant `FIXED_MONTHLY_OVERHEAD = 988876`
 * ("Stab 932.000 + Stabsløn 56.876") i ClientDBTab. Overhead består af:
 *   1. Stab-teamets udgifter (`team_expenses` på Stab-teamet fra indstillingerne)
 *   2. Stabslønninger beregnet af `useStaffHoursCalculation` for samme periode
 *
 * Faste (recurring/all_days) udgifter tælles fuldt i en hel måned/lønperiode og
 * prorateres ellers efter arbejdsdage, så tal for en delperiode ikke overdriver.
 */
export interface StaffOverheadItem {
  employeeId: string;
  name: string;
  jobTitle: string | null;
  workedHours: number;
  totalSalary: number;
  isHourlyBased: boolean;
  hasBasis: boolean;
}

export interface UseMonthlyOverheadResult {
  /** Stab-teamets udgifter i perioden */
  stabExpenses: number;
  /** Stabslønninger (inkl. feriepenge) i perioden */
  staffSalaries: number;
  total: number;
  staffList: StaffOverheadItem[];
  /** Antal stabsmedarbejdere hvor lønnen ikke kunne beregnes */
  staffMissingBasisCount: number;
  isLoading: boolean;
}

export interface UseMonthlyOverheadParams {
  periodStart: Date;
  periodEnd: Date;
  /** true når perioden er en hel måned/lønperiode (faste udgifter tælles fuldt) */
  isFullPeriod?: boolean;
  enabled?: boolean;
}

export function useMonthlyOverhead({
  periodStart,
  periodEnd,
  isFullPeriod = false,
  enabled = true,
}: UseMonthlyOverheadParams): UseMonthlyOverheadResult {
  const { settings, fingerprint, isLoading: settingsLoading } = useCalculationSettings();
  const useNewAssignments = useFeatureFlag("employee_client_assignments");
  const stabTeamId = settings.stabTeamId;

  const { data: stabExpenses, isLoading: expensesLoading } = useQuery({
    queryKey: [
      "monthly-overhead",
      "stab-expenses",
      stabTeamId,
      periodStart.toISOString(),
      periodEnd.toISOString(),
      isFullPeriod,
      fingerprint,
    ],
    queryFn: async () => {
      if (!stabTeamId) return 0;
      const { data, error } = await supabase
        .from("team_expenses")
        .select("amount, expense_date, all_days, is_recurring")
        .eq("team_id", stabTeamId);
      if (error) throw error;

      const workdaysInPeriod = countWorkDaysInPeriod(periodStart, periodEnd);
      const factor = isFullPeriod
        ? 1
        : calcProrationFactor(workdaysInPeriod, settings.workdaysPerMonth);

      let total = 0;
      for (const expense of data ?? []) {
        const amount = Number(expense.amount) || 0;
        if (expense.is_recurring || expense.all_days) {
          total += amount * factor;
        } else if (expense.expense_date) {
          const expenseDate = new Date(expense.expense_date);
          if (expenseDate >= periodStart && expenseDate <= periodEnd) total += amount;
        }
      }
      return total;
    },
    enabled: enabled && !settingsLoading,
  });

  const { data: staffEmployees } = useQuery({
    queryKey: ["staff-employees-for-overhead"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_salaries")
        .select("employee_id, employee:employee_master_data(first_name, last_name, job_title)")
        .eq("salary_type", "staff")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });

  const staffIds = useMemo(
    () => (staffEmployees ?? []).map((s) => s.employee_id),
    [staffEmployees]
  );

  const { data: staffHours, isLoading: staffLoading } = useStaffHoursCalculation(
    periodStart,
    periodEnd,
    staffIds,
    useNewAssignments
  );

  const staffList = useMemo<StaffOverheadItem[]>(() => {
    if (!staffHours || !staffEmployees) return [];
    return staffEmployees
      .map((staff) => {
        const hours = staffHours[staff.employee_id];
        if (!hours) return null;
        const employee = staff.employee as {
          first_name: string | null;
          last_name: string | null;
          job_title: string | null;
        } | null;
        return {
          employeeId: staff.employee_id,
          name: employee
            ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
            : "Ukendt",
          jobTitle: employee?.job_title ?? null,
          workedHours: hours.workedHours,
          totalSalary: hours.totalSalary,
          isHourlyBased: hours.isHourlyBased,
          hasBasis: hours.hasBasis,
        } satisfies StaffOverheadItem;
      })
      .filter((item): item is StaffOverheadItem => item !== null);
  }, [staffHours, staffEmployees]);

  const staffSalaries = useMemo(
    () => staffList.reduce((sum, s) => sum + s.totalSalary, 0),
    [staffList]
  );

  const stabExpenseAmount = stabExpenses ?? 0;

  return {
    stabExpenses: stabExpenseAmount,
    staffSalaries,
    total: stabExpenseAmount + staffSalaries,
    staffList,
    staffMissingBasisCount: staffList.filter((s) => !s.hasBasis).length,
    isLoading: settingsLoading || expensesLoading || staffLoading,
  };
}
