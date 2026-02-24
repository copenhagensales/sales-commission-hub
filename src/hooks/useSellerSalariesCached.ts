import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { fetchAllRows } from "@/utils/supabasePagination";

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
  isActive: boolean;
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

  // Query 1: Get all non-staff employees (active + inactive) with team info
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["seller-employees-cached"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("employee_master_data") as any)
        .select(`
          id, 
          first_name, 
          last_name,
          is_active,
          vacation_type,
          referral_bonus,
          team_members!left(
            team_id,
            teams!left(id, name)
          )
        `)
        .eq("is_staff_employee", false);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Query 2: Get employee_agent_mapping with agent emails
  const { data: agentMappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ["seller-agent-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id, agents(email)");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Query 3: Get sales with mapped_commission for the period
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["seller-sales-commission", periodStartISO, periodEndISO],
    queryFn: async () => {
      if (!periodStartISO || !periodEndISO) return [];
      
      const periodStartDT = `${periodStartISO}T00:00:00`;
      const periodEndDT = `${periodEndISO}T23:59:59`;
      
      return await fetchAllRows<any>(
        "sales",
        "id, agent_email, sale_datetime, status, sale_items(mapped_commission)",
        (q) => q
          .gte("sale_datetime", periodStartDT)
          .lte("sale_datetime", periodEndDT)
          .neq("status", "rejected"),
        { orderBy: "sale_datetime", ascending: false }
      );
    },
    enabled: !!periodStartISO && !!periodEndISO,
    staleTime: 60000,
  });

  // Query 4: Feriepenge salary type rates
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

  // Query 5: Diet (booking_diet) for the period
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

  // Query 6: Sick days (absence_request_v2) for the period
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

  // Query 7: Daily bonus payouts for the period
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

  // Combine employees with their sales data
  const { sellerData, lastUpdated } = useMemo(() => {
    if (!employees) {
      return { sellerData: [], lastUpdated: null };
    }

    // Build email -> employee_id map from agent mappings
    const emailToEmployeeId: Record<string, string> = {};
    for (const mapping of agentMappings || []) {
      const email = (mapping as any).agents?.email;
      if (email && mapping.employee_id) {
        emailToEmployeeId[email.toLowerCase()] = mapping.employee_id;
      }
    }

    // Build commission map from sales data: employee_id -> total commission
    const commissionMap: Record<string, number> = {};
    for (const sale of salesData || []) {
      const agentEmail = sale.agent_email?.toLowerCase();
      if (!agentEmail) continue;
      const employeeId = emailToEmployeeId[agentEmail];
      if (!employeeId) continue;
      
      const saleCommission = (sale.sale_items || []).reduce(
        (sum: number, item: any) => sum + (item.mapped_commission || 0), 0
      );
      commissionMap[employeeId] = (commissionMap[employeeId] || 0) + saleCommission;
    }

    // Build diet map
    const dietMap: Record<string, number> = {};
    for (const d of dietData || []) {
      dietMap[d.employee_id] = (dietMap[d.employee_id] || 0) + (d.amount || 0);
    }

    // Build sick days map
    const sickMap: Record<string, number> = {};
    for (const s of sickData || []) {
      sickMap[s.employee_id] = (sickMap[s.employee_id] || 0) + 1;
    }

    // Build daily bonus map
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
      const commission = commissionMap[emp.id] || 0;
      const vacationType = emp.vacation_type as "vacation_pay" | "vacation_bonus" | null;
      const vacationRate = getVacationPayRate(vacationType);
      const vacationPay = commission * vacationRate;

      return {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        team: teamData?.name || "Ikke tildelt",
        teamId: teamMember?.team_id || null,
        commission,
        cancellations: 0,
        vacationType,
        vacationPay,
        diet: dietMap[emp.id] || 0,
        sickDays: sickMap[emp.id] || 0,
        dailyBonus: dailyBonusMap[emp.id] || 0,
        referralBonus: emp.referral_bonus || 0,
        isActive: emp.is_active ?? true,
      };
    });

    sellers.sort((a, b) => b.commission - a.commission);

    return { sellerData: sellers, lastUpdated: new Date() };
  }, [employees, agentMappings, salesData, selectedTeam, salaryTypes, dietData, sickData, dailyBonusData]);

  return {
    sellerData,
    isLoading: employeesLoading || mappingsLoading || salesLoading || salaryTypesLoading || dietLoading || sickLoading || dailyBonusLoading,
    lastUpdated,
  };
}
