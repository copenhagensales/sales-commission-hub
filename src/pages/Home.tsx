import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { 
  Cake, 
  Award, 
  TrendingUp, 
  ArrowRight,
  Users,
  Calendar,
  Star,
  Sparkles,
  Gift,
  PartyPopper,
  Target,
  CalendarDays,
  Plus,
  Trash2,
  Swords,
  Zap,
  Info,
  Flame,
  ArrowUpRight,
  LogOut
} from "lucide-react";
import { LeaguePromoCard } from "@/components/league/LeaguePromoCard";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQueryClient as useQueryClientRQ } from "@tanstack/react-query";
import { format, parseISO, differenceInYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks, addDays, isSameDay, isAfter, isBefore, isWeekend } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { usePrecomputedKpis, usePrecomputedKpi, getKpiValue } from "@/hooks/usePrecomputedKpi";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canEditHomeGoals: realCanEditHomeGoals } = usePermissions();
  const { isPreviewMode, previewPermissions, previewEmployee } = useRolePreview();
  
  // In preview mode, check preview permissions for canEditHomeGoals
  const canEditHomeGoals = isPreviewMode 
    ? (previewPermissions?.menu_home_goals === true || 
       (typeof previewPermissions?.menu_home_goals === 'object' && 
        (previewPermissions.menu_home_goals as { edit?: boolean })?.edit))
    : realCanEditHomeGoals;
  
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    queryClient.clear();
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') || key.includes('supabase')
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    }
    
    navigate("/auth");
  };
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", event_date: "", event_time: "", location: "" });
  
  // Fetch current employee data (or preview employee if in preview mode)
  const { data: employee } = useQuery({
    queryKey: ["home-employee", isPreviewMode, previewEmployee?.id, user?.email],
    queryFn: async () => {
      // If in preview mode, fetch the preview employee's data
      if (isPreviewMode && previewEmployee?.id) {
        const { data } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, job_title, team_id, employment_start_date")
          .eq("id", previewEmployee.id)
          .maybeSingle();
        return data;
      }
      
      // Normal flow: fetch current user's data
      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, team_id, employment_start_date")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!(user?.email || (isPreviewMode && previewEmployee?.id)),
    staleTime: 60000, // 1 minute cache
  });

  // Fetch upcoming birthdays and anniversaries (next 14 days)
  const { data: celebrations = [] } = useQuery({
    queryKey: ["home-celebrations"],
    queryFn: async () => {
      const today = new Date();
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, employment_start_date, cpr_number")
        .eq("is_active", true);
      
      const results: { type: 'birthday' | 'anniversary'; name: string; years?: number; date: Date; isToday: boolean }[] = [];
      
      // Helper to parse CPR birthday (format: DDMMYY-XXXX)
      const parseCprBirthday = (cpr: string): Date | null => {
        if (!cpr || cpr.length < 6) return null;
        const day = parseInt(cpr.substring(0, 2), 10);
        const month = parseInt(cpr.substring(2, 4), 10) - 1; // 0-indexed
        let year = parseInt(cpr.substring(4, 6), 10);
        
        // Determine century: if year > current year's last 2 digits, assume 1900s
        const currentYearShort = today.getFullYear() % 100;
        year = year > currentYearShort ? 1900 + year : 2000 + year;
        
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        return new Date(year, month, day);
      };
      
      employees?.forEach(emp => {
        // Check birthday from CPR (next 14 days)
        if (emp.cpr_number) {
          const birthDate = parseCprBirthday(emp.cpr_number);
          if (birthDate) {
            const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
            const age = differenceInYears(today, birthDate);
            
            if ((isSameDay(birthdayThisYear, today) || isAfter(birthdayThisYear, today)) && 
                isBefore(birthdayThisYear, addDays(today, 14))) {
              results.push({ 
                type: 'birthday', 
                name: `${emp.first_name} ${emp.last_name}`,
                years: age + (isAfter(birthdayThisYear, today) ? 1 : 0), // Age they'll turn
                date: birthdayThisYear,
                isToday: isSameDay(birthdayThisYear, today)
              });
            }
          }
        }
        
        // Check anniversary (yearly and 6-month, next 14 days)
        if (emp.employment_start_date) {
          const startDate = parseISO(emp.employment_start_date);
          const monthsSinceStart = differenceInYears(today, startDate) * 12 + 
            (today.getMonth() - startDate.getMonth()) + 
            (today.getDate() >= startDate.getDate() ? 0 : -1);
          
          // Check yearly anniversaries
          const years = differenceInYears(today, startDate);
          if (years > 0) {
            const anniversaryThisYear = new Date(today.getFullYear(), startDate.getMonth(), startDate.getDate());
            
            if ((isSameDay(anniversaryThisYear, today) || isAfter(anniversaryThisYear, today)) && 
                isBefore(anniversaryThisYear, addDays(today, 14))) {
              results.push({ 
                type: 'anniversary', 
                name: `${emp.first_name} ${emp.last_name}`,
                years,
                date: anniversaryThisYear,
                isToday: isSameDay(anniversaryThisYear, today)
              });
            }
          }
          
          // Check 6-month anniversary (only for employees < 1 year)
          if (years === 0) {
            const sixMonthDate = addDays(startDate, 182); // ~6 months
            if ((isSameDay(sixMonthDate, today) || isAfter(sixMonthDate, today)) && 
                isBefore(sixMonthDate, addDays(today, 14))) {
              results.push({ 
                type: 'anniversary', 
                name: `${emp.first_name} ${emp.last_name}`,
                years: 0.5, // 6 months marker
                date: sixMonthDate,
                isToday: isSameDay(sixMonthDate, today)
              });
            }
          }
        }
      });
      
      // Sort by date
      return results.sort((a, b) => a.date.getTime() - b.date.getTime());
    },
    staleTime: 300000, // 5 minutes cache - celebrations don't change often
  });

  // Fetch company events
  const { data: companyEvents = [] } = useQuery({
    queryKey: ["home-company-events"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("company_events")
        .select("*")
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(5);
      return data || [];
    },
    staleTime: 60000, // 1 minute cache
  });

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async (event: typeof newEvent) => {
      const { error } = await supabase
        .from("company_events")
        .insert({
          title: event.title,
          event_date: event.event_date,
          event_time: event.event_time || null,
          location: event.location || null,
          created_by: user?.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-company-events"] });
      setAddEventOpen(false);
      setNewEvent({ title: "", event_date: "", event_time: "", location: "" });
      toast.success("Begivenhed tilføjet");
    },
    onError: () => {
      toast.error("Kunne ikke tilføje begivenhed");
    }
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("company_events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-company-events"] });
      toast.success("Begivenhed slettet");
    }
  });

  // State for team goal dialog
  const [addTeamGoalOpen, setAddTeamGoalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [newSalesTarget, setNewSalesTarget] = useState<string>("100000");

  // Fetch user's teams
  const { data: userTeams = [] } = useQuery({
    queryKey: ["home-user-teams", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .eq("employee_id", employee.id);
      return data || [];
    },
    enabled: !!employee?.id,
    staleTime: 60000, // 1 minute cache
  });

  // For owners/teamleaders - fetch all teams they can manage
  const { data: manageableTeams = [] } = useQuery({
    queryKey: ["home-manageable-teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      return data || [];
    },
    staleTime: 120000, // 2 minutes cache - teams rarely change
  });

  // Calculate payroll period (15th-14th) - shared for all team goal queries
  const payrollPeriod = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    
    if (currentDay >= 15) {
      const start = new Date(today.getFullYear(), today.getMonth(), 15);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 14);
      return { start, end };
    } else {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 15);
      const end = new Date(today.getFullYear(), today.getMonth(), 14);
      return { start, end };
    }
  }, []);

  const periodStartStr = format(payrollPeriod.start, "yyyy-MM-dd");
  const periodEndStr = format(payrollPeriod.end, "yyyy-MM-dd");

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // ============= CACHED TEAM GOALS (Fase 9 Optimization) =============
  // Fetch team goals metadata, then use cached commission values
  const { data: teamGoalsMetadata = [] } = useQuery({
    queryKey: ["home-team-goals-metadata", canEditHomeGoals, periodStartStr, periodEndStr],
    queryFn: async () => {
      const { data: goals } = await supabase
        .from("team_sales_goals")
        .select("id, team_id, target_amount, teams(id, name)")
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr);
      return goals || [];
    },
    enabled: canEditHomeGoals,
    staleTime: 60000, // Goals don't change often
  });
  
  // Fetch cached team commission values for all teams with goals
  const teamIdsWithGoals = useMemo(() => 
    teamGoalsMetadata.map((g: any) => g.team_id), 
    [teamGoalsMetadata]
  );
  
  const { data: cachedTeamCommissions } = useQuery({
    queryKey: ["home-cached-team-commissions", teamIdsWithGoals],
    queryFn: async () => {
      if (teamIdsWithGoals.length === 0) return {};
      
      const { data } = await supabase
        .from("kpi_cached_values")
        .select("scope_id, value")
        .eq("kpi_slug", "total_commission")
        .eq("period_type", "payroll_period")
        .eq("scope_type", "team")
        .in("scope_id", teamIdsWithGoals);
      
      // Convert to map
      const result: Record<string, number> = {};
      (data || []).forEach(item => {
        if (item.scope_id) result[item.scope_id] = item.value;
      });
      return result;
    },
    enabled: teamIdsWithGoals.length > 0,
    staleTime: 30000,
  });
  
  // Combine metadata with cached commission values
  const allTeamGoals = useMemo(() => {
    return teamGoalsMetadata.map((goal: any) => {
      const currentAmount = cachedTeamCommissions?.[goal.team_id] || 0;
      const progress = goal.target_amount > 0 
        ? Math.min((currentAmount / goal.target_amount) * 100, 100) 
        : 0;
      return { ...goal, currentAmount, progress };
    });
  }, [teamGoalsMetadata, cachedTeamCommissions]);

  // ============= CACHED TEAM GOAL FOR REGULAR EMPLOYEES =============
  // Fetch team goal metadata, use cached commission
  const { data: teamGoalMetadata } = useQuery({
    queryKey: ["home-team-goal-metadata", userTeams, periodStartStr, periodEndStr],
    queryFn: async () => {
      if (userTeams.length === 0) return null;

      const teamIds = userTeams.map(t => (t.teams as { id: string })?.id).filter(Boolean);
      if (teamIds.length === 0) return null;

      const primaryTeamId = teamIds[0];

      // First try to get explicit team goal
      const { data: explicitGoal } = await supabase
        .from("team_sales_goals")
        .select("id, team_id, target_amount, teams(id, name)")
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .in("team_id", teamIds)
        .limit(1)
        .maybeSingle();

      if (explicitGoal) {
        return { ...explicitGoal, isFallback: false };
      }

      // Fallback: Sum individual employee_sales_goals for this team
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("employee_id")
        .eq("team_id", primaryTeamId);

      const employeeIds = teamMembers?.map(m => m.employee_id) || [];

      const { data: individualGoals } = await supabase
        .from("employee_sales_goals")
        .select("target_amount")
        .in("employee_id", employeeIds)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr);

      const summedTarget = individualGoals?.reduce((sum, g) => sum + (g.target_amount || 0), 0) || 0;
      if (summedTarget === 0) return null;

      const { data: teamData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("id", primaryTeamId)
        .single();

      return {
        id: `fallback-${primaryTeamId}`,
        team_id: primaryTeamId,
        target_amount: summedTarget,
        teams: teamData,
        isFallback: true,
      };
    },
    enabled: userTeams.length > 0 && !canEditHomeGoals,
    staleTime: 60000, // Goals don't change often
  });
  
  // Fetch cached team commission for the user's team goal
  const { data: userTeamCommission } = usePrecomputedKpi(
    "total_commission",
    "payroll_period",
    "team",
    teamGoalMetadata?.team_id
  );
  
  // Combine metadata with cached commission
  const teamGoal = useMemo(() => {
    if (!teamGoalMetadata) return null;
    
    const currentAmount = getKpiValue(userTeamCommission);
    const progress = teamGoalMetadata.target_amount > 0 
      ? Math.min((currentAmount / teamGoalMetadata.target_amount) * 100, 100) 
      : 0;
    
    return { ...teamGoalMetadata, currentAmount, progress };
  }, [teamGoalMetadata, userTeamCommission]);

  // Add/update team goal mutation (using team_sales_goals with amounts)
  const addTeamGoalMutation = useMutation({
    mutationFn: async ({ teamId, targetAmount }: { teamId: string; targetAmount: number }) => {
      const { error } = await supabase
        .from("team_sales_goals")
        .upsert({
          team_id: teamId,
          period_start: periodStartStr,
          period_end: periodEndStr,
          target_amount: targetAmount,
        }, { onConflict: "team_id,period_start,period_end" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-team-goal-metadata"] });
      queryClient.invalidateQueries({ queryKey: ["home-team-goals-metadata"] });
      setAddTeamGoalOpen(false);
      setNewSalesTarget("100000");
      toast.success("Teammål opdateret");
    },
    onError: () => toast.error("Kunne ikke opdatere teammål")
  });

  // Delete team goal mutation
  const deleteTeamGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("team_sales_goals")
        .delete()
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-team-goal-metadata"] });
      queryClient.invalidateQueries({ queryKey: ["home-team-goals-metadata"] });
      toast.success("Teammål slettet");
    }
  });
  // Helper to count working days (excluding weekends)
  const getWorkingDaysInRange = (start: Date, end: Date): number => {
    let count = 0;
    let current = new Date(start);
    while (current <= end) {
      if (!isWeekend(current)) count++;
      current = addDays(current, 1);
    }
    return count;
  };

  // Calculate working days stats for payroll period
  const workingDaysStats = useMemo(() => {
    const today = new Date();
    const totalWorkingDays = getWorkingDaysInRange(payrollPeriod.start, payrollPeriod.end);
    const elapsedWorkingDays = getWorkingDaysInRange(payrollPeriod.start, today > payrollPeriod.end ? payrollPeriod.end : today);
    return { totalWorkingDays, elapsedWorkingDays };
  }, [payrollPeriod]);

  // Team performance from team goal (using amounts)
  const teamPerformance = useMemo(() => {
    if (!teamGoal) return { currentAmount: 0, targetAmount: 0, progress: 0, progressVsExpected: 0 };
    const currentAmount = teamGoal.currentAmount || 0;
    const targetAmount = teamGoal.target_amount || 0;
    const progress = teamGoal.progress || 0;
    
    // Calculate expected progress based on working days
    const { totalWorkingDays, elapsedWorkingDays } = workingDaysStats;
    const expectedNow = totalWorkingDays > 0 ? (elapsedWorkingDays / totalWorkingDays) * targetAmount : 0;
    const progressVsExpected = expectedNow > 0 ? (currentAmount / expectedNow) * 100 : 0;
    
    return { currentAmount, targetAmount, progress, progressVsExpected };
  }, [teamGoal, workingDaysStats]);

  // ============= CACHED PERSONAL STATS (Fase 9 Optimization) =============
  // Use pre-computed employee-scoped KPIs from edge function cache
  const { data: cachedPersonalPayroll } = usePrecomputedKpis(
    ["sales_count", "total_commission"],
    "payroll_period",
    "employee",
    employee?.id
  );
  
  const { data: cachedPersonalToday } = usePrecomputedKpis(
    ["sales_count", "total_commission"],
    "today",
    "employee",
    employee?.id
  );
  
  // Derive personalStats from cached values
  const personalStats = useMemo(() => {
    if (!employee?.id) return null;
    
    return {
      periodCommission: getKpiValue(cachedPersonalPayroll?.total_commission),
      periodSalesCount: getKpiValue(cachedPersonalPayroll?.sales_count),
      todaySalesCount: getKpiValue(cachedPersonalToday?.sales_count),
      todayCommission: getKpiValue(cachedPersonalToday?.total_commission),
    };
  }, [employee?.id, cachedPersonalPayroll, cachedPersonalToday]);

  // Fetch employee's personal sales goal for the current payroll period
  const { data: personalGoal } = useQuery({
    queryKey: ["home-personal-goal", employee?.id, payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (!employee?.id) return null;
      
      const periodStartIso = format(payrollPeriod.start, "yyyy-MM-dd");
      const periodEndIso = format(payrollPeriod.end, "yyyy-MM-dd");
      
      const { data } = await supabase
        .from("employee_sales_goals")
        .select("target_amount")
        .eq("employee_id", employee.id)
        .eq("period_start", periodStartIso)
        .eq("period_end", periodEndIso)
        .maybeSingle();
      
      return data;
    },
    enabled: !!employee?.id,
    staleTime: 60000, // 1 minute cache
  });

  // Calculate daily goal stats
  const dailyGoalStats = useMemo(() => {
    if (!personalGoal?.target_amount || !personalStats) return null;
    
    const targetAmount = personalGoal.target_amount;
    const { totalWorkingDays, elapsedWorkingDays } = workingDaysStats;
    const remainingWorkingDays = Math.max(0, totalWorkingDays - elapsedWorkingDays);
    
    // Daily target based on linear progression
    const dailyTarget = totalWorkingDays > 0 ? targetAmount / totalWorkingDays : 0;
    
    // Remaining to hit today's goal
    const todayRemaining = Math.max(0, dailyTarget - personalStats.todayCommission);
    
    // Progress towards daily goal
    const todayProgress = dailyTarget > 0 
      ? Math.min((personalStats.todayCommission / dailyTarget) * 100, 150)
      : 0;
    
    // Hit daily goal?
    const hitDailyGoal = personalStats.todayCommission >= dailyTarget;
    
    // Status for styling
    const status = todayProgress >= 100 ? 'ahead' 
      : todayProgress >= 50 ? 'ontrack' 
      : 'behind';
    
    return {
      dailyTarget,
      todayRemaining,
      todayProgress,
      hitDailyGoal,
      remainingWorkingDays,
      status
    };
  }, [personalGoal, personalStats, workingDaysStats]);

  // Fetch new employees (started this month)
  const { data: newEmployees = [] } = useQuery({
    queryKey: ["home-new-employees"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, employment_start_date, teams:team_id(name)")
        .eq("is_active", true)
        .gte("employment_start_date", monthStart)
        .order("employment_start_date", { ascending: false })
        .limit(5);
      
      return data || [];
    },
    staleTime: 300000, // 5 minutes cache - new employees don't change often
  });

  // Fetch weekly recognition data for both last week and current week
  const { data: weeklyRecognition } = useQuery({
    queryKey: ["home-weekly-recognition"],
    queryFn: async () => {
      const now = new Date();
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      
      // Fetch sales for both weeks
      const { data: sales } = await supabase
        .from("sales")
        .select(`
          id,
          agent_name,
          sale_datetime,
          sale_items (
            id,
            mapped_commission,
            quantity
          )
        `)
        .gte("sale_datetime", lastWeekStart)
        .lte("sale_datetime", currentWeekEnd);
      
      if (!sales || sales.length === 0) {
        return { lastWeek: { topWeekly: null, bestDay: null }, currentWeek: { topWeekly: null, bestDay: null } };
      }
      
      // Helper to process sales for a specific week
      const processWeekSales = (weekSales: typeof sales) => {
        const agentTotals: Record<string, number> = {};
        const agentDailyTotals: Record<string, Record<string, number>> = {};
        
        weekSales.forEach(sale => {
          const agentName = sale.agent_name || "Unknown";
          const saleDate = sale.sale_datetime ? sale.sale_datetime.split("T")[0] : "";
          
          // mapped_commission is already pre-multiplied by quantity, don't multiply again
          const saleCommission = sale.sale_items?.reduce((sum, item) => {
            return sum + (item.mapped_commission || 0);
          }, 0) || 0;
          
          agentTotals[agentName] = (agentTotals[agentName] || 0) + saleCommission;
          
          if (!agentDailyTotals[agentName]) {
            agentDailyTotals[agentName] = {};
          }
          agentDailyTotals[agentName][saleDate] = (agentDailyTotals[agentName][saleDate] || 0) + saleCommission;
        });
        
        let topWeeklyAgent = "";
        let topWeeklyCommission = 0;
        Object.entries(agentTotals).forEach(([agent, total]) => {
          if (total > topWeeklyCommission) {
            topWeeklyCommission = total;
            topWeeklyAgent = agent;
          }
        });
        
        let bestDayAgent = "";
        let bestDayDate = "";
        let bestDayCommission = 0;
        Object.entries(agentDailyTotals).forEach(([agent, days]) => {
          Object.entries(days).forEach(([date, total]) => {
            if (total > bestDayCommission) {
              bestDayCommission = total;
              bestDayAgent = agent;
              bestDayDate = date;
            }
          });
        });
        
        return { topWeeklyAgent, topWeeklyCommission, bestDayAgent, bestDayDate, bestDayCommission };
      };
      
      // Filter sales by week
      const lastWeekSales = sales.filter(s => {
        const dt = s.sale_datetime;
        return dt && dt >= lastWeekStart && dt <= lastWeekEnd;
      });
      const currentWeekSales = sales.filter(s => {
        const dt = s.sale_datetime;
        return dt && dt >= currentWeekStart && dt <= currentWeekEnd;
      });
      
      const lastWeekData = processWeekSales(lastWeekSales);
      const currentWeekData = processWeekSales(currentWeekSales);
      
      // Get all unique agent names for team lookup
      const allAgentNames = [
        lastWeekData.topWeeklyAgent, lastWeekData.bestDayAgent,
        currentWeekData.topWeeklyAgent, currentWeekData.bestDayAgent
      ].filter(Boolean);
      
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name, email")
        .in("name", allAgentNames.length > 0 ? allAgentNames : ["__none__"]);
      
      // Get team info via employee_agent_mapping - simpler approach with separate query
      const agentIds = agents?.map(a => a.id).filter(Boolean) || [];
      const { data: agentMappings } = agentIds.length > 0 ? await supabase
        .from("employee_agent_mapping")
        .select("agent_id, employee_id")
        .in("agent_id", agentIds) : { data: [] };
      
      // Get employee IDs from mappings
      const employeeIdsFromMappings = agentMappings?.map(m => m.employee_id).filter(Boolean) || [];
      
      // Get team info for mapped employees
      const { data: teamMembersData } = employeeIdsFromMappings.length > 0 ? await supabase
        .from("team_members")
        .select("employee_id, teams(name)")
        .in("employee_id", employeeIdsFromMappings) : { data: [] };
      
      // Also get team info via email matching as fallback
      const agentEmails = agents?.map(a => a.email).filter(Boolean) || [];
      const { data: employeesByEmail } = agentEmails.length > 0 ? await supabase
        .from("employee_master_data")
        .select("id, work_email, private_email")
        .or(agentEmails.map(e => `work_email.eq.${e},private_email.eq.${e}`).join(",")) : { data: [] };
      
      // Get team info for email-matched employees
      const employeeIdsFromEmail = employeesByEmail?.map(e => e.id).filter(Boolean) || [];
      const { data: teamMembersFromEmail } = employeeIdsFromEmail.length > 0 ? await supabase
        .from("team_members")
        .select("employee_id, teams(name)")
        .in("employee_id", employeeIdsFromEmail) : { data: [] };
      
      const getTeamForAgent = (agentName: string) => {
        const agent = agents?.find(a => a.name === agentName);
        if (!agent) return null;
        
        // First try employee_agent_mapping
        const mapping = agentMappings?.find(m => m.agent_id === agent.id);
        if (mapping?.employee_id) {
          const teamMember = teamMembersData?.find(tm => tm.employee_id === mapping.employee_id);
          if (teamMember?.teams && typeof teamMember.teams === 'object' && 'name' in teamMember.teams) {
            return { name: (teamMember.teams as { name: string }).name };
          }
        }
        
        // Fallback to email matching
        if (agent.email) {
          const emp = employeesByEmail?.find(e => e.work_email === agent.email || e.private_email === agent.email);
          if (emp?.id) {
            const teamMember = teamMembersFromEmail?.find(tm => tm.employee_id === emp.id);
            if (teamMember?.teams && typeof teamMember.teams === 'object' && 'name' in teamMember.teams) {
              return { name: (teamMember.teams as { name: string }).name };
            }
          }
        }
        
        return null;
      };
      
      return {
        lastWeek: {
          topWeekly: lastWeekData.topWeeklyAgent ? {
            name: lastWeekData.topWeeklyAgent,
            commission: lastWeekData.topWeeklyCommission,
            team: getTeamForAgent(lastWeekData.topWeeklyAgent)?.name || null
          } : null,
          bestDay: lastWeekData.bestDayAgent ? {
            name: lastWeekData.bestDayAgent,
            date: lastWeekData.bestDayDate,
            commission: lastWeekData.bestDayCommission,
            team: getTeamForAgent(lastWeekData.bestDayAgent)?.name || null
          } : null
        },
        currentWeek: {
          topWeekly: currentWeekData.topWeeklyAgent ? {
            name: currentWeekData.topWeeklyAgent,
            commission: currentWeekData.topWeeklyCommission,
            team: getTeamForAgent(currentWeekData.topWeeklyAgent)?.name || null
          } : null,
          bestDay: currentWeekData.bestDayAgent ? {
            name: currentWeekData.bestDayAgent,
            date: currentWeekData.bestDayDate,
            commission: currentWeekData.bestDayCommission,
            team: getTeamForAgent(currentWeekData.bestDayAgent)?.name || null
          } : null
        }
      };
    },
    staleTime: 60000, // 1 minute cache
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Godmorgen";
    if (hour < 17) return "God eftermiddag";
    return "God aften";
  };

  const firstName = employee?.first_name || "kollega";

  const formatCommission = (amount: number) => {
    return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);
  };

  // Format name as "FirstName L" (e.g., "Kasper M")
  const formatShortName = (fullName: string | null | undefined) => {
    if (!fullName) return "Ukendt";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}`;
  };

  const formatDateLong = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "EEEE d. MMMM", { locale: da });
    } catch {
      return dateStr;
    }
  };

  const formatCelebrationDate = (date: Date, isToday: boolean) => {
    if (isToday) return "I dag";
    return format(date, "d. MMM", { locale: da });
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-6 md:p-8 space-y-8">
        {/* Hero Welcome Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-8 md:p-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {getGreeting()}, {firstName}! <span className="inline-block animate-pulse">👋</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                Velkommen til en ny dag fuld af muligheder.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 shrink-0"
            >
              <LogOut className="h-4 w-4" />
              Log ud
            </Button>
          </div>
        </section>

        {/* League Promo Card */}
        <LeaguePromoCard />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Performance */}
          <Card className="lg:col-span-2 border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Target className="w-5 h-5 text-primary" />
                  {teamGoal ? `${(teamGoal.teams as { name: string })?.name || "Team"} mål` : "Teammål"} ({format(payrollPeriod.start, "d. MMM", { locale: da })} - {format(payrollPeriod.end, "d. MMM", { locale: da })})
                </CardTitle>
                {canEditHomeGoals && manageableTeams.length > 0 && (
                  <Dialog open={addTeamGoalOpen} onOpenChange={(open) => {
                    setAddTeamGoalOpen(open);
                    if (open) {
                      // Pre-select team if user has one or if editing existing goal
                      const preselectedTeam = teamGoal?.team_id || (userTeams[0]?.teams as { id: string })?.id || "";
                      setSelectedTeamId(preselectedTeam);
                      if (teamGoal) {
                        setNewSalesTarget(String(teamGoal.target_amount || 100000));
                      }
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Plus className="w-4 h-4" /> {teamGoal ? "Rediger mål" : "Sæt mål"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Sæt teammål for lønperioden</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-muted-foreground">
                          Periode: {format(payrollPeriod.start, "d. MMM", { locale: da })} - {format(payrollPeriod.end, "d. MMM yyyy", { locale: da })}
                        </p>
                        <div className="space-y-2">
                          <Label>Vælg team</Label>
                          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Vælg team" />
                            </SelectTrigger>
                            <SelectContent>
                              {manageableTeams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Målbeløb (DKK)</Label>
                          <Input 
                            type="number" 
                            value={newSalesTarget}
                            onChange={(e) => setNewSalesTarget(e.target.value)}
                            min="1"
                            placeholder="fx 350000"
                          />
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={() => {
                            if (selectedTeamId) {
                              addTeamGoalMutation.mutate({ 
                                teamId: selectedTeamId, 
                                targetAmount: parseInt(newSalesTarget) || 100000,
                              });
                            } else {
                              toast.error("Vælg venligst et team");
                            }
                          }}
                          disabled={addTeamGoalMutation.isPending || !selectedTeamId}
                        >
                          Gem teammål
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Owner/Manager view - show all teams */}
              {canEditHomeGoals ? (
                allTeamGoals.length > 0 ? (
                  <div className="space-y-4">
                    {allTeamGoals.map((goal: any) => (
                      <div key={goal.id} className="p-4 rounded-lg bg-muted/50 border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{(goal.teams as { name: string })?.name || "Team"}</span>
                          <span className="text-lg font-bold text-primary">
                            {goal.progress?.toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={goal.progress || 0} className="h-3 bg-muted" />
                        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                          <span>{formatCurrency(goal.currentAmount || 0)}</span>
                          <span>Mål: {formatCurrency(goal.target_amount)}</span>
                        </div>
                        
                        <div className="mt-3 flex justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTeamGoalMutation.mutate(goal.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Slet
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    <p>Ingen teammål sat for denne lønperiode.</p>
                    <p className="text-xs mt-1">Klik "Sæt mål" for at komme i gang.</p>
                  </div>
                )
              ) : teamGoal ? (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">
                      {(teamGoal as any).teams?.name || userTeams[0]?.teams?.name || "Team"} – lønperiode
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      {teamPerformance.progress.toFixed(0)}%
                    </span>
                  </div>
                  <Progress 
                    value={teamPerformance.progress} 
                    className="h-4 bg-muted"
                  />
                  <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                    <span>{formatCurrency(teamPerformance.currentAmount)}</span>
                    <span>Mål: {formatCurrency(teamPerformance.targetAmount)}</span>
                  </div>
                  
                  {/* Progress vs Expected bar */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-muted-foreground">
                        Fremskridt vs. forventet (dag {workingDaysStats.elapsedWorkingDays} af {workingDaysStats.totalWorkingDays})
                      </span>
                      <span className={`text-sm font-semibold ${
                        teamPerformance.progressVsExpected >= 100 ? 'text-green-600' :
                        teamPerformance.progressVsExpected >= 85 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {teamPerformance.progressVsExpected.toFixed(0)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(teamPerformance.progressVsExpected, 100)} 
                      className={`h-2 ${
                        teamPerformance.progressVsExpected >= 100 ? '[&>div]:bg-green-500' :
                        teamPerformance.progressVsExpected >= 85 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'
                      }`}
                    />
                  </div>
                  
                  {(teamGoal as any).isFallback && (
                    <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground flex items-center gap-2">
                      <Info className="h-3 w-3 flex-shrink-0" />
                      <span>Målet er summen af alle teammedlemmers individuelle mål.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-6">
                  {userTeams.length > 0 ? (
                    <>
                      <p className="font-medium text-foreground mb-1">{userTeams[0]?.teams?.name}</p>
                      <p>Ingen teammål sat for denne lønperiode.</p>
                      <p className="text-xs mt-2">Kontakt din teamleder for at få sat et mål.</p>
                    </>
                  ) : (
                    <p>Du er ikke tilknyttet et team endnu.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personal Overview */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="w-5 h-5 text-primary" />
                Dit overblik
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {personalStats ? (
                <>
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-primary mb-1">
                      {formatCommission(personalStats.periodCommission)}
                    </div>
                    <p className="text-sm text-muted-foreground">provision i lønperiode</p>
                  </div>
                  
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Salg i lønperiode</span>
                      <span className="font-semibold">{personalStats.periodSalesCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Salg i dag</span>
                      <span className="font-semibold">{personalStats.todaySalesCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Provision i dag</span>
                      <span className="font-semibold">{formatCommission(personalStats.todayCommission)}</span>
                    </div>
                  </div>

                  {/* Daily Goal Section */}
                  {dailyGoalStats ? (
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 mb-3">
                        <Flame className={`w-4 h-4 ${
                          dailyGoalStats.hitDailyGoal 
                            ? 'text-green-500' 
                            : dailyGoalStats.todayProgress >= 50 
                              ? 'text-yellow-500' 
                              : 'text-red-500'
                        }`} />
                        <span className="text-sm font-medium">Dagsmål</span>
                        {dailyGoalStats.hitDailyGoal && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs ml-auto">
                            🎉 Nået!
                          </Badge>
                        )}
                      </div>
                      
                      {/* Progress Ring + Stats */}
                      <div className="flex items-center gap-4">
                        {/* Circular Progress */}
                        <div className="relative w-20 h-20 flex-shrink-0">
                          <svg className="w-20 h-20 transform -rotate-90">
                            {/* Background circle */}
                            <circle
                              cx="40"
                              cy="40"
                              r="32"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="none"
                              className="text-muted/30"
                            />
                            {/* Progress circle */}
                            <circle
                              cx="40"
                              cy="40"
                              r="32"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="none"
                              strokeDasharray={`${Math.min(dailyGoalStats.todayProgress, 100) * 2.01} 201`}
                              strokeLinecap="round"
                              className={`transition-all duration-700 ease-out ${
                                dailyGoalStats.hitDailyGoal 
                                  ? 'text-green-500' 
                                  : dailyGoalStats.todayProgress >= 50 
                                    ? 'text-yellow-500' 
                                    : 'text-red-500'
                              }`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-lg font-bold ${
                              dailyGoalStats.hitDailyGoal 
                                ? 'text-green-600 dark:text-green-400' 
                                : dailyGoalStats.todayProgress >= 50 
                                  ? 'text-yellow-600 dark:text-yellow-400' 
                                  : 'text-red-600 dark:text-red-400'
                            }`}>
                              {Math.round(dailyGoalStats.todayProgress)}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Stats */}
                        <div className="flex-1 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">I dag</span>
                            <span className="font-semibold">{formatCommission(personalStats.todayCommission)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Dagsmål</span>
                            <span className="font-medium">{formatCommission(dailyGoalStats.dailyTarget)}</span>
                          </div>
                          {!dailyGoalStats.hitDailyGoal && (
                            <div className="flex justify-between text-sm pt-1 border-t border-dashed">
                              <span className="text-muted-foreground">Mangler</span>
                              <span className={`font-semibold ${
                                dailyGoalStats.todayProgress >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {formatCommission(dailyGoalStats.todayRemaining)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Motivational status */}
                      <div className={`mt-3 text-center text-xs py-1.5 rounded-full ${
                        dailyGoalStats.hitDailyGoal 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : dailyGoalStats.todayProgress >= 75
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : dailyGoalStats.todayProgress >= 50
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-muted text-muted-foreground'
                      }`}>
                        {dailyGoalStats.hitDailyGoal 
                          ? '🔥 Fantastisk! Du har nået dit dagsmål!'
                          : dailyGoalStats.todayProgress >= 75
                            ? `💪 Næsten! Kun ${formatCommission(dailyGoalStats.todayRemaining)} tilbage`
                            : dailyGoalStats.todayProgress >= 50
                              ? `📈 Du er ${Math.round(dailyGoalStats.todayProgress)}% af vejen`
                              : dailyGoalStats.todayProgress > 0
                                ? `🎯 Fortsæt! ${formatCommission(dailyGoalStats.todayRemaining)} til målet`
                                : `🚀 ${workingDaysStats.totalWorkingDays - workingDaysStats.elapsedWorkingDays} arbejdsdage tilbage`
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 border-t">
                      <Link 
                        to="/my-goals" 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Sæt dit personlige mål</span>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">Ingen agent mapping fundet.</p>
                  <p className="text-xs mt-1">Kontakt din leder for at blive koblet til en dialer agent.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Celebrations - Birthdays & Anniversaries */}
        {celebrations.length > 0 && (
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <PartyPopper className="w-5 h-5 text-primary" />
                Fødselsdage & Jubilæer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {celebrations.map((celebration, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                      celebration.isToday 
                        ? "bg-primary/10 border-primary/30 ring-2 ring-primary/50" 
                        : "bg-muted/50 border-border"
                    }`}
                  >
                    {celebration.type === 'birthday' ? (
                      <Cake className="w-5 h-5 text-primary" />
                    ) : (
                      <Award className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{celebration.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {celebration.type === 'anniversary' 
                          ? (celebration.years === 0.5 ? '6 mdr. jubilæum' : `${celebration.years} års jubilæum`)
                          : `Fylder ${celebration.years} år`
                        }
                        {" • "}
                        <span className={celebration.isToday ? "font-semibold text-primary" : ""}>
                          {formatCelebrationDate(celebration.date, celebration.isToday)}
                        </span>
                      </p>
                    </div>
                    {celebration.isToday && <span className="text-xl">🎉</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recognition & Appreciation */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Star className="w-5 h-5 text-amber-500" />
                Anerkendelser
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Employee of the Week - Last Week */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top medarbejder</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Last Week */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                      <Award className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider">Sidste uge</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm text-amber-900 dark:text-amber-100 truncate">
                          {formatShortName(weeklyRecognition?.lastWeek?.topWeekly?.name) || "Ingen data"}
                        </p>
                        {weeklyRecognition?.lastWeek?.topWeekly?.team && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">{weeklyRecognition.lastWeek.topWeekly.team}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {weeklyRecognition?.lastWeek?.topWeekly 
                          ? formatCommission(weeklyRecognition.lastWeek.topWeekly.commission)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {/* Current Week */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-2 border-amber-200 dark:border-amber-800">
                    <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
                      <Zap className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-orange-700 dark:text-orange-400 uppercase tracking-wider">Denne uge</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm text-orange-900 dark:text-orange-100 truncate">
                          {formatShortName(weeklyRecognition?.currentWeek?.topWeekly?.name) || "Ingen data endnu"}
                        </p>
                        {weeklyRecognition?.currentWeek?.topWeekly?.team && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">{weeklyRecognition.currentWeek.topWeekly.team}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        {weeklyRecognition?.currentWeek?.topWeekly 
                          ? formatCommission(weeklyRecognition.currentWeek.topWeekly.commission)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Best Day of the Week */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bedste dag</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Last Week */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
                      <CalendarDays className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-blue-700 dark:text-blue-400 uppercase tracking-wider">Sidste uge</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm text-blue-900 dark:text-blue-100 truncate">
                          {formatShortName(weeklyRecognition?.lastWeek?.bestDay?.name) || "Ingen data"}
                        </p>
                        {weeklyRecognition?.lastWeek?.bestDay?.team && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">{weeklyRecognition.lastWeek.bestDay.team}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        {weeklyRecognition?.lastWeek?.bestDay 
                          ? `${formatDateLong(weeklyRecognition.lastWeek.bestDay.date)} - ${formatCommission(weeklyRecognition.lastWeek.bestDay.commission)}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {/* Current Week */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-2 border-blue-200 dark:border-blue-800">
                    <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Denne uge</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm text-indigo-900 dark:text-indigo-100 truncate">
                          {formatShortName(weeklyRecognition?.currentWeek?.bestDay?.name) || "Ingen data endnu"}
                        </p>
                        {weeklyRecognition?.currentWeek?.bestDay?.team && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">{weeklyRecognition.currentWeek.bestDay.team}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-indigo-700 dark:text-indigo-300">
                        {weeklyRecognition?.currentWeek?.bestDay 
                          ? `${formatDateLong(weeklyRecognition.currentWeek.bestDay.date)} - ${formatCommission(weeklyRecognition.currentWeek.bestDay.commission)}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team & Community */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Users className="w-5 h-5 text-primary" />
                Team & Fællesskab
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Employees */}
              {newEmployees.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Gift className="w-4 h-4 text-primary" />
                    Velkommen til nye kolleger
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {newEmployees.map((emp) => (
                      <Badge 
                        key={emp.id} 
                        variant="secondary"
                        className="px-3 py-1.5 bg-primary/10 text-primary border-0"
                      >
                        {emp.first_name} {emp.last_name}
                        {(emp.teams as { name: string } | null)?.name && (
                          <span className="ml-1 opacity-70">({(emp.teams as { name: string }).name})</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Events */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Kommende begivenheder
                  </p>
                  <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Tilføj begivenhed</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="title">Titel *</Label>
                          <Input 
                            id="title"
                            value={newEvent.title}
                            onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Fx Fredagsbar"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date">Dato *</Label>
                          <Input 
                            id="date"
                            type="date"
                            value={newEvent.event_date}
                            onChange={(e) => setNewEvent(prev => ({ ...prev, event_date: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="time">Tidspunkt</Label>
                          <Input 
                            id="time"
                            type="time"
                            value={newEvent.event_time}
                            onChange={(e) => setNewEvent(prev => ({ ...prev, event_time: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="location">Sted</Label>
                          <Input 
                            id="location"
                            value={newEvent.location}
                            onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="Fx Kontoret"
                          />
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={() => addEventMutation.mutate(newEvent)}
                          disabled={!newEvent.title || !newEvent.event_date || addEventMutation.isPending}
                        >
                          {addEventMutation.isPending ? "Tilføjer..." : "Tilføj begivenhed"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-3">
                  {companyEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen kommende begivenheder</p>
                  ) : (
                    companyEvents.map((event) => (
                      <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group">
                        <div className="text-center min-w-[50px]">
                          <div className="text-2xl font-bold text-primary">
                            {format(parseISO(event.event_date), "d")}
                          </div>
                          <div className="text-xs text-muted-foreground uppercase">
                            {format(parseISO(event.event_date), "MMM", { locale: da })}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {event.event_time && `Kl. ${event.event_time.slice(0, 5)}`}
                            {event.event_time && event.location && " - "}
                            {event.location}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteEventMutation.mutate(event.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Motivational Quote */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
          <CardContent className="py-8 text-center">
            <p className="text-lg md:text-xl italic text-muted-foreground">
              "Succes er ikke endelig, fiasko er ikke fatal: Det er modet til at fortsætte, der tæller."
            </p>
            <p className="text-sm text-muted-foreground mt-2">— Winston Churchill</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Home;
