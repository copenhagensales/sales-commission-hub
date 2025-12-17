import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Cake, 
  Award, 
  TrendingUp, 
  ArrowRight,
  Users,
  Calendar,
  Star,
  Heart,
  Sparkles,
  Gift,
  PartyPopper,
  Target,
  CalendarDays
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { da } from "date-fns/locale";

const Home = () => {
  const { user } = useAuth();
  
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

  // Fetch birthdays and anniversaries
  const { data: celebrations = [] } = useQuery({
    queryKey: ["home-celebrations"],
    queryFn: async () => {
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();
      
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, employment_start_date, cpr_number")
        .eq("is_active", true);
      
      const results: { type: 'birthday' | 'anniversary'; name: string; years?: number }[] = [];
      
      employees?.forEach(emp => {
        // Check anniversary
        if (emp.employment_start_date) {
          const startDate = parseISO(emp.employment_start_date);
          if (startDate.getMonth() + 1 === todayMonth && startDate.getDate() === todayDay) {
            const years = differenceInYears(today, startDate);
            if (years > 0) {
              results.push({ 
                type: 'anniversary', 
                name: `${emp.first_name} ${emp.last_name}`,
                years 
              });
            }
          }
        }
      });
      
      return results;
    },
  });

  // Fetch company sales performance
  const { data: companyPerformance } = useQuery({
    queryKey: ["home-company-performance"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      
      const { count } = await supabase
        .from("sale_items")
        .select("*", { count: "exact", head: true })
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);
      
      return {
        currentSales: count || 0,
        targetSales: 500, // Example target
        progress: Math.min(((count || 0) / 500) * 100, 100)
      };
    },
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

  // Fetch weekly recognition data (top seller by commission last week, best single day)
  const { data: weeklyRecognition } = useQuery({
    queryKey: ["home-weekly-recognition"],
    queryFn: async () => {
      const now = new Date();
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString();
      
      // Fetch all sales from last week with commission
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
      
      // Calculate total commission per agent
      const agentTotals: Record<string, number> = {};
      // Calculate best single day per agent
      const agentDailyTotals: Record<string, Record<string, number>> = {};
      
      sales.forEach(sale => {
        const agentName = sale.agent_name || "Unknown";
        const saleDate = sale.sale_datetime ? sale.sale_datetime.split("T")[0] : "";
        
        const saleCommission = sale.sale_items?.reduce((sum, item) => {
          return sum + ((item.mapped_commission || 0) * (item.quantity || 1));
        }, 0) || 0;
        
        // Total for the week
        agentTotals[agentName] = (agentTotals[agentName] || 0) + saleCommission;
        
        // Daily totals
        if (!agentDailyTotals[agentName]) {
          agentDailyTotals[agentName] = {};
        }
        agentDailyTotals[agentName][saleDate] = (agentDailyTotals[agentName][saleDate] || 0) + saleCommission;
      });
      
      // Find top weekly performer
      let topWeeklyAgent = "";
      let topWeeklyCommission = 0;
      Object.entries(agentTotals).forEach(([agent, total]) => {
        if (total > topWeeklyCommission) {
          topWeeklyCommission = total;
          topWeeklyAgent = agent;
        }
      });
      
      // Find best single day
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
      
      // Get team info for top performers
      const agentNames = [topWeeklyAgent, bestDayAgent].filter(Boolean);
      const { data: agents } = await supabase
        .from("agents")
        .select("name, email")
        .in("name", agentNames);
      
      // Map agent emails to employees
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

  // Get greeting based on time of day
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

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "EEEE d. MMMM", { locale: da });
    } catch {
      return dateStr;
    }
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
            
            {/* Today's Celebrations */}
            {celebrations.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {celebrations.map((celebration, idx) => (
                  <Badge 
                    key={idx}
                    variant="secondary" 
                    className="px-4 py-2 text-sm bg-background/80 backdrop-blur-sm"
                  >
                    {celebration.type === 'birthday' ? (
                      <>
                        <Cake className="w-4 h-4 mr-2 text-pink-500" />
                        {celebration.name} har fødselsdag! 🎂
                      </>
                    ) : (
                      <>
                        <PartyPopper className="w-4 h-4 mr-2 text-amber-500" />
                        {celebration.name} fejrer {celebration.years} års jubilæum! 🎉
                      </>
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company Performance */}
          <Card className="lg:col-span-2 border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Target className="w-5 h-5 text-primary" />
                Virksomhedens mål
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Månedligt salgsmål</span>
                  <span className="text-2xl font-bold text-primary">
                    {companyPerformance?.progress.toFixed(0) || 0}%
                  </span>
                </div>
                <Progress 
                  value={companyPerformance?.progress || 0} 
                  className="h-4 bg-muted"
                />
                <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                  <span>{companyPerformance?.currentSales || 0} salg</span>
                  <span>Mål: {companyPerformance?.targetSales || 500} salg</span>
                </div>
              </div>
              
              {/* Team Progress */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                {['Team A', 'Team B', 'Team C'].map((team, idx) => (
                  <div key={team} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{team}</span>
                      <span className="text-muted-foreground">{[78, 92, 65][idx]}%</span>
                    </div>
                    <Progress value={[78, 92, 65][idx]} className="h-2" />
                  </div>
                ))}
              </div>
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
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-primary mb-1">68%</div>
                <p className="text-sm text-muted-foreground">af dit månedsmål</p>
              </div>
              
              <div className="space-y-3 pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estimeret provision</span>
                  <span className="font-semibold">12.450 kr</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Til næste niveau</span>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    5 salg mere
                  </Badge>
                </div>
              </div>
              
              <Button className="w-full mt-4" variant="default">
                Se mine tal
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
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
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/50">
                  <Award className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Ugens medarbejder</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{weeklyRecognition?.topWeekly?.name || "Ingen data"}</p>
                    {weeklyRecognition?.topWeekly?.team && (
                      <Badge variant="secondary" className="text-xs">{weeklyRecognition.topWeekly.team}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {weeklyRecognition?.topWeekly 
                      ? `Højeste provision: ${formatCommission(weeklyRecognition.topWeekly.commission)}`
                      : "Mest provision i sidste uge"}
                  </p>
                </div>
              </div>

              {/* Best Day of the Week */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
                  <CalendarDays className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Ugens bedste dag</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{weeklyRecognition?.bestDay?.name || "Ingen data"}</p>
                    {weeklyRecognition?.bestDay?.team && (
                      <Badge variant="secondary" className="text-xs">{weeklyRecognition.bestDay.team}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {weeklyRecognition?.bestDay 
                      ? `${formatDate(weeklyRecognition.bestDay.date)} - ${formatCommission(weeklyRecognition.bestDay.commission)}`
                      : "Bedste enkeltdag i sidste uge"}
                  </p>
                </div>
              </div>

              {/* Deal of the Week (same person as best day) */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/50">
                  <Sparkles className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Ugens handel</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{weeklyRecognition?.bestDay?.name || "Ingen data"}</p>
                    {weeklyRecognition?.bestDay?.team && (
                      <Badge variant="secondary" className="text-xs">{weeklyRecognition.bestDay.team}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {weeklyRecognition?.bestDay 
                      ? `Bedste enkeltdag: ${formatCommission(weeklyRecognition.bestDay.commission)}`
                      : "Bedste dag målt i provision"}
                  </p>
                </div>
              </div>

              {/* Kudos */}
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-500" />
                  Seneste kudos
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 text-sm p-3 rounded-lg bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">MN</AvatarFallback>
                    </Avatar>
                    <div>
                      <p><span className="font-medium">Martin Nielsen</span> til <span className="font-medium">Anne Larsen</span></p>
                      <p className="text-muted-foreground">"Tak for hjælpen med præsentationen! 🙏"</p>
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
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Events */}
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Kommende begivenheder
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="text-center min-w-[50px]">
                      <div className="text-2xl font-bold text-primary">20</div>
                      <div className="text-xs text-muted-foreground uppercase">Dec</div>
                    </div>
                    <div>
                      <p className="font-medium">Julefrokost 🎄</p>
                      <p className="text-sm text-muted-foreground">Kl. 16:00 - Kontoret</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="text-center min-w-[50px]">
                      <div className="text-2xl font-bold text-primary">27</div>
                      <div className="text-xs text-muted-foreground uppercase">Dec</div>
                    </div>
                    <div>
                      <p className="font-medium">Fredagsbar</p>
                      <p className="text-sm text-muted-foreground">Kl. 15:30 - Loungeområdet</p>
                    </div>
                  </div>
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
