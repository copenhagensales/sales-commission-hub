import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface SellerData {
  id: string;
  name: string;
  team: string;
  teamId: string | null;
  commission: number;
  cancellations: number;
  vacationType: "vacation_pay" | "vacation_bonus" | null;
  vacationPay: number;
  diet: number;
  sickDays: number;
  dailyBonus: number;
  referralBonus: number;
}

interface UseSellerSalariesCachedResult {
  sellerData: SellerData[];
  isLoading: boolean;
  lastUpdated: Date | null;
}

export function useSellerSalariesCached(
  selectedTeam?: string | null,
  periodStart?: Date | null,
  periodEnd?: Date | null
): UseSellerSalariesCachedResult {
  const periodStartISO = periodStart ? periodStart.toISOString().split("T")[0] : null;
  const periodEndISO = periodEnd ? periodEnd.toISOString().split("T")[0] : null;

  // Query 1: Get all active non-staff employees with team info, vacation_type, and referral_bonus
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["seller-employees-cached"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("employee_master_data") as any)
        .select(`
          id, 
          first_name, 
          last_name,
          vacation_type,
          referral_bonus,
          team_members!left(
            team_id,
            teams!left(id, name)
          )
        `)
        .eq("is_active", true)
        .eq("is_staff_employee", false);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Query 2: Get cached KPI values for all employees (payroll_period)
  const { data: cachedKpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["seller-kpis-payroll-cached"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_cached_values")
        .select("kpi_slug, scope_id, value, calculated_at")
        .eq("scope_type", "employee")
        .eq("period_type", "payroll_period")
        .in("kpi_slug", ["total_commission"]);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Query 3: Get Feriepenge salary type rates
  const { data: salaryTypes, isLoading: salaryTypesLoading } = useQuery({
    queryKey: ["feriepenge-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_types")
        .select("description, amount")
        .eq("name", "Feriepenge")
        .eq("is_active", true);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 300000,
  });

  // Query 4: Diet (booking_diet) for the period
  const { data: dietData, isLoading: dietLoading } = useQuery({
    queryKey: ["seller-diet", periodStartISO, periodEndISO],
    queryFn: async () => {
      if (!periodStartISO || !periodEndISO) return [];
      const { data, error } = await supabase
        .from("booking_diet")
        .select("employee_id, amount")
        .gte("date", periodStartISO)
        .lte("date", periodEndISO);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!periodStartISO && !!periodEndISO,
    staleTime: 60000,
  });

  // Query 5: Sick days (absence_request_v2) for the period
  const { data: sickData, isLoading: sickLoading } = useQuery({
    queryKey: ["seller-sick-days", periodStartISO, periodEndISO],
    queryFn: async () => {
      if (!periodStartISO || !periodEndISO) return [];
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select("employee_id, start_date, end_date")
        .eq("status", "approved")
        .eq("type", "sick")
        .gte("start_date", periodStartISO)
        .lte("start_date", periodEndISO);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!periodStartISO && !!periodEndISO,
    staleTime: 60000,
  });

  // Query 6: Daily bonus payouts for the period
  const { data: dailyBonusData, isLoading: dailyBonusLoading } = useQuery({
    queryKey: ["seller-daily-bonus", periodStartISO, periodEndISO],
    queryFn: async () => {
      if (!periodStartISO || !periodEndISO) return [];
      const { data, error } = await supabase
        .from("daily_bonus_payouts")
        .select("employee_id, amount")
        .gte("date", periodStartISO)
        .lte("date", periodEndISO);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!periodStartISO && !!periodEndISO,
    staleTime: 60000,
  });

  // Helper to find the correct vacation pay rate based on vacation type
  const getVacationPayRate = (vacationType: string | null): number => {
    if (!vacationType || !salaryTypes) return 0;
    
    const matchingType = salaryTypes.find(st => {
      const desc = st.description?.toLowerCase() || "";
      if (vacationType === "vacation_pay") {
        return desc.includes("medarbejder");
      } else if (vacationType === "vacation_bonus") {
        return desc.includes("betalt ferie");
      }
      return false;
    });
    
    return matchingType?.amount ? matchingType.amount / 100 : 0;
  };

  // Combine employees with their cached KPI values
  const { sellerData, lastUpdated } = useMemo(() => {
    if (!employees) {
      return { sellerData: [], lastUpdated: null };
    }

    // Build KPI map
    const kpiMap: Record<string, { commission: number }> = {};
    let latestCalculatedAt: Date | null = null;

    for (const kpi of cachedKpis || []) {
      if (!kpi.scope_id) continue;
      if (!kpiMap[kpi.scope_id]) {
        kpiMap[kpi.scope_id] = { commission: 0 };
      }
      if (kpi.kpi_slug === "total_commission") {
        kpiMap[kpi.scope_id].commission = kpi.value || 0;
      }
      if (kpi.calculated_at) {
        const calcDate = new Date(kpi.calculated_at);
        if (!latestCalculatedAt || calcDate > latestCalculatedAt) {
          latestCalculatedAt = calcDate;
        }
      }
    }

    // Build diet map: employee_id -> total amount
    const dietMap: Record<string, number> = {};
    for (const d of dietData || []) {
      dietMap[d.employee_id] = (dietMap[d.employee_id] || 0) + (d.amount || 0);
    }

    // Build sick days map: employee_id -> count of sick entries
    const sickMap: Record<string, number> = {};
    for (const s of sickData || []) {
      sickMap[s.employee_id] = (sickMap[s.employee_id] || 0) + 1;
    }

    // Build daily bonus map: employee_id -> total amount
    const dailyBonusMap: Record<string, number> = {};
    for (const db of dailyBonusData || []) {
      dailyBonusMap[db.employee_id] = (dailyBonusMap[db.employee_id] || 0) + (db.amount || 0);
    }

    // Filter by team if needed
    let filteredEmployees = employees;
    if (selectedTeam && selectedTeam !== "all") {
      filteredEmployees = employees.filter((e: any) =>
        e.team_members?.some((tm: any) => tm.team_id === selectedTeam)
      );
    }

    // Map employees to seller data
    const sellers: SellerData[] = filteredEmployees.map((emp: any) => {
      const teamMember = emp.team_members?.[0];
      const teamData = teamMember?.teams;
      const kpis = kpiMap[emp.id] || { commission: 0 };
      const vacationType = emp.vacation_type as "vacation_pay" | "vacation_bonus" | null;
      const vacationRate = getVacationPayRate(vacationType);
      const vacationPay = kpis.commission * vacationRate;

      return {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        team: teamData?.name || "Ikke tildelt",
        teamId: teamMember?.team_id || null,
        commission: kpis.commission,
        cancellations: 0,
        vacationType,
        vacationPay,
        diet: dietMap[emp.id] || 0,
        sickDays: sickMap[emp.id] || 0,
        dailyBonus: dailyBonusMap[emp.id] || 0,
        referralBonus: emp.referral_bonus || 0,
      };
    });

    sellers.sort((a, b) => b.commission - a.commission);

    return { sellerData: sellers, lastUpdated: latestCalculatedAt };
  }, [employees, cachedKpis, selectedTeam, salaryTypes, dietData, sickData, dailyBonusData]);

  return {
    sellerData,
    isLoading: employeesLoading || kpisLoading || salaryTypesLoading || dietLoading || sickLoading || dailyBonusLoading,
    lastUpdated,
  };
}
