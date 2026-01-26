import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { 
  Cake, 
  Award, 
  Users,
  Calendar,
  Gift,
  PartyPopper,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInYears, startOfMonth, startOfWeek, endOfWeek, subWeeks, addDays, isSameDay, isAfter, isBefore, isWeekend } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { usePrecomputedKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { useActiveSeason, useMyEnrollment, useQualificationStandings } from "@/hooks/useLeagueData";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";

// New optimized components
import { HeroPerformanceCard } from "@/components/home/HeroPerformanceCard";
import { QuickActionsBar } from "@/components/home/QuickActionsBar";
import { CompactLeagueView } from "@/components/home/CompactLeagueView";
import { TabbedRecognitions } from "@/components/home/TabbedRecognitions";
import { StickyPerformanceBar } from "@/components/home/StickyPerformanceBar";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPreviewMode, previewEmployee } = useRolePreview();
  
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", event_date: "", event_time: "", location: "" });
  const [celebrationsOpen, setCelebrationsOpen] = useState(true);

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
  
  // Fetch current employee data
  const { data: employee } = useQuery({
    queryKey: ["home-employee", isPreviewMode, previewEmployee?.id, user?.email],
    queryFn: async () => {
      if (isPreviewMode && previewEmployee?.id) {
        const { data } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, job_title, team_id, employment_start_date")
          .eq("id", previewEmployee.id)
          .maybeSingle();
        return data;
      }
      
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
    staleTime: 60000,
  });

  // League data for sticky bar
  const { data: season } = useActiveSeason();
  const { data: enrollment } = useMyEnrollment(season?.id);
  const isEnrolledInLeague = !!enrollment;
  const { data: currentEmployeeId } = useCurrentEmployeeId();
  const { data: allStandings = [] } = useQualificationStandings(season?.id);
  
  const leagueRank = useMemo(() => {
    if (!currentEmployeeId || allStandings.length === 0) return null;
    const myIndex = allStandings.findIndex(s => s.employee_id === currentEmployeeId);
    if (myIndex === -1) return null;
    return allStandings[myIndex].overall_rank || (myIndex + 1);
  }, [currentEmployeeId, allStandings]);

  // Calculate payroll period (15th-14th)
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

  // Cached personal stats
  const { data: cachedPersonalPayroll } = usePrecomputedKpis(
    ["sales_count", "total_commission"],
    "payroll_period",
    "employee",
    employee?.id
  );
  
  const personalStats = useMemo(() => {
    if (!employee?.id) return null;
    return {
      periodCommission: getKpiValue(cachedPersonalPayroll?.total_commission),
      periodSalesCount: getKpiValue(cachedPersonalPayroll?.sales_count),
    };
  }, [employee?.id, cachedPersonalPayroll]);

  // Fetch employee's personal sales goal
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
    staleTime: 60000,
  });

  const hasGoal = !!personalGoal?.target_amount;
  const targetAmount = personalGoal?.target_amount || 0;
  const progressPercent = targetAmount > 0 
    ? Math.round((personalStats?.periodCommission || 0) / targetAmount * 100) 
    : 0;

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
      
      const parseCprBirthday = (cpr: string): Date | null => {
        if (!cpr || cpr.length < 6) return null;
        const day = parseInt(cpr.substring(0, 2), 10);
        const month = parseInt(cpr.substring(2, 4), 10) - 1;
        let year = parseInt(cpr.substring(4, 6), 10);
        const currentYearShort = today.getFullYear() % 100;
        year = year > currentYearShort ? 1900 + year : 2000 + year;
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        return new Date(year, month, day);
      };
      
      employees?.forEach(emp => {
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
                years: age + (isAfter(birthdayThisYear, today) ? 1 : 0),
                date: birthdayThisYear,
                isToday: isSameDay(birthdayThisYear, today)
              });
            }
          }
        }
        
        if (emp.employment_start_date) {
          const startDate = parseISO(emp.employment_start_date);
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
        }
      });
      
      return results.sort((a, b) => a.date.getTime() - b.date.getTime());
    },
    staleTime: 300000,
  });

  // Only show today's celebrations prominently
  const todayCelebrations = celebrations.filter(c => c.isToday);
  const upcomingCelebrations = celebrations.filter(c => !c.isToday);

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
    staleTime: 60000,
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
    staleTime: 300000,
  });

  // Fetch weekly recognition data
  const { data: weeklyRecognition } = useQuery({
    queryKey: ["home-weekly-recognition"],
    queryFn: async () => {
      const now = new Date();
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      
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
      
      const processWeekSales = (weekSales: typeof sales) => {
        const agentTotals: Record<string, number> = {};
        const agentDailyTotals: Record<string, Record<string, number>> = {};
        
        weekSales.forEach(sale => {
          const agentName = sale.agent_name || "Unknown";
          const saleDate = sale.sale_datetime ? sale.sale_datetime.split("T")[0] : "";
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
      
      // Get team info
      const allAgentNames = [
        lastWeekData.topWeeklyAgent, lastWeekData.bestDayAgent,
        currentWeekData.topWeeklyAgent, currentWeekData.bestDayAgent
      ].filter(Boolean);
      
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name, email")
        .in("name", allAgentNames.length > 0 ? allAgentNames : ["__none__"]);
      
      const agentIds = agents?.map(a => a.id).filter(Boolean) || [];
      const { data: agentMappings } = agentIds.length > 0 ? await supabase
        .from("employee_agent_mapping")
        .select("agent_id, employee_id")
        .in("agent_id", agentIds) : { data: [] };
      
      const employeeIdsFromMappings = agentMappings?.map(m => m.employee_id).filter(Boolean) || [];
      
      const { data: teamMembersData } = employeeIdsFromMappings.length > 0 ? await supabase
        .from("team_members")
        .select("employee_id, teams(name)")
        .in("employee_id", employeeIdsFromMappings) : { data: [] };
      
      const getTeamForAgent = (agentName: string) => {
        const agent = agents?.find(a => a.name === agentName);
        if (!agent) return null;
        
        const mapping = agentMappings?.find(m => m.agent_id === agent.id);
        if (mapping?.employee_id) {
          const teamMember = teamMembersData?.find(tm => tm.employee_id === mapping.employee_id);
          if (teamMember?.teams && typeof teamMember.teams === 'object' && 'name' in teamMember.teams) {
            return { name: (teamMember.teams as { name: string }).name };
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
    staleTime: 60000,
  });

  const firstName = employee?.first_name || "kollega";

  const formatCelebrationDate = (date: Date, isToday: boolean) => {
    if (isToday) return "I dag";
    return format(date, "d. MMM", { locale: da });
  };

  return (
    <MainLayout>
      {/* Mobile Sticky Performance Bar */}
      <StickyPerformanceBar
        progressPercent={progressPercent}
        hasGoal={hasGoal}
        periodCommission={personalStats?.periodCommission || 0}
        leagueRank={leagueRank}
      />

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4 md:p-8 space-y-6">
        {/* ZONE 1: Hero Performance Card */}
        <HeroPerformanceCard
          firstName={firstName}
          periodCommission={personalStats?.periodCommission || 0}
          targetAmount={targetAmount}
          progressPercent={progressPercent}
          hasGoal={hasGoal}
          onLogout={handleLogout}
        />

        {/* ZONE 2: Quick Actions + League */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quick Actions - takes 2 cols on desktop */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <QuickActionsBar
              hasGoal={hasGoal}
              progressPercent={progressPercent}
              isEnrolledInLeague={isEnrolledInLeague}
            />
          </div>
          
          {/* Compact League View */}
          <CompactLeagueView />
        </div>

        {/* Today's Celebrations - Only if there are any */}
        {todayCelebrations.length > 0 && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 animate-fade-in">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                {todayCelebrations.map((celebration, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 px-4 py-2 rounded-xl bg-background/80 border border-primary/20"
                  >
                    {celebration.type === 'birthday' ? (
                      <span className="text-2xl">🎂</span>
                    ) : (
                      <Award className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">{celebration.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {celebration.type === 'anniversary' 
                          ? `${celebration.years} års jubilæum`
                          : `Fylder ${celebration.years} år`
                        }
                      </p>
                    </div>
                    <span className="text-xl">🎉</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ZONE 3: Secondary Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tabbed Recognitions */}
          <TabbedRecognitions
            currentWeek={{
              topWeekly: weeklyRecognition?.currentWeek?.topWeekly || null,
              bestDay: weeklyRecognition?.currentWeek?.bestDay || null,
            }}
            lastWeek={{
              topWeekly: weeklyRecognition?.lastWeek?.topWeekly || null,
              bestDay: weeklyRecognition?.lastWeek?.bestDay || null,
            }}
          />

          {/* Team & Community */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="w-4 h-4 text-primary" />
                Team & Fællesskab
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Employees */}
              {newEmployees.length > 0 && (
                <div className="space-y-2">
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
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Kommende begivenheder
                  </p>
                  <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
                <div className="space-y-2">
                  {companyEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">Ingen kommende begivenheder</p>
                  ) : (
                    companyEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 group">
                        <div className="text-center min-w-[40px]">
                          <div className="text-xl font-bold text-primary">
                            {format(parseISO(event.event_date), "d")}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {format(parseISO(event.event_date), "MMM", { locale: da })}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {event.event_time && `Kl. ${event.event_time.slice(0, 5)}`}
                            {event.event_time && event.location && " - "}
                            {event.location}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteEventMutation.mutate(event.id)}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Collapsible Upcoming Celebrations */}
        {upcomingCelebrations.length > 0 && (
          <Collapsible open={celebrationsOpen} onOpenChange={setCelebrationsOpen}>
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <PartyPopper className="w-4 h-4 text-primary" />
                      Kommende fødselsdage & jubilæer
                      <Badge variant="secondary" className="text-xs">{upcomingCelebrations.length}</Badge>
                    </CardTitle>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${celebrationsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {upcomingCelebrations.map((celebration, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm"
                      >
                        {celebration.type === 'birthday' ? (
                          <Cake className="w-4 h-4 text-primary" />
                        ) : (
                          <Award className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="font-medium">{celebration.name}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">
                          {formatCelebrationDate(celebration.date, celebration.isToday)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>
    </MainLayout>
  );
};

export default Home;
