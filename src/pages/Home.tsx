import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Trash2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

const Home = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", event_date: "", event_time: "", location: "" });
  
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
      
      employees?.forEach(emp => {
        // Check anniversary (next 14 days)
        if (emp.employment_start_date) {
          const startDate = parseISO(emp.employment_start_date);
          const years = differenceInYears(today, startDate);
          
          if (years > 0) {
            // Create this year's anniversary date
            const anniversaryThisYear = new Date(today.getFullYear(), startDate.getMonth(), startDate.getDate());
            
            // Check if it's within next 14 days
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
        targetSales: 500,
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
                          ? `${celebration.years} års jubilæum` 
                          : "Fødselsdag"
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
