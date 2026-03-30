import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { useSalesAggregatesExtended } from "@/hooks/useSalesAggregatesExtended";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface SalaryAdditionItem {
  id: string;
  amount: number;
  note: string | null;
}

export interface SalaryAdditionsMap {
  [columnKey: string]: { total: number; items: SalaryAdditionItem[] };
}

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
  startupBonus: number;
  referralBonus: number;
  isActive: boolean;
  isFreelanceConsultant: boolean;
  salaryAdditions: SalaryAdditionsMap;
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
  const periodStartISO = periodStart ? toLocalDateString(periodStart) : null;
  const periodEndISO = periodEnd ? toLocalDateString(periodEnd) : null;

  // Query 1: Get all non-staff employees with team info
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["seller-employees-cached"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("employee_master_data") as any)
        .select(`
          id, 
          first_name, 
          last_name,
          work_email,
          is_active,
          is_freelance_consultant,
          vacation_type,
          referral_bonus,
          last_team_id,
          last_team:last_team_id(id, name),
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

  // Query 2: Live commission via useSalesAggregatesExtended (replaces KPI cache)
  const { data: salesAggregates, isLoading: commissionLoading } = useSalesAggregatesExtended({
    periodStart: periodStart ?? new Date(),
    periodEnd: periodEnd ?? new Date(),
    groupBy: ['employee'],
    enabled: !!periodStart && !!periodEnd,
  });

  // Query 3: Feriepenge salary type rates
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

  // Query 3b: Fetch training bonus salary_type_id to separate it from diet
  const { data: trainingBonusSalaryType } = useQuery({
    queryKey: ["training-bonus-salary-type"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_types")
        .select("id")
        .ilike("name", "%oplæringsbonus%")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 300000,
  });

  const trainingBonusTypeId = trainingBonusSalaryType?.id;

  // Query 4: Diet (booking_diet) for the period — excludes training bonus rows
  const { data: dietData, isLoading: dietLoading } = useQuery({
    queryKey: ["seller-diet", periodStartISO, periodEndISO, trainingBonusTypeId],
    queryFn: async () => {
      if (!periodStartISO || !periodEndISO) return [];
      let query = supabase
        .from("booking_diet")
        .select("employee_id, amount")
        .gte("date", periodStartISO)
        .lte("date", periodEndISO);
      
      if (trainingBonusTypeId) {
        query = query.neq("salary_type_id", trainingBonusTypeId);
      }
      
      const { data, error } = await query;
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

  // Query 6b: Training/startup bonus from booking_diet filtered by oplæringsbonus salary_type
  const { data: startupBonusData, isLoading: startupBonusLoading } = useQuery({
    queryKey: ["seller-startup-bonus", periodStartISO, periodEndISO, trainingBonusTypeId],
    queryFn: async () => {
      if (!periodStartISO || !periodEndISO || !trainingBonusTypeId) return [];
      const { data, error } = await supabase
        .from("booking_diet")
        .select("employee_id, amount")
        .eq("salary_type_id", trainingBonusTypeId)
        .gte("date", periodStartISO)
        .lte("date", periodEndISO);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!periodStartISO && !!periodEndISO && !!trainingBonusTypeId,
    staleTime: 60000,
  });

  // Query 7: Salary additions for the period
  const { data: salaryAdditionsData, isLoading: salaryAdditionsLoading } = useQuery({
    queryKey: ["salary-additions", periodStartISO, periodEndISO],
    queryFn: async () => {
      if (!periodStartISO || !periodEndISO) return [];
      const { data, error } = await (supabase
        .from("salary_additions") as any)
        .select("id, employee_id, column_key, amount, note")
        .eq("period_start", periodStartISO)
        .eq("period_end", periodEndISO);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!periodStartISO && !!periodEndISO,
    staleTime: 30000,
  });

  // Query 8: Approved cancellations for the period (deduction_date within period)
  // Excludes correct_match rows and paginates to avoid 1000-row limit
  const { data: cancellationData, isLoading: cancellationLoading } = useQuery({
    queryKey: ["seller-cancellations", periodStartISO, periodEndISO],
    queryFn: async () => {
      if (!periodStartISO || !periodEndISO) return [];
      const PAGE_SIZE = 500;
      let allData: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await (supabase
          .from("cancellation_queue") as any)
          .select(`
            id,
            upload_type,
            deduction_date,
            reviewed_at,
            sale_id,
            sales!inner(
              agent_email,
              sale_items(mapped_commission)
            )
          `)
          .eq("status", "approved")
          .in("upload_type", ["cancellation", "basket_difference"])
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      
      // Filter by deduction_date (fallback to reviewed_at) within period
      return allData.filter((item: any) => {
        const effectiveDate = item.deduction_date || (item.reviewed_at ? item.reviewed_at.split('T')[0] : null);
        if (!effectiveDate) return false;
        return effectiveDate >= periodStartISO && effectiveDate <= periodEndISO;
      });
    },
    enabled: !!periodStartISO && !!periodEndISO,
    staleTime: 60000,
  });

  // Query 9: Product change log for basket_difference commission differences
  const basketDiffIds = useMemo(() => {
    if (!cancellationData) return [];
    return cancellationData
      .filter((c: any) => c.upload_type === "basket_difference")
      .map((c: any) => c.id);
  }, [cancellationData]);

  const { data: productChangeLogData, isLoading: changeLogLoading } = useQuery({
    queryKey: ["product-change-log-basket", basketDiffIds],
    queryFn: async () => {
      if (basketDiffIds.length === 0) return [];
      // Fetch in batches if needed (Supabase .in() limit)
      const BATCH = 100;
      let allLogs: any[] = [];
      for (let i = 0; i < basketDiffIds.length; i += BATCH) {
        const batch = basketDiffIds.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("product_change_log")
          .select("cancellation_queue_id, old_commission, new_commission")
          .in("cancellation_queue_id", batch)
          .is("rolled_back_at", null);
        if (error) throw error;
        if (data) allLogs = allLogs.concat(data);
      }
      return allLogs;
    },
    enabled: basketDiffIds.length > 0,
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

  // Combine employees with their live commission data
  const { sellerData, lastUpdated } = useMemo(() => {
    if (!employees) {
      return { sellerData: [], lastUpdated: null };
    }

    // Build work_email -> employee_id lookup for FM fallback
    const emailToEmployeeId: Record<string, string> = {};
    for (const emp of employees) {
      if (emp.work_email) {
        emailToEmployeeId[emp.work_email.toLowerCase()] = emp.id;
      }
    }

    // Build commission map from live sales aggregates
    // Keys can be UUID (mapped employees) or email (unmapped FM employees)
    const commissionMap: Record<string, number> = {};
    if (salesAggregates?.byEmployee) {
      for (const [key, empData] of Object.entries(salesAggregates.byEmployee)) {
        const employeeId = emailToEmployeeId[key.toLowerCase()] || key;
        commissionMap[employeeId] = (commissionMap[employeeId] || 0) + empData.commission;
      }
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

    // Build startup bonus map
    const startupBonusMap: Record<string, number> = {};
    for (const sb of startupBonusData || []) {
      startupBonusMap[sb.employee_id] = (startupBonusMap[sb.employee_id] || 0) + (sb.amount || 0);
    }

    // Build product change log lookup: cancellation_queue_id → commission difference
    const basketDiffMap: Record<string, number> = {};
    for (const log of productChangeLogData || []) {
      const cqId = log.cancellation_queue_id;
      if (!cqId) continue;
      const diff = (log.old_commission || 0) - (log.new_commission || 0);
      basketDiffMap[cqId] = (basketDiffMap[cqId] || 0) + diff;
    }

    // Build cancellation map (agent_email → employee_id → total lost commission)
    const cancellationMap: Record<string, number> = {};
    for (const cq of cancellationData || []) {
      const sale = cq.sales;
      if (!sale?.agent_email) continue;
      const agentEmail = sale.agent_email.toLowerCase();
      const employeeId = emailToEmployeeId[agentEmail];
      if (!employeeId) continue;

      let deduction = 0;
      if (cq.upload_type === "basket_difference") {
        // Use commission difference from product_change_log
        deduction = basketDiffMap[cq.id] || 0;
      } else {
        // Full cancellation — deduct entire commission
        deduction = (sale.sale_items || []).reduce(
          (sum: number, si: any) => sum + (si.mapped_commission || 0), 0
        );
      }
      if (deduction > 0) {
        cancellationMap[employeeId] = (cancellationMap[employeeId] || 0) + deduction;
      }
    }

    // Build salary additions map with individual items for display/delete
    const additionsMap: Record<string, Record<string, number>> = {};
    const additionsDetailMap: Record<string, SalaryAdditionsMap> = {};
    for (const sa of salaryAdditionsData || []) {
      if (!additionsMap[sa.employee_id]) additionsMap[sa.employee_id] = {};
      additionsMap[sa.employee_id][sa.column_key] = (additionsMap[sa.employee_id][sa.column_key] || 0) + Number(sa.amount);

      if (!additionsDetailMap[sa.employee_id]) additionsDetailMap[sa.employee_id] = {};
      if (!additionsDetailMap[sa.employee_id][sa.column_key]) {
        additionsDetailMap[sa.employee_id][sa.column_key] = { total: 0, items: [] };
      }
      additionsDetailMap[sa.employee_id][sa.column_key].total += Number(sa.amount);
      additionsDetailMap[sa.employee_id][sa.column_key].items.push({
        id: sa.id,
        amount: Number(sa.amount),
        note: sa.note || null,
      });
    }

    // Filter by team if needed
    let filteredEmployees = employees;
    if (selectedTeam && selectedTeam !== "all") {
      filteredEmployees = employees.filter((e: any) =>
        e.team_members?.some((tm: any) => tm.team_id === selectedTeam) ||
        e.last_team_id === selectedTeam
      );
    }

    // Map employees to seller data
    const sellers: SellerData[] = filteredEmployees.map((emp: any) => {
      const teamMember = emp.team_members?.[0];
      const teamData = teamMember?.teams;
      const teamName = teamData?.name || emp.last_team?.name || "Ikke tildelt";
      const teamId = teamMember?.team_id || emp.last_team_id || null;
      const adds = additionsMap[emp.id] || {};
      const commission = (commissionMap[emp.id] || 0) + (adds?.commission || 0);
      const vacationType = emp.vacation_type as "vacation_pay" | "vacation_bonus" | null;
      const vacationRate = getVacationPayRate(vacationType);
      const vacationPay = commission * vacationRate + (adds?.vacationPay || 0);

      return {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        team: teamName,
        teamId: teamId,
        commission,
        cancellations: (cancellationMap[emp.id] || 0) + (adds?.cancellations || 0),
        vacationType,
        vacationPay,
        diet: (dietMap[emp.id] || 0) + (adds?.diet || 0),
        sickDays: (sickMap[emp.id] || 0) + (adds?.sickDays || 0),
        dailyBonus: (dailyBonusMap[emp.id] || 0) + (adds?.dailyBonus || 0),
        startupBonus: (startupBonusMap[emp.id] || 0) + (adds?.startupBonus || 0),
        referralBonus: (emp.referral_bonus || 0) + (adds?.referralBonus || 0),
        isActive: emp.is_active ?? true,
        isFreelanceConsultant: emp.is_freelance_consultant ?? false,
        salaryAdditions: additionsDetailMap[emp.id] || {},
      };
    });

    sellers.sort((a, b) => b.commission - a.commission);

    return { sellerData: sellers, lastUpdated: new Date() };
  }, [employees, salesAggregates, selectedTeam, salaryTypes, dietData, sickData, dailyBonusData, startupBonusData, cancellationData, productChangeLogData, salaryAdditionsData]);

  return {
    sellerData,
    isLoading: employeesLoading || commissionLoading || salaryTypesLoading || dietLoading || sickLoading || dailyBonusLoading || startupBonusLoading || cancellationLoading || changeLogLoading || salaryAdditionsLoading,
    lastUpdated,
  };
}
