import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { Users, TrendingUp, Target, Activity, Trophy, Medal, UserPlus, CalendarDays, HeartPulse } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TopSeller {
  name: string;
  commission: number;
  rank: number;
}

interface RecentSale {
  id: string;
  agent_name: string;
  sale_datetime: string;
  status: string | null;
  client_name: string;
  commission?: number;
}

interface TvDashboardData {
  date: string;
  timestamp: string;
  sales: {
    total: number;
    confirmed: number;
    pending: number;
    byClient: Record<string, { count: number; logoUrl: string | null }>;
    recent: RecentSale[];
  };
  employees: {
    active: number;
    staff: number;
  };
  calls: {
    today: number;
  };
  sellersOnBoard: number;
  topSellers: TopSeller[];
  clientLogos?: Record<string, string | null>;
}

// Check if we're in TV mode (accessed via /tv route with sessionStorage code)
const isTvMode = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/tv/') || sessionStorage.getItem('tv_board_code') !== null;
};

export default function CphSalesDashboard() {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tvMode = isTvMode();

  // Use edge function for TV mode (bypasses RLS)
  const { data: tvData } = useQuery<TvDashboardData>({
    queryKey: ["tv-dashboard-data", todayStr],
    queryFn: async () => {
      const response = await supabase.functions.invoke('tv-dashboard-data', {
        body: null,
        method: 'GET',
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: tvMode,
    refetchInterval: 30000,
  });

  // Fetch candidates for recruitment KPI (only in non-TV mode)
  const { data: candidates = [] } = useQuery({
    queryKey: ["cph-dashboard-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, created_at")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !tvMode,
    refetchInterval: 60000,
  });

  // Fetch upcoming cohorts and starters (only in non-TV mode)
  const { data: upcomingCohortsData } = useQuery({
    queryKey: ["cph-dashboard-upcoming-cohorts"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Get upcoming/active cohorts
      const { data: cohorts, error: cohortsError } = await supabase
        .from("onboarding_cohorts")
        .select("id, name, start_date, status")
        .in("status", ["planned", "in_progress"])
        .gte("start_date", today)
        .order("start_date", { ascending: true });
      
      if (cohortsError) throw cohortsError;

      // Get total members in upcoming cohorts
      let totalMembers = 0;
      if (cohorts && cohorts.length > 0) {
        const cohortIds = cohorts.map(c => c.id);
        const { count } = await supabase
          .from("cohort_members")
          .select("id", { count: "exact", head: true })
          .in("cohort_id", cohortIds)
          .in("status", ["assigned", "confirmed"]);
        
        totalMembers = count || 0;
      }

      // Get unassigned hired candidates
      const { count: unassignedCount } = await supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("status", "hired")
        .not("cohort_assignment_status", "eq", "assigned");

      return {
        cohortCount: cohorts?.length || 0,
        memberCount: totalMembers,
        unassignedCount: unassignedCount || 0,
      };
    },
    enabled: !tvMode,
    refetchInterval: 60000,
  });

  // Calculate recruitment KPIs
  const recruitmentKpis = useMemo(() => {
    const now = new Date();
    
    // Last 24 hours
    const last24h = candidates.filter(c => new Date(c.created_at) >= subDays(now, 1)).length;
    const prev24h = candidates.filter(c => {
      const created = new Date(c.created_at);
      return created >= subDays(now, 2) && created < subDays(now, 1);
    }).length;
    const trend24h = prev24h > 0 ? Math.round(((last24h - prev24h) / prev24h) * 100) : last24h > 0 ? 100 : 0;

    // Last 7 days
    const last7d = candidates.filter(c => new Date(c.created_at) >= subDays(now, 7)).length;
    const prev7d = candidates.filter(c => {
      const created = new Date(c.created_at);
      return created >= subDays(now, 14) && created < subDays(now, 7);
    }).length;
    const trend7d = prev7d > 0 ? Math.round(((last7d - prev7d) / prev7d) * 100) : last7d > 0 ? 100 : 0;

    return { last24h, trend24h, last7d, trend7d };
  }, [candidates]);

  // Regular authenticated queries for non-TV mode
  const { data: todaySalesData } = useQuery({
    queryKey: ["cph-dashboard-today-sales", todayStr],
    queryFn: async () => {
      const startOfDay = `${todayStr}T00:00:00`;
      const endOfDay = `${todayStr}T23:59:59`;
      
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id, agent_name, sale_datetime, status, client_campaign_id,
          sale_items (
            quantity,
            product_id,
            mapped_commission,
            products (counts_as_sale)
          )
        `)
        .gte("sale_datetime", startOfDay)
        .lte("sale_datetime", endOfDay)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const campaignIds = [...new Set((data || []).map(s => s.client_campaign_id).filter(Boolean))] as string[];
      let campaignClientMap: Record<string, string> = {};
      let clientLogoMap: Record<string, string | null> = {};
      
      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id, name, client_id")
          .in("id", campaignIds);
        
        const clientIds = [...new Set((campaigns || []).map(c => c.client_id).filter(Boolean))];
        let clientMap: Record<string, string> = {};
        
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name, logo_url")
            .in("id", clientIds);
          clientMap = Object.fromEntries((clients || []).map(c => [c.id, c.name]));
          clientLogoMap = Object.fromEntries((clients || []).map(c => [c.name, c.logo_url]));
        }
        
        campaignClientMap = Object.fromEntries(
          (campaigns || []).map(c => [c.id, clientMap[c.client_id] || "Ukendt"])
        );
      }
      
      return {
        sales: (data || []).map(s => ({
          ...s,
          client_name: s.client_campaign_id ? campaignClientMap[s.client_campaign_id] || "Ukendt" : "Ukendt"
        })),
        clientLogos: clientLogoMap
      };
    },
    enabled: !tvMode,
    refetchInterval: 30000,
  });

  const todaySales = todaySalesData?.sales || [];
  const clientLogos = todaySalesData?.clientLogos || {};

  // Fetch active employees count for display
  const { data: activeEmployees = 0 } = useQuery({
    queryKey: ["cph-dashboard-active-employees"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_master_data")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_staff_employee", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !tvMode,
    refetchInterval: 60000,
  });

  // Fetch absence data for today (sick & vacation) with team info
  const { data: absenceData } = useQuery({
    queryKey: ["cph-dashboard-absences", todayStr],
    queryFn: async () => {
      // Get today's absences
      const { data: absences, error: absError } = await supabase
        .from("absence_request_v2")
        .select("employee_id, type, start_date, end_date")
        .eq("status", "approved")
        .lte("start_date", todayStr)
        .gte("end_date", todayStr);
      
      if (absError) throw absError;

      // Get team_clients mapping
      const { data: teamClients } = await supabase
        .from("team_clients")
        .select("team_id, client_id, clients(name)");

      // Get team_members for employee-team mapping
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("employee_id, team_id");

      // Get active employee count per team
      const { data: activeByTeam } = await supabase
        .from("team_members")
        .select("team_id, employee:employee_master_data!inner(id, is_active, is_staff_employee)")
        .eq("employee.is_active", true)
        .eq("employee.is_staff_employee", false);

      // Build team -> client name map
      const teamToClient: Record<string, string> = {};
      (teamClients || []).forEach((tc: any) => {
        if (tc.clients?.name) {
          teamToClient[tc.team_id] = tc.clients.name;
        }
      });

      // Build employee -> team map
      const employeeToTeam: Record<string, string> = {};
      (teamMembers || []).forEach((tm: any) => {
        employeeToTeam[tm.employee_id] = tm.team_id;
      });

      // Count employees per team
      const employeesPerTeam: Record<string, number> = {};
      (activeByTeam || []).forEach((tm: any) => {
        employeesPerTeam[tm.team_id] = (employeesPerTeam[tm.team_id] || 0) + 1;
      });

      // Calculate absence counts by type
      const sickToday = (absences || []).filter(a => a.type === "sick");
      const vacationToday = (absences || []).filter(a => a.type === "vacation");
      const noShowToday = (absences || []).filter(a => a.type === "no_show");

      // Calculate absence counts per client
      const sickByClient: Record<string, number> = {};
      const vacationByClient: Record<string, number> = {};
      const noShowByClient: Record<string, number> = {};
      const employeeCountByClient: Record<string, number> = {};

      // Map teams to clients for employee counts
      (teamClients || []).forEach((tc: any) => {
        const clientName = tc.clients?.name;
        if (clientName && employeesPerTeam[tc.team_id]) {
          employeeCountByClient[clientName] = (employeeCountByClient[clientName] || 0) + employeesPerTeam[tc.team_id];
        }
      });

      // Map absences to clients by type
      sickToday.forEach(absence => {
        const teamId = employeeToTeam[absence.employee_id];
        if (teamId) {
          const clientName = teamToClient[teamId];
          if (clientName) {
            sickByClient[clientName] = (sickByClient[clientName] || 0) + 1;
          }
        }
      });

      vacationToday.forEach(absence => {
        const teamId = employeeToTeam[absence.employee_id];
        if (teamId) {
          const clientName = teamToClient[teamId];
          if (clientName) {
            vacationByClient[clientName] = (vacationByClient[clientName] || 0) + 1;
          }
        }
      });

      noShowToday.forEach(absence => {
        const teamId = employeeToTeam[absence.employee_id];
        if (teamId) {
          const clientName = teamToClient[teamId];
          if (clientName) {
            noShowByClient[clientName] = (noShowByClient[clientName] || 0) + 1;
          }
        }
      });

      return {
        sickCount: sickToday.length,
        vacationCount: vacationToday.length,
        noShowCount: noShowToday.length,
        totalAbsent: (absences || []).length,
        sickByClient,
        vacationByClient,
        noShowByClient,
        employeeCountByClient,
      };
    },
    enabled: !tvMode,
    refetchInterval: 60000,
  });

  // Team Performance Overview - data for day, week, month
  const { data: teamPerformanceData } = useQuery({
    queryKey: ["cph-dashboard-team-performance", todayStr],
    queryFn: async (): Promise<Array<{
      id: string;
      name: string;
      employeeCount: number;
      sales: { day: number; week: number; month: number };
      sick: { day: number; week: number; month: number };
      vacation: { day: number; week: number; month: number };
    }>> => {
      const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(today), "yyyy-MM-dd");

      // Get teams (exclude Stab) - use any to avoid deep type issues
      const teamsQuery = supabase.from("teams").select("id, name");
      const teamsResult = await (teamsQuery as any);
      const teams = ((teamsResult.data as any[]) || []).filter((t: any) => t.name !== "Stab");

      if (teams.length === 0) return [];

      // Get team_members for employee-team mapping
      const teamMembersQuery = supabase.from("team_members").select("employee_id, team_id");
      const teamMembersResult = await teamMembersQuery;
      const teamMembers = (teamMembersResult.data as any[]) || [];

      // Get employee_agent_mapping for sales matching
      const agentMappingsQuery = supabase.from("employee_agent_mapping").select("employee_id, agent_email, agent_name");
      const agentMappingsResult = await agentMappingsQuery;
      const agentMappings = (agentMappingsResult.data as any[]) || [];

      // Get sales for the month (to filter day/week/month)
      const salesQuery = supabase
        .from("sales")
        .select("id, agent_name, agent_email, sale_datetime")
        .gte("sale_datetime", `${monthStart}T00:00:00`)
        .lte("sale_datetime", `${todayStr}T23:59:59`);
      const salesResult = await salesQuery;
      const salesData = (salesResult.data as any[]) || [];

      // Get sale_items with products for those sales
      const saleIds = salesData.map((s) => s.id);
      let saleItems: any[] = [];
      if (saleIds.length > 0) {
        const saleItemsQuery = supabase
          .from("sale_items")
          .select("sale_id, quantity, product_id, products(counts_as_sale)")
          .in("sale_id", saleIds);
        const saleItemsResult = await saleItemsQuery;
        saleItems = (saleItemsResult.data as any[]) || [];
      }

      // Map sale_items to sales
      const saleItemsBySaleId: Record<string, any[]> = {};
      saleItems.forEach((si) => {
        if (!saleItemsBySaleId[si.sale_id]) saleItemsBySaleId[si.sale_id] = [];
        saleItemsBySaleId[si.sale_id].push(si);
      });

      // Get absences for the month
      const absencesQuery = supabase
        .from("absence_request_v2")
        .select("employee_id, type, start_date, end_date")
        .eq("status", "approved")
        .or(`start_date.lte.${todayStr},end_date.gte.${monthStart}`);
      const absencesResult = await absencesQuery;
      const absences = (absencesResult.data as any[]) || [];

      // Build employee -> team map and count employees per team
      const employeeToTeam: Record<string, string> = {};
      const employeeCountByTeam: Record<string, number> = {};
      teams.forEach(t => { employeeCountByTeam[t.id] = 0; });
      (teamMembers || []).forEach((tm: any) => {
        employeeToTeam[tm.employee_id] = tm.team_id;
        if (employeeCountByTeam[tm.team_id] !== undefined) {
          employeeCountByTeam[tm.team_id]++;
        }
      });

      // Build agent_email/name -> employee_id map
      const agentToEmployee: Record<string, string> = {};
      (agentMappings || []).forEach((am: any) => {
        if (am.agent_email) {
          agentToEmployee[am.agent_email.toLowerCase()] = am.employee_id;
        }
        if (am.agent_name) {
          agentToEmployee[am.agent_name.toLowerCase()] = am.employee_id;
        }
      });

      // Calculate sales per team for day, week, month
      const teamSales: Record<string, { day: number; week: number; month: number }> = {};
      teams.forEach(t => {
        teamSales[t.id] = { day: 0, week: 0, month: 0 };
      });

      (salesData || []).forEach((sale: any) => {
        // Match sale to employee via agent_email or agent_name
        const employeeId = 
          (sale.agent_email && agentToEmployee[sale.agent_email.toLowerCase()]) ||
          (sale.agent_name && agentToEmployee[sale.agent_name.toLowerCase()]);
        
        if (!employeeId) return;
        
        const teamId = employeeToTeam[employeeId];
        if (!teamId || !teamSales[teamId]) return;

        // Count sales (only products with counts_as_sale = true) - use saleItemsBySaleId
        const items = saleItemsBySaleId[sale.id] || [];
        let saleCount = 0;
        for (const item of items) {
          if (item.products?.counts_as_sale === true) {
            saleCount += item.quantity || 1;
          }
        }

        if (saleCount === 0) return;

        const saleDate = sale.sale_datetime.split("T")[0];
        
        // Month (always add)
        teamSales[teamId].month += saleCount;
        
        // Week (if >= weekStart)
        if (saleDate >= weekStart) {
          teamSales[teamId].week += saleCount;
        }
        
        // Day (if == today)
        if (saleDate === todayStr) {
          teamSales[teamId].day += saleCount;
        }
      });

      // Calculate absences per team for day, week, month
      const teamAbsences: Record<string, { 
        sickDay: number; sickWeek: number; sickMonth: number;
        vacationDay: number; vacationWeek: number; vacationMonth: number;
      }> = {};
      teams.forEach(t => {
        teamAbsences[t.id] = { 
          sickDay: 0, sickWeek: 0, sickMonth: 0,
          vacationDay: 0, vacationWeek: 0, vacationMonth: 0
        };
      });

      // Track unique employees per period per team
      const sickByTeamDay: Record<string, Set<string>> = {};
      const sickByTeamWeek: Record<string, Set<string>> = {};
      const sickByTeamMonth: Record<string, Set<string>> = {};
      const vacationByTeamDay: Record<string, Set<string>> = {};
      const vacationByTeamWeek: Record<string, Set<string>> = {};
      const vacationByTeamMonth: Record<string, Set<string>> = {};

      teams.forEach(t => {
        sickByTeamDay[t.id] = new Set();
        sickByTeamWeek[t.id] = new Set();
        sickByTeamMonth[t.id] = new Set();
        vacationByTeamDay[t.id] = new Set();
        vacationByTeamWeek[t.id] = new Set();
        vacationByTeamMonth[t.id] = new Set();
      });

      (absences || []).forEach((absence: any) => {
        const teamId = employeeToTeam[absence.employee_id];
        if (!teamId || !teamAbsences[teamId]) return;

        const isSick = absence.type === "sick";
        const isVacation = absence.type === "vacation";
        if (!isSick && !isVacation) return;

        const startDate = absence.start_date;
        const endDate = absence.end_date;

        // Check if absence overlaps with today
        if (startDate <= todayStr && endDate >= todayStr) {
          if (isSick) sickByTeamDay[teamId].add(absence.employee_id);
          if (isVacation) vacationByTeamDay[teamId].add(absence.employee_id);
        }

        // Check if absence overlaps with this week
        if (startDate <= todayStr && endDate >= weekStart) {
          if (isSick) sickByTeamWeek[teamId].add(absence.employee_id);
          if (isVacation) vacationByTeamWeek[teamId].add(absence.employee_id);
        }

        // Check if absence overlaps with this month
        if (startDate <= todayStr && endDate >= monthStart) {
          if (isSick) sickByTeamMonth[teamId].add(absence.employee_id);
          if (isVacation) vacationByTeamMonth[teamId].add(absence.employee_id);
        }
      });

      // Convert sets to counts
      teams.forEach(t => {
        teamAbsences[t.id].sickDay = sickByTeamDay[t.id].size;
        teamAbsences[t.id].sickWeek = sickByTeamWeek[t.id].size;
        teamAbsences[t.id].sickMonth = sickByTeamMonth[t.id].size;
        teamAbsences[t.id].vacationDay = vacationByTeamDay[t.id].size;
        teamAbsences[t.id].vacationWeek = vacationByTeamWeek[t.id].size;
        teamAbsences[t.id].vacationMonth = vacationByTeamMonth[t.id].size;
      });

      // Return combined data
      return teams.map(t => ({
        id: t.id,
        name: t.name,
        employeeCount: employeeCountByTeam[t.id] || 0,
        sales: teamSales[t.id] || { day: 0, week: 0, month: 0 },
        sick: {
          day: teamAbsences[t.id]?.sickDay || 0,
          week: teamAbsences[t.id]?.sickWeek || 0,
          month: teamAbsences[t.id]?.sickMonth || 0,
        },
        vacation: {
          day: teamAbsences[t.id]?.vacationDay || 0,
          week: teamAbsences[t.id]?.vacationWeek || 0,
          month: teamAbsences[t.id]?.vacationMonth || 0,
        },
      }));
    },
    enabled: !tvMode,
    refetchInterval: 60000,
  });
  const knownClientSales = todaySales.filter(sale => 
    sale.client_name && sale.client_name !== "Ukendt"
  );

  // Calculate counted sales (only products with counts_as_sale = true)
  const calculateCountedSales = (sales: typeof todaySales) => {
    return sales.reduce((total, sale) => {
      const saleItems = (sale as any).sale_items || [];
      for (const item of saleItems) {
        if (item.products?.counts_as_sale === true) {
          total += item.quantity || 1;
        }
      }
      return total;
    }, 0);
  };

  const calculateSalesByClient = (sales: typeof todaySales) => {
    const result: Record<string, number> = {};
    for (const sale of sales) {
      const saleItems = (sale as any).sale_items || [];
      let saleCount = 0;
      for (const item of saleItems) {
        if (item.products?.counts_as_sale === true) {
          saleCount += item.quantity || 1;
        }
      }
      if (saleCount > 0) {
        const clientName = sale.client_name;
        if (clientName && clientName !== "Ukendt") {
          result[clientName] = (result[clientName] || 0) + saleCount;
        }
      }
    }
    return result;
  };

  const calculateConfirmedSales = (sales: typeof todaySales) => {
    return sales.filter((s: any) => s.status === "confirmed").reduce((total, sale) => {
      const saleItems = (sale as any).sale_items || [];
      for (const item of saleItems) {
        if (item.products?.counts_as_sale === true) {
          total += item.quantity || 1;
        }
      }
      return total;
    }, 0);
  };

  const calculatePendingSales = (sales: typeof todaySales) => {
    return sales.filter((s: any) => s.status === "pending").reduce((total, sale) => {
      const saleItems = (sale as any).sale_items || [];
      for (const item of saleItems) {
        if (item.products?.counts_as_sale === true) {
          total += item.quantity || 1;
        }
      }
      return total;
    }, 0);
  };

  // Calculate sellers on board (unique sellers with at least 1 sale)
  const calculateSellersOnBoard = (sales: typeof todaySales) => {
    const sellersWithSales = new Set<string>();
    for (const sale of sales) {
      const saleItems = (sale as any).sale_items || [];
      const hasCountedSale = saleItems.some((item: any) => item.products?.counts_as_sale === true);
      if (hasCountedSale && sale.agent_name) {
        sellersWithSales.add(sale.agent_name.toLowerCase());
      }
    }
    return sellersWithSales.size;
  };

  // Calculate top 20 sellers by commission
  const calculateTopSellers = (sales: typeof todaySales): TopSeller[] => {
    const sellerCommission = new Map<string, number>();
    
    for (const sale of sales) {
      const agentName = sale.agent_name || "Ukendt";
      const saleItems = (sale as any).sale_items || [];
      
      const hasCountedSale = saleItems.some((item: any) => item.products?.counts_as_sale === true);
      if (!hasCountedSale) continue;
      
      const commission = saleItems.reduce(
        (sum: number, item: any) => sum + (item.mapped_commission || 0), 0
      );
      
      sellerCommission.set(
        agentName.toLowerCase(), 
        (sellerCommission.get(agentName.toLowerCase()) || 0) + commission
      );
    }
    
    const nameMap = new Map<string, string>();
    for (const sale of sales) {
      if (sale.agent_name) {
        nameMap.set(sale.agent_name.toLowerCase(), sale.agent_name);
      }
    }
    
    return Array.from(sellerCommission.entries())
      .map(([lowerName, commission]) => ({ 
        name: nameMap.get(lowerName) || lowerName, 
        commission,
        rank: 0
      }))
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 20)
      .map((seller, index) => ({ ...seller, rank: index + 1 }));
  };

  // Calculate recent sales with commission
  const calculateRecentSalesWithCommission = (sales: typeof todaySales): RecentSale[] => {
    return sales
      .filter(sale => sale.client_name && sale.client_name !== "Ukendt")
      .map(sale => {
        const saleItems = (sale as any).sale_items || [];
        const commission = saleItems.reduce(
          (sum: number, item: any) => sum + (item.mapped_commission || 0), 0
        );
        return {
          id: sale.id,
          agent_name: sale.agent_name,
          sale_datetime: sale.sale_datetime,
          status: sale.status,
          client_name: sale.client_name,
          commission
        };
      })
      .slice(0, 30);
  };

  // Filter TV data to exclude unknown clients
  const filterTvSales = (sales: RecentSale[]) => 
    sales.filter(s => s.client_name && s.client_name !== "Ukendt");
  
  const filterTvSalesByClient = (byClient: Record<string, { count: number; logoUrl: string | null }>) => {
    const result: Record<string, { count: number; logoUrl: string | null }> = {};
    for (const [client, data] of Object.entries(byClient)) {
      if (client !== "Ukendt") {
        result[client] = data;
      }
    }
    return result;
  };

  // Convert regular sales by client to include logo
  const getSalesByClientWithLogos = (): Record<string, { count: number; logoUrl: string | null }> => {
    const byClient = calculateSalesByClient(knownClientSales);
    const result: Record<string, { count: number; logoUrl: string | null }> = {};
    for (const [client, count] of Object.entries(byClient)) {
      result[client] = { 
        count, 
        logoUrl: clientLogos[client] || null 
      };
    }
    return result;
  };

  // Use TV data if in TV mode, otherwise use regular queries
  const displaySales = tvMode && tvData ? filterTvSales(tvData.sales.recent) : calculateRecentSalesWithCommission(knownClientSales);
  const displaySalesTotal = tvMode && tvData ? tvData.sales.total : calculateCountedSales(knownClientSales);
  const displaySalesByClient = tvMode && tvData ? filterTvSalesByClient(tvData.sales.byClient) : getSalesByClientWithLogos();
  const displayConfirmed = tvMode && tvData ? tvData.sales.confirmed : calculateConfirmedSales(knownClientSales);
  const displayPending = tvMode && tvData ? tvData.sales.pending : calculatePendingSales(knownClientSales);
  const displaySellersOnBoard = tvMode && tvData ? tvData.sellersOnBoard : calculateSellersOnBoard(knownClientSales);
  const displayActiveEmployees = tvMode && tvData ? tvData.employees.active : activeEmployees;
  const displayTopSellers = tvMode && tvData ? tvData.topSellers : calculateTopSellers(knownClientSales);

  // Format commission as DKK
  const formatCommission = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' kr';
  };

  // Get rank medal/icon
  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className={`font-bold ${tvMode ? 'text-sm' : 'text-base'}`}>{rank}</span>;
  };

  // Client colors for visual distinction
  const clientColors = [
    'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    'from-orange-500/20 to-orange-500/5 border-orange-500/30',
    'from-pink-500/20 to-pink-500/5 border-pink-500/30',
    'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
    'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30',
  ];

  // Skip layout wrapper in TV mode to avoid lock checks
  const content = (
    <div className={`space-y-4 ${tvMode ? 'space-y-3' : 'space-y-6'}`}>
      <DashboardHeader 
        title="Dagsboard CPH Sales" 
        subtitle={format(today, "EEEE d. MMMM yyyy", { locale: da })}
      />

      {/* Sales by Client - Cards with colors - MOVED TO TOP */}
      <div>
        <div className={`flex items-center gap-2 mb-3 ${tvMode ? 'mb-2' : ''}`}>
          <Target className={`text-primary ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          <h3 className={`font-semibold ${tvMode ? 'text-sm' : 'text-base'}`}>Salg per opgave</h3>
        </div>
        {Object.keys(displaySalesByClient).length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Ingen salg registreret i dag</p>
        ) : (
          <div className={`grid ${tvMode ? 'grid-cols-4 gap-2' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3'}`}>
            {Object.entries(displaySalesByClient)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([client, data], index) => (
                <Card 
                  key={client} 
                  className={`bg-gradient-to-br ${clientColors[index % clientColors.length]} ${tvMode ? 'py-2' : 'py-3'}`}
                >
                  <CardContent className={`flex flex-col items-center justify-center ${tvMode ? 'p-2' : 'p-3'}`}>
                    {/* Client logo */}
                    {data.logoUrl && (
                      <div className={`flex items-center justify-center bg-white/90 rounded-lg ${tvMode ? 'h-14 w-28 mb-2 p-2' : 'h-16 w-32 mb-3 p-2.5'}`}>
                        <img 
                          src={data.logoUrl} 
                          alt={client} 
                          className="object-contain max-h-full max-w-full"
                        />
                      </div>
                    )}
                    <span className={`font-bold ${tvMode ? 'text-2xl' : 'text-3xl'}`}>{data.count}</span>
                    <span className={`text-muted-foreground text-center truncate w-full ${tvMode ? 'text-[10px]' : 'text-xs'}`}>
                      {client}
                    </span>
                    {/* Absence info per client - only show in non-TV mode */}
                    {!tvMode && absenceData && (
                      (() => {
                        const sickCount = absenceData.sickByClient?.[client] || 0;
                        const vacationCount = absenceData.vacationByClient?.[client] || 0;
                        const noShowCount = absenceData.noShowByClient?.[client] || 0;
                        const employeeCount = absenceData.employeeCountByClient?.[client] || 0;
                        
                        if (employeeCount === 0) return null;
                        
                        const totalAbsent = sickCount + vacationCount + noShowCount;
                        if (totalAbsent === 0) return null;
                        
                        return (
                          <div className="flex flex-wrap gap-1 justify-center mt-1">
                            {sickCount > 0 && (
                              <span className="text-[10px] text-rose-400">
                                🤒 {Math.round((sickCount / employeeCount) * 100)}% ({sickCount})
                              </span>
                            )}
                            {vacationCount > 0 && (
                              <span className="text-[10px] text-blue-400">
                                🌴 {Math.round((vacationCount / employeeCount) * 100)}% ({vacationCount})
                              </span>
                            )}
                            {noShowCount > 0 && (
                              <span className="text-[10px] text-gray-400">
                                ⚠️ {noShowCount}
                              </span>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Team Performance Overview - Only show in non-TV mode */}
      {!tvMode && teamPerformanceData && teamPerformanceData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" />
              Team Performance Oversigt
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="align-bottom font-semibold">Team</TableHead>
                    <TableHead colSpan={3} className="text-center border-l bg-emerald-500/5 font-semibold">
                      📈 Salg
                    </TableHead>
                    <TableHead colSpan={3} className="text-center border-l bg-rose-500/5 font-semibold">
                      🤒 Sygdom
                    </TableHead>
                    <TableHead colSpan={3} className="text-center border-l bg-blue-500/5 font-semibold">
                      🌴 Ferie
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-center border-l bg-emerald-500/5 text-xs font-medium">Dag</TableHead>
                    <TableHead className="text-center bg-emerald-500/5 text-xs font-medium">Uge</TableHead>
                    <TableHead className="text-center bg-emerald-500/5 text-xs font-medium">Mdr</TableHead>
                    <TableHead className="text-center border-l bg-rose-500/5 text-xs font-medium">Dag</TableHead>
                    <TableHead className="text-center bg-rose-500/5 text-xs font-medium">Uge</TableHead>
                    <TableHead className="text-center bg-rose-500/5 text-xs font-medium">Mdr</TableHead>
                    <TableHead className="text-center border-l bg-blue-500/5 text-xs font-medium">Dag</TableHead>
                    <TableHead className="text-center bg-blue-500/5 text-xs font-medium">Uge</TableHead>
                    <TableHead className="text-center bg-blue-500/5 text-xs font-medium">Mdr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamPerformanceData.map((team) => {
                    const empCount = team.employeeCount || 1;
                    const formatAbsence = (count: number) => {
                      if (count === 0) return '-';
                      const pct = Math.round((count / empCount) * 100);
                      return `${pct}% (${count})`;
                    };
                    return (
                      <TableRow key={team.id}>
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell className={`text-center border-l ${team.sales.day > 0 ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}`}>
                          {team.sales.day}
                        </TableCell>
                        <TableCell className={`text-center ${team.sales.week > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {team.sales.week}
                        </TableCell>
                        <TableCell className={`text-center ${team.sales.month > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {team.sales.month}
                        </TableCell>
                        <TableCell className={`text-center border-l text-xs ${team.sick.day > 0 ? 'text-rose-500 font-semibold' : 'text-muted-foreground'}`}>
                          {formatAbsence(team.sick.day)}
                        </TableCell>
                        <TableCell className={`text-center text-xs ${team.sick.week > 0 ? 'text-rose-400' : 'text-muted-foreground'}`}>
                          {formatAbsence(team.sick.week)}
                        </TableCell>
                        <TableCell className={`text-center text-xs ${team.sick.month > 0 ? 'text-rose-400' : 'text-muted-foreground'}`}>
                          {formatAbsence(team.sick.month)}
                        </TableCell>
                        <TableCell className={`text-center border-l text-xs ${team.vacation.day > 0 ? 'text-blue-500 font-semibold' : 'text-muted-foreground'}`}>
                          {formatAbsence(team.vacation.day)}
                        </TableCell>
                        <TableCell className={`text-center text-xs ${team.vacation.week > 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                          {formatAbsence(team.vacation.week)}
                        </TableCell>
                        <TableCell className={`text-center text-xs ${team.vacation.month > 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                          {formatAbsence(team.vacation.month)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Total row */}
                  {(() => {
                    const totalEmp = teamPerformanceData.reduce((sum, t) => sum + (t.employeeCount || 0), 0) || 1;
                    const formatTotal = (count: number) => {
                      if (count === 0) return '-';
                      const pct = Math.round((count / totalEmp) * 100);
                      return `${pct}% (${count})`;
                    };
                    return (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-center border-l text-emerald-600">
                          {teamPerformanceData.reduce((sum, t) => sum + t.sales.day, 0)}
                        </TableCell>
                        <TableCell className="text-center text-emerald-600">
                          {teamPerformanceData.reduce((sum, t) => sum + t.sales.week, 0)}
                        </TableCell>
                        <TableCell className="text-center text-emerald-600">
                          {teamPerformanceData.reduce((sum, t) => sum + t.sales.month, 0)}
                        </TableCell>
                        <TableCell className="text-center border-l text-rose-500 text-xs">
                          {formatTotal(teamPerformanceData.reduce((sum, t) => sum + t.sick.day, 0))}
                        </TableCell>
                        <TableCell className="text-center text-rose-400 text-xs">
                          {formatTotal(teamPerformanceData.reduce((sum, t) => sum + t.sick.week, 0))}
                        </TableCell>
                        <TableCell className="text-center text-rose-400 text-xs">
                          {formatTotal(teamPerformanceData.reduce((sum, t) => sum + t.sick.month, 0))}
                        </TableCell>
                        <TableCell className="text-center border-l text-blue-500 text-xs">
                          {formatTotal(teamPerformanceData.reduce((sum, t) => sum + t.vacation.day, 0))}
                        </TableCell>
                        <TableCell className="text-center text-blue-400 text-xs">
                          {formatTotal(teamPerformanceData.reduce((sum, t) => sum + t.vacation.week, 0))}
                        </TableCell>
                        <TableCell className="text-center text-blue-400 text-xs">
                          {formatTotal(teamPerformanceData.reduce((sum, t) => sum + t.vacation.month, 0))}
                        </TableCell>
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recruitment KPIs - Only show in non-TV mode */}
      {!tvMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-sky-500/10 to-sky-500/5 border-sky-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nye ansøgere</CardTitle>
              <UserPlus className="h-5 w-5 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {/* Last 24 hours */}
                <div>
                  <div className="text-3xl font-bold text-sky-500">{recruitmentKpis.last24h}</div>
                  <div className="flex items-center gap-1 text-xs">
                    {recruitmentKpis.trend24h !== 0 && (
                      <span className={recruitmentKpis.trend24h > 0 ? "text-green-500" : "text-red-500"}>
                        {recruitmentKpis.trend24h > 0 ? "+" : ""}{recruitmentKpis.trend24h}%
                      </span>
                    )}
                    <span className="text-muted-foreground">sidste 24t</span>
                  </div>
                </div>
                
                <div className="h-10 w-px bg-border" />
                
                {/* Last 7 days */}
                <div>
                  <div className="text-3xl font-bold text-sky-500">{recruitmentKpis.last7d}</div>
                  <div className="flex items-center gap-1 text-xs">
                    {recruitmentKpis.trend7d !== 0 && (
                      <span className={recruitmentKpis.trend7d > 0 ? "text-green-500" : "text-red-500"}>
                        {recruitmentKpis.trend7d > 0 ? "+" : ""}{recruitmentKpis.trend7d}%
                      </span>
                    )}
                    <span className="text-muted-foreground">sidste 7 dage</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Cohorts KPI */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kommende opstarter</CardTitle>
              <CalendarDays className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {/* Members in cohorts */}
                <div>
                  <div className="text-3xl font-bold text-amber-500">{upcomingCohortsData?.memberCount || 0}</div>
                  <div className="text-xs text-muted-foreground">personer i hold</div>
                </div>
                
                <div className="h-10 w-px bg-border" />
                
                {/* Number of cohorts */}
                <div>
                  <div className="text-3xl font-bold text-amber-500">{upcomingCohortsData?.cohortCount || 0}</div>
                  <div className="text-xs text-muted-foreground">hold planlagt</div>
                </div>

                {(upcomingCohortsData?.unassignedCount || 0) > 0 && (
                  <>
                    <div className="h-10 w-px bg-border" />
                    <div>
                      <div className="text-3xl font-bold text-orange-500">{upcomingCohortsData?.unassignedCount}</div>
                      <div className="text-xs text-muted-foreground">uplacerede</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Absence KPI */}
          <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Fravær i dag</CardTitle>
              <HeartPulse className="h-5 w-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {/* Sick */}
                <div>
                  <div className="text-3xl font-bold text-rose-500">{absenceData?.sickCount || 0}</div>
                  <div className="text-xs text-muted-foreground">syge</div>
                </div>
                
                <div className="h-10 w-px bg-border" />
                
                {/* Vacation */}
                <div>
                  <div className="text-3xl font-bold text-blue-500">{absenceData?.vacationCount || 0}</div>
                  <div className="text-xs text-muted-foreground">ferie</div>
                </div>

                {(absenceData?.noShowCount || 0) > 0 && (
                  <>
                    <div className="h-10 w-px bg-border" />
                    <div>
                      <div className="text-3xl font-bold text-gray-500">{absenceData?.noShowCount}</div>
                      <div className="text-xs text-muted-foreground">udeblivelse</div>
                    </div>
                  </>
                )}

                <div className="h-10 w-px bg-border" />

                {/* Total percent */}
                <div>
                  <div className="text-2xl font-bold text-muted-foreground">
                    {activeEmployees > 0 ? Math.round(((absenceData?.totalAbsent || 0) / activeEmployees) * 100) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">af {activeEmployees}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top KPI Row - Compact */}
      <div className={`grid grid-cols-2 ${tvMode ? 'gap-3' : 'gap-4'}`}>
        <Card className={`bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 ${tvMode ? 'py-2' : ''}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${tvMode ? 'pb-1 pt-2 px-4' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>Salg i dag</CardTitle>
            <TrendingUp className={`text-emerald-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </CardHeader>
          <CardContent className={tvMode ? 'px-4 pb-2 pt-0' : ''}>
            <div className={`font-bold text-emerald-500 ${tvMode ? 'text-3xl' : 'text-4xl'}`}>{displaySalesTotal}</div>
            <div className={`flex gap-1 ${tvMode ? 'mt-1' : 'mt-2'}`}>
              <Badge variant="secondary" className={`bg-emerald-500/20 text-emerald-600 ${tvMode ? 'text-[10px] px-1.5 py-0' : ''}`}>
                {displayConfirmed} bekræftet
              </Badge>
              {displayPending > 0 && (
                <Badge variant="secondary" className={`bg-amber-500/20 text-amber-600 ${tvMode ? 'text-[10px] px-1.5 py-0' : ''}`}>
                  {displayPending} afventer
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 ${tvMode ? 'py-2' : ''}`}>
          <CardHeader className={`flex flex-row items-center justify-between ${tvMode ? 'pb-1 pt-2 px-4' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>Sælgere på tavlen</CardTitle>
            <Users className={`text-purple-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </CardHeader>
          <CardContent className={tvMode ? 'px-4 pb-2 pt-0' : ''}>
            <div className="flex items-baseline gap-2">
              <span className={`font-bold text-purple-500 ${tvMode ? 'text-3xl' : 'text-4xl'}`}>{displaySellersOnBoard}</span>
              <span className={`text-muted-foreground ${tvMode ? 'text-sm' : 'text-lg'}`}>
                ({displayActiveEmployees})
              </span>
            </div>
            <p className={`text-muted-foreground ${tvMode ? 'text-[10px] mt-1' : 'text-xs mt-2'}`}>
              Sælgere med salg af {displayActiveEmployees} aktive
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Main content: Top 20 Sellers + Recent Sales - Equal size */}
      <div className={`grid ${tvMode ? 'grid-cols-2 gap-3' : 'grid-cols-1 lg:grid-cols-2 gap-6'}`}>
        {/* Top 20 Sellers */}
        <Card className="flex flex-col">
          <CardHeader className={tvMode ? 'pb-2 pt-3 px-4' : ''}>
            <CardTitle className={`flex items-center gap-2 ${tvMode ? 'text-sm' : ''}`}>
              <Trophy className={`text-yellow-500 ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
              Top 20 Sælgere i dag
            </CardTitle>
          </CardHeader>
          <CardContent className={`flex-1 ${tvMode ? 'px-4 pb-3 pt-0' : ''}`}>
            {displayTopSellers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ingen salg registreret i dag</p>
            ) : (
              <div className={`space-y-1.5 overflow-y-auto ${tvMode ? 'max-h-[500px]' : 'max-h-[400px]'}`}>
                {displayTopSellers.map((seller) => (
                  <div 
                    key={seller.name} 
                    className={`flex items-center justify-between rounded-lg ${
                      seller.rank <= 3 
                        ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' 
                        : 'bg-muted/30'
                    } ${tvMode ? 'p-1.5 px-2' : 'p-3'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center ${tvMode ? 'w-5' : 'w-8'}`}>
                        {getRankDisplay(seller.rank)}
                      </div>
                      <span className={`font-medium truncate ${tvMode ? 'text-xs max-w-[120px]' : 'text-sm'}`}>
                        {seller.name}
                      </span>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`bg-emerald-500/20 text-emerald-600 font-mono ${tvMode ? 'text-[10px] px-1.5' : ''}`}
                    >
                      {formatCommission(seller.commission)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales - Same size as Top Sellers */}
        <Card className="flex flex-col">
          <CardHeader className={tvMode ? 'pb-2 pt-3 px-4' : ''}>
            <CardTitle className={`flex items-center gap-2 ${tvMode ? 'text-sm' : ''}`}>
              <Activity className={`text-primary ${tvMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
              Seneste salg
            </CardTitle>
          </CardHeader>
          <CardContent className={`flex-1 ${tvMode ? 'px-4 pb-3 pt-0' : ''}`}>
            {displaySales.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ingen salg registreret i dag</p>
            ) : (
              <div className={`space-y-1.5 overflow-y-auto ${tvMode ? 'max-h-[500px]' : 'max-h-[400px]'}`}>
                {displaySales.slice(0, tvMode ? 25 : 15).map((sale: RecentSale) => (
                  <div 
                    key={sale.id} 
                    className={`flex items-center justify-between rounded-lg bg-muted/50 ${tvMode ? 'p-1.5 px-2' : 'p-2.5'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate ${tvMode ? 'text-xs' : 'text-sm'}`}>{sale.agent_name}</p>
                        <Badge 
                          variant={sale.status === "confirmed" ? "default" : "secondary"}
                          className={`shrink-0 ${sale.status === "confirmed" ? "bg-emerald-500" : ""} ${tvMode ? 'text-[8px] px-1 py-0 h-4' : 'text-[10px] px-1.5'}`}
                        >
                          {sale.status === "confirmed" ? "✓" : sale.status === "pending" ? "⏳" : "-"}
                        </Badge>
                      </div>
                      <p className={`text-muted-foreground truncate ${tvMode ? 'text-[10px]' : 'text-xs'}`}>
                        {sale.client_name}
                      </p>
                    </div>
                    {sale.commission !== undefined && sale.commission > 0 && (
                      <Badge 
                        variant="outline" 
                        className={`ml-2 shrink-0 font-mono text-emerald-600 border-emerald-500/30 ${tvMode ? 'text-[9px] px-1.5' : 'text-xs'}`}
                      >
                        {formatCommission(sale.commission)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className={`text-center text-muted-foreground ${tvMode ? 'text-xs' : 'text-sm'}`}>
        <p>CPH Sales Dashboard • {format(today, "HH:mm", { locale: da })}</p>
      </div>
    </div>
  );

  // In TV mode, render without layout to skip lock checks
  if (tvMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        {content}
      </div>
    );
  }

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}
