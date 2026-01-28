import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
  ThumbsUp,
  ThumbsDown,
  Info,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EventDetailDialog } from "@/components/home/EventDetailDialog";
import { EventInvitationPopup } from "@/components/home/EventInvitationPopup";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInYears, startOfMonth, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { usePrecomputedKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { useActiveSeason, useMyEnrollment } from "@/hooks/useLeagueData";
import { usePersonalWeeklyStats } from "@/hooks/usePersonalWeeklyStats";

// New optimized components
import { HeroPerformanceCard } from "@/components/home/HeroPerformanceCard";
import { CompactLeagueView } from "@/components/home/CompactLeagueView";
import { DailyCommissionChart } from "@/components/home/DailyCommissionChart";
import { StickyPerformanceBar } from "@/components/home/StickyPerformanceBar";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPreviewMode, previewEmployee } = useRolePreview();
  
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ 
    title: "", 
    event_date: "", 
    event_time: "", 
    location: "", 
    description: "",
    show_popup: false,
    invited_teams: [] as string[]
  });
  const [celebrationsOpen, setCelebrationsOpen] = useState(true);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<string | null>(null);

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

  // League data
  const { data: season } = useActiveSeason();
  const { data: enrollment } = useMyEnrollment(season?.id);
  const isEnrolledInLeague = !!enrollment;

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

  // Fetch teams for event creation
  const { data: teams = [] } = useQuery({
    queryKey: ["teams-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      return data || [];
    },
    staleTime: 300000,
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
    staleTime: 60000,
  });

  // Fetch event attendees
  const { data: eventAttendees = [] } = useQuery({
    queryKey: ["event-attendees", companyEvents.map(e => e.id)],
    queryFn: async () => {
      const eventIds = companyEvents.map(e => e.id);
      if (eventIds.length === 0) return [];
      const { data } = await supabase
        .from("event_attendees")
        .select(`
          *,
          employee:employee_id(id, first_name, last_name)
        `)
        .in("event_id", eventIds);
      return data || [];
    },
    enabled: companyEvents.length > 0,
    staleTime: 30000,
  });

  // Toggle attendance mutation
  const toggleAttendanceMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: 'attending' | 'not_attending' }) => {
      if (!employee?.id) throw new Error("Ikke logget ind");
      
      const { error } = await supabase
        .from("event_attendees")
        .upsert({
          event_id: eventId,
          employee_id: employee.id,
          status: status,
        }, { onConflict: 'event_id,employee_id' });
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees"] });
      toast.success("Din deltagelse er opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere deltagelse");
    }
  });

  // Helper to get attendees for a specific event
  const getEventAttendees = (eventId: string) => {
    return eventAttendees.filter(a => a.event_id === eventId && a.status === 'attending');
  };

  // Helper to get current user's attendance status
  const getMyAttendance = (eventId: string): 'attending' | 'not_attending' | null => {
    if (!employee?.id) return null;
    const myAttendance = eventAttendees.find(a => a.event_id === eventId && a.employee_id === employee.id);
    return myAttendance?.status as 'attending' | 'not_attending' | null;
  };

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async (event: typeof newEvent) => {
      // 1. Insert event
      const { data: createdEvent, error } = await supabase
        .from("company_events")
        .insert({
          title: event.title,
          event_date: event.event_date,
          event_time: event.event_time || null,
          location: event.location || null,
          description: event.description || null,
          show_popup: event.show_popup,
          created_by: user?.id
        })
        .select()
        .single();
      if (error) throw error;
      
      // 2. Insert team invitations if any
      if (event.invited_teams.length > 0 && createdEvent) {
        const { error: invError } = await supabase
          .from("event_team_invitations")
          .insert(event.invited_teams.map(teamId => ({
            event_id: createdEvent.id,
            team_id: teamId
          })));
        if (invError) throw invError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-company-events"] });
      setAddEventOpen(false);
      setNewEvent({ title: "", event_date: "", event_time: "", location: "", description: "", show_popup: false, invited_teams: [] });
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

  // Use personal weekly stats hook
  const { data: personalWeeklyStats } = usePersonalWeeklyStats(employee?.id);

  const firstName = employee?.first_name || "kollega";

  const formatCelebrationDate = (date: Date, isToday: boolean) => {
    if (isToday) return "I dag";
    return format(date, "d. MMM", { locale: da });
  };

  // Get selected event for detail dialog
  const selectedEvent = companyEvents.find(e => e.id === selectedEventForDetail);
  const selectedEventAttendees = selectedEventForDetail 
    ? eventAttendees.filter(a => a.event_id === selectedEventForDetail)
    : [];
  const selectedEventMyStatus = selectedEventForDetail 
    ? getMyAttendance(selectedEventForDetail) 
    : null;

  return (
    <MainLayout>
      {/* Event Invitation Popup - Shows on first login for invited employees */}
      <EventInvitationPopup 
        employeeId={employee?.id} 
        teamId={employee?.team_id} 
      />
      
      {/* Event Detail Dialog */}
      <EventDetailDialog
        event={selectedEvent ? {
          id: selectedEvent.id,
          title: selectedEvent.title,
          event_date: selectedEvent.event_date,
          event_time: selectedEvent.event_time,
          location: selectedEvent.location,
          description: selectedEvent.description,
        } : null}
        open={!!selectedEventForDetail}
        onOpenChange={(open) => !open && setSelectedEventForDetail(null)}
        attendees={selectedEventAttendees.map(a => ({
          id: a.id,
          event_id: a.event_id,
          employee_id: a.employee_id,
          status: a.status,
          employee: (a.employee as any) ? {
            id: (a.employee as any).id,
            first_name: (a.employee as any).first_name,
            last_name: (a.employee as any).last_name,
          } : null,
        }))}
        myStatus={selectedEventMyStatus}
        onToggleAttendance={(status) => {
          if (selectedEventForDetail) {
            toggleAttendanceMutation.mutate({ eventId: selectedEventForDetail, status });
          }
        }}
        isLoading={toggleAttendanceMutation.isPending}
      />

      {/* Mobile Sticky Performance Bar */}
      <StickyPerformanceBar
        progressPercent={progressPercent}
        hasGoal={hasGoal}
        periodCommission={personalStats?.periodCommission || 0}
      />

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4 md:p-8 space-y-6">
        {/* ZONE 1: Hero Performance Card - Full Width with integrated CTA */}
        <HeroPerformanceCard
          firstName={firstName}
          periodCommission={personalStats?.periodCommission || 0}
          targetAmount={targetAmount}
          progressPercent={progressPercent}
          hasGoal={hasGoal}
          onLogout={handleLogout}
          isEnrolledInLeague={isEnrolledInLeague}
        />

        {/* ZONE 2: League + Recognitions side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Compact League View */}
          <CompactLeagueView />

          {/* Daily Commission Chart */}
          <DailyCommissionChart
            dailyData={personalWeeklyStats?.dailyBreakdown || []}
          />
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
                      <Award className="w-5 h-5 text-warning" />
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


        {/* ZONE 3: Team & Community - Full Width */}
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
                    <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
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
                        <Label htmlFor="description">Beskrivelse</Label>
                        <Textarea 
                          id="description"
                          value={newEvent.description}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Beskriv begivenheden..."
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
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
                      
                      {/* Team selection */}
                      {teams.length > 0 && (
                        <div className="space-y-2">
                          <Label>Inviter teams</Label>
                          <div className="flex flex-wrap gap-3">
                            {teams.map((team) => (
                              <label key={team.id} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={newEvent.invited_teams.includes(team.id)}
                                  onCheckedChange={(checked) => {
                                    setNewEvent(prev => ({
                                      ...prev,
                                      invited_teams: checked 
                                        ? [...prev.invited_teams, team.id]
                                        : prev.invited_teams.filter(id => id !== team.id)
                                    }));
                                  }}
                                />
                                <span className="text-sm">{team.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Show popup toggle */}
                      <div className="flex items-center justify-between py-2">
                        <Label htmlFor="show-popup" className="cursor-pointer">
                          Vis popup-invitation ved login
                        </Label>
                        <Switch
                          id="show-popup"
                          checked={newEvent.show_popup}
                          onCheckedChange={(checked) => setNewEvent(prev => ({ ...prev, show_popup: checked }))}
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
                  companyEvents.slice(0, 3).map((event) => {
                    const attendees = getEventAttendees(event.id);
                    const myStatus = getMyAttendance(event.id);
                    
                    return (
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
                          <p 
                            className="font-medium text-sm truncate cursor-pointer hover:text-primary hover:underline transition-colors"
                            onClick={() => setSelectedEventForDetail(event.id)}
                          >
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground truncate">
                              {event.event_time && `Kl. ${event.event_time.slice(0, 5)}`}
                              {event.event_time && event.location && " - "}
                              {event.location}
                            </p>
                            {attendees.length > 0 && (
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <Badge variant="outline" className="cursor-pointer gap-1 text-xs px-1.5 py-0">
                                    <Users className="w-3 h-3" />
                                    {attendees.length}
                                  </Badge>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-56 p-3">
                                  <p className="font-medium text-sm mb-2">Deltagere</p>
                                  <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {attendees.map((a) => (
                                      <div key={a.id} className="flex items-center gap-2 text-sm">
                                        <Avatar className="h-5 w-5">
                                          <AvatarFallback className="text-[10px]">
                                            {(a.employee as any)?.first_name?.[0]}{(a.employee as any)?.last_name?.[0]}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">
                                          {(a.employee as any)?.first_name} {(a.employee as any)?.last_name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant={myStatus === 'attending' ? "default" : "ghost"}
                            size="sm"
                            className={`h-7 w-7 p-0 ${myStatus === 'attending' ? 'bg-primary text-primary-foreground' : ''}`}
                            onClick={() => toggleAttendanceMutation.mutate({ eventId: event.id, status: 'attending' })}
                            disabled={toggleAttendanceMutation.isPending}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant={myStatus === 'not_attending' ? "default" : "ghost"}
                            size="sm"
                            className={`h-7 w-7 p-0 ${myStatus === 'not_attending' ? 'bg-muted-foreground text-background' : ''}`}
                            onClick={() => toggleAttendanceMutation.mutate({ eventId: event.id, status: 'not_attending' })}
                            disabled={toggleAttendanceMutation.isPending}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setSelectedEventForDetail(event.id)}
                            title="Læs mere"
                          >
                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteEventMutation.mutate(event.id)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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
                          <Award className="w-4 h-4 text-warning" />
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
