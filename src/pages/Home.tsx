import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HeadToHeadComparison } from "@/components/home/HeadToHeadComparison";
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
  Swords
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

const Home = () => {
  const { user } = useAuth();
  const { canEditHomeGoals } = usePermissions();
  const queryClient = useQueryClient();
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", event_date: "", event_time: "", location: "" });
  const [showH2H, setShowH2H] = useState(() => {
    try {
      return localStorage.getItem("home-show-h2h") === "true";
    } catch { return false; }
  });

  const toggleH2H = (show: boolean) => {
    setShowH2H(show);
    try { localStorage.setItem("home-show-h2h", show ? "true" : "false"); } catch {}
  };
  
  // Fetch current employee data
  const { data: employee } = useQuery({
    queryKey: ["home-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, team_id, employment_start_date")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.email,
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
  const [newSalesTarget, setNewSalesTarget] = useState<string>("100");
  const [newBonusDescription, setNewBonusDescription] = useState<string>("");

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
  });

  // Fetch team monthly goals with sales progress
  const { data: teamGoal } = useQuery({
    queryKey: ["home-team-goal", userTeams],
    queryFn: async () => {
      if (userTeams.length === 0) return null;
      
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();

      const teamIds = userTeams.map(t => (t.teams as { id: string })?.id).filter(Boolean);
      if (teamIds.length === 0) return null;

      // Fetch goal for user's team(s)
      const { data: goals } = await supabase
        .from("team_monthly_goals")
        .select("*, teams(id, name)")
        .eq("year", year)
        .eq("month", month)
        .in("team_id", teamIds)
        .limit(1)
        .maybeSingle();

      if (!goals) return null;

      // Get all employees in the team
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("employee_id")
        .eq("team_id", goals.team_id);

      const employeeIds = teamMembers?.map(m => m.employee_id) || [];
      if (employeeIds.length === 0) return { ...goals, currentSales: 0, progress: 0 };

      // Get agent mappings for team employees
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, agents(name)")
        .in("employee_id", employeeIds);

      const agentNames = agentMappings?.map(m => (m.agents as { name: string })?.name).filter(Boolean) || [];
      if (agentNames.length === 0) return { ...goals, currentSales: 0, progress: 0 };

      // Fetch sales for team's agents
      const { data: sales } = await supabase
        .from("sales")
        .select("id, sale_items(quantity)")
        .in("agent_name", agentNames)
        .gte("sale_datetime", monthStart)
        .lte("sale_datetime", monthEnd);

      const currentSales = sales?.reduce((sum, s) => {
        return sum + (s.sale_items?.reduce((itemSum, item) => itemSum + (item.quantity || 1), 0) || 0);
      }, 0) || 0;

      const progress = goals.sales_target > 0 ? Math.min((currentSales / goals.sales_target) * 100, 100) : 0;
      return { ...goals, currentSales, progress };
    },
    enabled: userTeams.length > 0,
  });

  // Add/update team goal mutation
  const addTeamGoalMutation = useMutation({
    mutationFn: async ({ teamId, target, bonusDescription }: { teamId: string; target: number; bonusDescription?: string }) => {
      const now = new Date();
      const { error } = await supabase
        .from("team_monthly_goals")
        .upsert({
          team_id: teamId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          sales_target: target,
          bonus_description: bonusDescription || null
        }, { onConflict: "team_id,year,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-team-goal"] });
      setAddTeamGoalOpen(false);
      setNewSalesTarget("100");
      setNewBonusDescription("");
      toast.success("Teammål opdateret");
    },
    onError: () => toast.error("Kunne ikke opdatere teammål")
  });

  // Delete team goal mutation
  const deleteTeamGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("team_monthly_goals")
        .delete()
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-team-goal"] });
      toast.success("Teammål slettet");
    }
  });

  // Team performance from team goal
  const teamPerformance = useMemo(() => {
    if (!teamGoal) return { currentSales: 0, targetSales: 0, progress: 0 };
    return { 
      currentSales: teamGoal.currentSales || 0, 
      targetSales: teamGoal.sales_target || 0, 
      progress: teamGoal.progress || 0 
    };
  }, [teamGoal]);

  // Fetch employee's personal sales stats via agent mapping
  const { data: personalStats } = useQuery({
    queryKey: ["home-personal-stats", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return null;
      
      // Get agent mappings for this employee
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, agents(name)")
        .eq("employee_id", employee.id);
      
      if (!mappings || mappings.length === 0) return null;
      
      const agentNames = mappings.map(m => (m.agents as { name: string } | null)?.name).filter(Boolean);
      if (agentNames.length === 0) return null;
      
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      
      // Fetch monthly sales for this employee's agents
      const { data: monthlySales } = await supabase
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
        .in("agent_name", agentNames)
        .gte("sale_datetime", monthStart)
        .lte("sale_datetime", monthEnd);
      
      // Fetch today's sales
      const { data: todaySales } = await supabase
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
        .in("agent_name", agentNames)
        .gte("sale_datetime", todayStart)
        .lte("sale_datetime", todayEnd);
      
      // Calculate totals
      const monthlyCommission = monthlySales?.reduce((total, sale) => {
        return total + (sale.sale_items?.reduce((sum, item) => {
          return sum + ((item.mapped_commission || 0) * (item.quantity || 1));
        }, 0) || 0);
      }, 0) || 0;
      
      const monthlySalesCount = monthlySales?.length || 0;
      const todaySalesCount = todaySales?.length || 0;
      
      const todayCommission = todaySales?.reduce((total, sale) => {
        return total + (sale.sale_items?.reduce((sum, item) => {
          return sum + ((item.mapped_commission || 0) * (item.quantity || 1));
        }, 0) || 0);
      }, 0) || 0;
      
      return {
        monthlyCommission,
        monthlySalesCount,
        todaySalesCount,
        todayCommission
      };
    },
    enabled: !!employee?.id,
  });

  // Fetch new employees (started this month)
  const { data: newEmployees = [] } = useQuery({
    queryKey: ["home-new-employees"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, employment_start_date")
        .eq("is_active", true)
        .gte("employment_start_date", monthStart)
        .order("employment_start_date", { ascending: false })
        .limit(5);
      
      return data || [];
    },
  });

  // Fetch weekly recognition data
  const { data: weeklyRecognition } = useQuery({
    queryKey: ["home-weekly-recognition"],
    queryFn: async () => {
      const now = new Date();
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
      
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
        .lte("sale_datetime", lastWeekEnd);
      
      if (!sales || sales.length === 0) {
        return { topWeekly: null, bestDay: null };
      }
      
      const agentTotals: Record<string, number> = {};
      const agentDailyTotals: Record<string, Record<string, number>> = {};
      
      sales.forEach(sale => {
        const agentName = sale.agent_name || "Unknown";
        const saleDate = sale.sale_datetime ? sale.sale_datetime.split("T")[0] : "";
        
        const saleCommission = sale.sale_items?.reduce((sum, item) => {
          return sum + ((item.mapped_commission || 0) * (item.quantity || 1));
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
      
      const agentNames = [topWeeklyAgent, bestDayAgent].filter(Boolean);
      const { data: agents } = await supabase
        .from("agents")
        .select("name, email")
        .in("name", agentNames);
      
      const agentEmails = agents?.map(a => a.email).filter(Boolean) || [];
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email, private_email, team_id, teams:team_id(name)")
        .or(agentEmails.map(e => `work_email.eq.${e},private_email.eq.${e}`).join(",") || "id.is.null");
      
      const getTeamForAgent = (agentName: string) => {
        const agent = agents?.find(a => a.name === agentName);
        if (!agent?.email) return null;
        const emp = employees?.find(e => e.work_email === agent.email || e.private_email === agent.email);
        return emp?.teams as { name: string } | null;
      };
      
      return {
        topWeekly: topWeeklyAgent ? {
          name: topWeeklyAgent,
          commission: topWeeklyCommission,
          team: getTeamForAgent(topWeeklyAgent)?.name || null
        } : null,
        bestDay: bestDayAgent ? {
          name: bestDayAgent,
          date: bestDayDate,
          commission: bestDayCommission,
          team: getTeamForAgent(bestDayAgent)?.name || null
        } : null
      };
    },
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
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {getGreeting()}, {firstName}! <span className="inline-block animate-pulse">👋</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Velkommen til en ny dag fuld af muligheder.
            </p>
          </div>
        </section>

        {/* Celebrations - Birthdays & Anniversaries */}
        {celebrations.length > 0 && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <PartyPopper className="w-5 h-5 text-pink-500" />
                Fødselsdage & Jubilæer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {celebrations.map((celebration, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                      celebration.isToday 
                        ? "bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 ring-2 ring-amber-400" 
                        : "bg-background/80"
                    }`}
                  >
                    {celebration.type === 'birthday' ? (
                      <Cake className="w-5 h-5 text-pink-500" />
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
                        <span className={celebration.isToday ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Performance */}
          <Card className="lg:col-span-2 border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Target className="w-5 h-5 text-primary" />
                  {teamGoal ? `${(teamGoal.teams as { name: string })?.name || "Team"} mål` : "Teammål"} ({format(new Date(), "MMMM yyyy", { locale: da })})
                </CardTitle>
                {canEditHomeGoals && userTeams.length > 0 && (
                  <Dialog open={addTeamGoalOpen} onOpenChange={setAddTeamGoalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Plus className="w-4 h-4" /> {teamGoal ? "Rediger mål" : "Sæt mål"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Sæt teammål for {format(new Date(), "MMMM yyyy", { locale: da })}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Salgsmål (antal salg)</Label>
                          <Input 
                            type="number" 
                            value={newSalesTarget}
                            onChange={(e) => setNewSalesTarget(e.target.value)}
                            min="1"
                            placeholder="fx 100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Bonus beskrivelse (valgfrit)</Label>
                          <Input 
                            type="text" 
                            value={newBonusDescription}
                            onChange={(e) => setNewBonusDescription(e.target.value)}
                            placeholder="fx Gratis middag til hele teamet"
                          />
                          <p className="text-xs text-muted-foreground">Beskriv hvad teamet får som bonus hvis målet nås</p>
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={() => {
                            const teamId = userTeams[0]?.teams ? (userTeams[0].teams as { id: string }).id : null;
                            if (teamId) {
                              addTeamGoalMutation.mutate({ 
                                teamId, 
                                target: parseInt(newSalesTarget) || 100,
                                bonusDescription: newBonusDescription || undefined
                              });
                            }
                          }}
                          disabled={addTeamGoalMutation.isPending}
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
              {/* Team Progress */}
              {teamGoal ? (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Teamets månedsmål</span>
                    <span className="text-2xl font-bold text-primary">
                      {teamPerformance.progress.toFixed(0)}%
                    </span>
                  </div>
                  <Progress 
                    value={teamPerformance.progress} 
                    className="h-4 bg-muted"
                  />
                  <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                    <span>{teamPerformance.currentSales} salg</span>
                    <span>Mål: {teamPerformance.targetSales} salg</span>
                  </div>
                  
                  {/* Bonus description */}
                  {teamGoal.bonus_description && (
                    <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Teambonus ved opnået mål:</span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{teamGoal.bonus_description}</p>
                    </div>
                  )}
                  
                  {/* Delete button for owners */}
                  {canEditHomeGoals && (
                    <div className="mt-4 pt-4 border-t flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteTeamGoalMutation.mutate(teamGoal.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Slet mål
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-6">
                  {userTeams.length > 0 ? (
                    <>
                      <p>Ingen teammål sat for denne måned.</p>
                      {canEditHomeGoals && <p className="text-xs mt-1">Klik "Sæt mål" for at komme i gang.</p>}
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
                      {formatCommission(personalStats.monthlyCommission)}
                    </div>
                    <p className="text-sm text-muted-foreground">provision denne måned</p>
                  </div>
                  
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Salg denne måned</span>
                      <span className="font-semibold">{personalStats.monthlySalesCount}</span>
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
              {/* Employee of the Week */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/50">
                  <Award className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider">Ugens medarbejder</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">{weeklyRecognition?.topWeekly?.name || "Ingen data"}</p>
                    {weeklyRecognition?.topWeekly?.team && (
                      <Badge variant="secondary" className="text-xs">{weeklyRecognition.topWeekly.team}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {weeklyRecognition?.topWeekly 
                      ? `Højeste provision: ${formatCommission(weeklyRecognition.topWeekly.commission)}`
                      : "Mest provision i sidste uge"}
                  </p>
                </div>
              </div>

              {/* Best Day of the Week */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
                  <CalendarDays className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-700 dark:text-blue-400 uppercase tracking-wider">Ugens bedste dag</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-blue-900 dark:text-blue-100">{weeklyRecognition?.bestDay?.name || "Ingen data"}</p>
                    {weeklyRecognition?.bestDay?.team && (
                      <Badge variant="secondary" className="text-xs">{weeklyRecognition.bestDay.team}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {weeklyRecognition?.bestDay 
                      ? `${formatDateLong(weeklyRecognition.bestDay.date)} - ${formatCommission(weeklyRecognition.bestDay.commission)}`
                      : "Bedste enkeltdag i sidste uge"}
                  </p>
                </div>
              </div>

              {/* Deal of the Week */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/50">
                  <Sparkles className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-green-700 dark:text-green-400 uppercase tracking-wider">Ugens handel</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-green-900 dark:text-green-100">{weeklyRecognition?.bestDay?.name || "Ingen data"}</p>
                    {weeklyRecognition?.bestDay?.team && (
                      <Badge variant="secondary" className="text-xs">{weeklyRecognition.bestDay.team}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {weeklyRecognition?.bestDay 
                      ? `Bedste enkeltdag: ${formatCommission(weeklyRecognition.bestDay.commission)}`
                      : "Bedste dag målt i provision"}
                  </p>
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

        {/* Head to Head - Opt-in Section */}
        {showH2H ? (
          <HeadToHeadComparison 
            currentEmployeeId={employee?.id}
            currentEmployeeName={employee ? `${employee.first_name} ${employee.last_name}` : undefined}
            onHide={() => toggleH2H(false)}
          />
        ) : (
          <Card 
            className="border border-dashed border-slate-600/50 bg-gradient-to-r from-slate-900/50 to-slate-800/50 hover:border-amber-500/50 hover:from-slate-900/80 hover:to-slate-800/80 transition-all duration-300 cursor-pointer group"
            onClick={() => toggleH2H(true)}
          >
            <CardContent className="py-6 flex items-center justify-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                <Swords className="w-6 h-6 text-amber-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground group-hover:text-amber-400 transition-colors">
                  Vil du udfordre en kollega?
                </p>
                <p className="text-sm text-muted-foreground">
                  Klik her for at starte en Head-to-Head duel
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        )}

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
