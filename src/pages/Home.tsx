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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarLookup } from "@/hooks/useAvatarLookup";

import { 
  Cake, 
  Award, 
  Users,
  Calendar,
  PartyPopper,
  Plus,
  Trash2,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  UserPlus,
  UserMinus,
  Info,
  CalendarX,
  Pencil,
  Check,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EventDetailDialog } from "@/components/home/EventDetailDialog";
import { EditEventDialog } from "@/components/home/EditEventDialog";
import { EventInvitationPopup } from "@/components/home/EventInvitationPopup";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays, differenceInYears, startOfMonth, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { usePrecomputedKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { useActiveSeason, useMyEnrollment } from "@/hooks/useLeagueData";
import { usePersonalWeeklyStats } from "@/hooks/usePersonalWeeklyStats";

// New optimized components
import { HeroPerformanceCard } from "@/components/home/HeroPerformanceCard";
import { CompactLeagueView } from "@/components/home/CompactLeagueView";
import { CelebrationStrip } from "@/components/home/CelebrationStrip";
import { PlayerProfileHoverCard } from "@/components/profile-card/PlayerProfileHoverCard";
import { DailyCommissionChart } from "@/components/home/DailyCommissionChart";
import { StickyPerformanceBar } from "@/components/home/StickyPerformanceBar";
import { PendingContractBanner } from "@/components/home/PendingContractBanner";
import { PendingPulseSurveyBanner } from "@/components/home/PendingPulseSurveyBanner";
import { EventGallery } from "@/components/home/EventGallery";

import { getPayrollPeriod, getVacationPayRate } from "@/lib/calculations";


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
    requires_registration: false,
    invited_teams: [] as string[]
  });
  const [celebrationsOpen, setCelebrationsOpen] = useState(true);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  
  const { isOwner } = usePermissions();
  const lookupAvatar = useAvatarLookup();

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
          .select("id, first_name, last_name, job_title, team_id, employment_start_date, vacation_type")
          .eq("id", previewEmployee.id)
          .maybeSingle();
        return data;
      }
      
      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, team_id, employment_start_date, vacation_type")
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
  const payrollPeriod = useMemo(() => getPayrollPeriod(), []);

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

  // Vacation pay calculation using central calculations library
  const vacationPayRate = useMemo(() => {
    return getVacationPayRate(employee?.vacation_type || null);
  }, [employee?.vacation_type]);

  const vacationPay = (personalStats?.periodCommission || 0) * vacationPayRate;

  // Fetch upcoming birthdays and anniversaries (next 14 days)
  const { data: celebrations = [] } = useQuery({
    queryKey: ["home-celebrations"],
    queryFn: async () => {
      const today = new Date();
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, employment_start_date, cpr_number")
        .eq("is_active", true);
      
      const results: { employeeId: string; type: 'birthday' | 'anniversary'; name: string; years?: number; date: Date; isToday: boolean }[] = [];
      
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
                employeeId: emp.id,
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
          // Only show full-year anniversaries (skip ½-year)
          if (years >= 1) {
            const anniversaryThisYear = new Date(today.getFullYear(), startDate.getMonth(), startDate.getDate());
            const anniversaryYears = years + (isAfter(anniversaryThisYear, today) ? 1 : 0);
            
            if ((isSameDay(anniversaryThisYear, today) || isAfter(anniversaryThisYear, today)) && 
                isBefore(anniversaryThisYear, addDays(today, 14))) {
              results.push({ 
                employeeId: emp.id,
                type: 'anniversary', 
                name: `${emp.first_name} ${emp.last_name}`,
                years: anniversaryYears,
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
    mutationFn: async ({ eventId, status }: { eventId: string; status: 'attending' | 'maybe' | 'not_attending' }) => {
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
  const getMyAttendance = (eventId: string): 'attending' | 'maybe' | 'not_attending' | null => {
    if (!employee?.id) return null;
    const myAttendance = eventAttendees.find(a => a.event_id === eventId && a.employee_id === employee.id);
    return myAttendance?.status as 'attending' | 'maybe' | 'not_attending' | null;
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
          requires_registration: event.requires_registration,
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
      setNewEvent({ title: "", event_date: "", event_time: "", location: "", description: "", show_popup: false, requires_registration: false, invited_teams: [] });
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


  // Use personal weekly stats hook
  const { data: personalWeeklyStats } = usePersonalWeeklyStats(employee?.id);

  const firstName = employee?.first_name || "kollega";

  const greetingLabel = (() => {
    const hour = new Date().getHours();
    if (hour < 10) return "Godmorgen";
    if (hour < 12) return "God formiddag";
    if (hour < 17) return "God eftermiddag";
    return "Godaften";
  })();


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
          requires_registration: (selectedEvent as any).requires_registration,
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

      {/* Edit Event Dialog */}
      <EditEventDialog
        event={editingEvent ? companyEvents.find(e => e.id === editingEvent) ?? null : null}
        open={!!editingEvent}
        onOpenChange={(open) => !open && setEditingEvent(null)}
      />

      {/* Mobile Sticky Performance Bar */}
      <StickyPerformanceBar
        progressPercent={progressPercent}
        hasGoal={hasGoal}
        periodCommission={personalStats?.periodCommission || 0}
      />

      <div className="min-h-screen bg-background px-4 pb-16 pt-6 md:px-10 md:pt-8">
        <div className="flex flex-col gap-8">
          {/* Topbar */}
          <div className="flex items-end justify-between gap-4 border-b-2 border-[hsl(var(--cph-onyx))] pb-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--cph-emerald))] ring-2 ring-[hsl(var(--cph-onyx))]" />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-foreground/70">
                  {format(new Date(), "EEEE d. MMMM", { locale: da })} · Live
                </span>
              </div>
              <h1 className="text-[clamp(28px,4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground">
                {greetingLabel}, {firstName}
              </h1>
            </div>

            <div className="relative shrink-0">
              <Avatar className="h-12 w-12 border-2 border-[hsl(var(--cph-onyx))] md:h-14 md:w-14">
                <AvatarImage
                  src={
                    lookupAvatar({
                      employeeId: employee?.id,
                      name: [employee?.first_name, employee?.last_name].filter(Boolean).join(" "),
                    }) ?? undefined
                  }
                  alt={firstName}
                  className="object-cover"
                />
                <AvatarFallback className="bg-[hsl(var(--cph-onyx))] text-sm font-extrabold uppercase text-[hsl(var(--cph-light-blue))]">
                  {[employee?.first_name?.[0], employee?.last_name?.[0]].filter(Boolean).join("") ||
                    firstName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[hsl(var(--cph-emerald))] ring-2 ring-background" />
            </div>
          </div>

        {/* Kontrakt der afventer underskrift */}
        <PendingContractBanner employeeId={employee?.id} />

        {/* Pulsmåling der mangler besvarelse */}
        <PendingPulseSurveyBanner />


        {/* ZONE 1: Hero + seneste 10 dage */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroPerformanceCard
              firstName={firstName}
              periodCommission={personalStats?.periodCommission || 0}
              targetAmount={targetAmount}
              progressPercent={progressPercent}
              hasGoal={hasGoal}
              vacationPay={vacationPay}
              isEnrolledInLeague={isEnrolledInLeague}
            />
          </div>
          <DailyCommissionChart
            dailyData={personalWeeklyStats?.dailyBreakdown || []}
          />
        </div>

        {/* Today's Celebrations - Only if there are any */}
        {todayCelebrations.length > 0 && (
          <CelebrationStrip celebrations={todayCelebrations} />
        )}

        {/* ZONE 2: Liga + kommende begivenheder */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CompactLeagueView />
          </div>

        <Card className="h-full border-0 bg-card rounded-3xl">

          <CardHeader className="px-6 pb-2 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
                <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[hsl(var(--cph-onyx))]" />
                Næste begivenhed
              </CardTitle>

              <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 md:h-7 md:w-7 p-0">
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
                    
                    {/* Requires registration toggle */}
                    <div className="flex items-center justify-between py-2">
                      <Label htmlFor="requires-registration" className="cursor-pointer">
                        Kræver tilmelding
                      </Label>
                      <Switch
                        id="requires-registration"
                        checked={newEvent.requires_registration}
                        onCheckedChange={(checked) => setNewEvent(prev => ({ ...prev, requires_registration: checked }))}
                      />
                    </div>

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
          </CardHeader>
          <CardContent className="flex flex-col px-6 pb-6">
            {companyEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CalendarX className="mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm font-medium">Ingen kommende begivenheder</p>
                <p className="text-xs opacity-70">Tilføj en begivenhed med + knappen ovenfor</p>
              </div>
            ) : (
              (() => {
                const [featured, ...rest] = companyEvents.slice(0, 3);
                const attendees = getEventAttendees(featured.id);
                const myStatus = getMyAttendance(featured.id);
                const daysUntil = differenceInDays(parseISO(featured.event_date), new Date());
                const whenLabel =
                  daysUntil < 0
                    ? null
                    : daysUntil === 0
                      ? "I dag"
                      : daysUntil === 1
                        ? "I morgen"
                        : `Om ${daysUntil} dage`;
                const initials = (a: any) =>
                  `${a.employee?.first_name?.[0] ?? ""}${a.employee?.last_name?.[0] ?? ""}`.toUpperCase();

                return (
                  <div className="flex flex-col gap-5">
                    {/* Fremhævet begivenhed */}
                    <div className="flex items-start gap-4">
                      <div className="min-w-[60px] flex-none rounded-2xl bg-[hsl(var(--cph-onyx))] px-3.5 py-2.5 text-center text-[hsl(var(--cph-light-blue))]">
                        <div className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-[hsl(var(--cph-emerald))] tabular-nums">
                          {format(parseISO(featured.event_date), "d")}
                        </div>
                        <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
                          {format(parseISO(featured.event_date), "MMM", { locale: da })}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="cursor-pointer text-[17px] font-extrabold leading-[1.3] hover:underline"
                          onClick={() => setSelectedEventForDetail(featured.id)}
                        >
                          {featured.title}
                        </p>
                        <p className="mt-1 text-[13px] text-foreground/70">
                          {[
                            whenLabel,
                            featured.event_time ? `Kl. ${featured.event_time.slice(0, 5)}` : null,
                            featured.location,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex flex-none items-center gap-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setSelectedEventForDetail(featured.id)}
                          title="Læs mere"
                        >
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        {(isOwner || featured.created_by === user?.id) && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingEvent(featured.id)}
                              title="Rediger"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => deleteEventMutation.mutate(featured.id)}
                              title="Slet"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Deltagere */}
                    {attendees.length > 0 && (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <div className="flex cursor-pointer items-center gap-2.5">
                            <div className="flex">
                              {attendees.slice(0, 3).map((a, i) => {
                                const attendeeAvatar = lookupAvatar({
                                  employeeId: (a.employee as any)?.id ?? a.employee_id,
                                  name: `${(a.employee as any)?.first_name ?? ""} ${(a.employee as any)?.last_name ?? ""}`,
                                });
                                return (
                                  <span
                                    key={a.id}
                                    className={`flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-card text-[10px] font-extrabold ${
                                      i % 2 === 0
                                        ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]"
                                        : "bg-[hsl(var(--cph-light-blue))] text-[hsl(var(--cph-onyx))]"
                                    } ${i > 0 ? "-ml-2" : ""}`}
                                  >
                                    {attendeeAvatar ? (
                                      <img
                                        src={attendeeAvatar}
                                        alt={initials(a)}
                                        className="h-full w-full rounded-full object-cover"
                                      />
                                    ) : (
                                      initials(a)
                                    )}
                                  </span>
                                );
                              })}
                              {attendees.length > 3 && (
                                <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-[hsl(var(--cph-light-blue))] text-[10px] font-extrabold text-[hsl(var(--cph-onyx))]">
                                  +{attendees.length - 3}
                                </span>
                              )}
                            </div>
                            <span className="text-[13px] text-foreground/70">
                              {attendees.length} deltager
                            </span>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-56 p-3">
                          <p className="mb-2 text-sm font-medium">Deltagere</p>
                          <div className="max-h-40 space-y-2 overflow-y-auto">
                            {attendees.map((a) => (
                              <div key={a.id} className="flex items-center gap-2 text-sm">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage
                                    src={
                                      lookupAvatar({
                                        employeeId: (a.employee as any)?.id ?? a.employee_id,
                                        name: `${(a.employee as any)?.first_name ?? ""} ${(a.employee as any)?.last_name ?? ""}`,
                                      }) || undefined
                                    }
                                    alt={initials(a)}
                                  />
                                  <AvatarFallback className="text-[10px]">
                                    {initials(a)}
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

                    {/* Deltag / afbud */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleAttendanceMutation.mutate({
                            eventId: featured.id,
                            status: "attending",
                          })
                        }
                        disabled={toggleAttendanceMutation.isPending}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-extrabold transition-colors ${
                          myStatus === "attending"
                            ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]"
                            : "border border-[hsl(var(--cph-onyx)/0.22)] text-foreground hover:bg-[hsl(var(--cph-onyx)/0.06)]"
                        }`}
                      >
                        <Check
                          className={`h-3.5 w-3.5 ${
                            myStatus === "attending" ? "text-[hsl(var(--cph-emerald))]" : ""
                          }`}
                        />
                        {(featured as any).requires_registration
                          ? myStatus === "attending"
                            ? "Tilmeldt"
                            : "Tilmeld"
                          : "Deltager"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleAttendanceMutation.mutate({
                            eventId: featured.id,
                            status: "maybe",
                          })
                        }
                        disabled={toggleAttendanceMutation.isPending}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-[14px] font-extrabold transition-colors ${
                          myStatus === "maybe"
                            ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]"
                            : "border border-[hsl(var(--cph-onyx)/0.22)] text-foreground hover:bg-[hsl(var(--cph-onyx)/0.06)]"
                        }`}
                      >
                        Måske
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleAttendanceMutation.mutate({
                            eventId: featured.id,
                            status: "not_attending",
                          })
                        }
                        disabled={toggleAttendanceMutation.isPending}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-[14px] font-extrabold transition-colors ${
                          myStatus === "not_attending"
                            ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]"
                            : "border border-[hsl(var(--cph-onyx)/0.22)] text-foreground hover:bg-[hsl(var(--cph-onyx)/0.06)]"
                        }`}
                      >
                        Afbud
                      </button>
                    </div>

                    {/* Øvrige begivenheder */}
                    {rest.length > 0 && (
                      <div className="divide-y divide-[hsl(var(--cph-onyx)/0.1)] border-t border-[hsl(var(--cph-onyx)/0.1)] pt-1">
                        {rest.map((event) => (
                          <div key={event.id} className="flex items-center gap-3 py-2.5">
                            <span className="w-11 flex-none text-[12px] font-extrabold uppercase tracking-[0.06em] text-foreground/70 tabular-nums">
                              {format(parseISO(event.event_date), "d. MMM", { locale: da })}
                            </span>
                            <span
                              className="min-w-0 flex-1 cursor-pointer truncate text-[14px] font-extrabold hover:underline"
                              onClick={() => setSelectedEventForDetail(event.id)}
                            >
                              {event.title}
                            </span>
                            <span className="flex-none text-[12px] text-foreground/70">
                              {event.event_time ? `Kl. ${event.event_time.slice(0, 5)}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </CardContent>

        </Card>
        </div>

        {/* ZONE 3: Billeder fra seneste event */}
        <EventGallery />

        {/* ZONE 4: Fødselsdage & jubilæer */}
        {upcomingCelebrations.length > 0 && (
          <section className="rounded-3xl bg-card p-6 md:px-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <h2 className="flex items-center gap-2.5 text-[15px] font-extrabold text-foreground">
                <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[hsl(var(--cph-onyx))]" />
                Fødselsdage &amp; jubilæer
                <span className="font-normal text-foreground/70">· næste 14 dage</span>
              </h2>
              <span className="text-[13px] text-foreground/70">
                {upcomingCelebrations.length} kollegaer
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {upcomingCelebrations.map((celebration, idx) => {
                const isAnniversary = celebration.type === 'anniversary';
                 return (
                   <div
                     key={idx}
                     className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${
                       isAnniversary
                         ? 'bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]'
                         : 'bg-[hsl(var(--cph-light-blue))] text-[hsl(var(--cph-onyx))]'
                     }`}
                   >
                     <PlayerProfileHoverCard employeeId={celebration.employeeId} side="top">
                     <span
                       className={`flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-[12px] font-extrabold ${
                         isAnniversary
                           ? 'bg-[hsl(var(--cph-light-blue))] text-[hsl(var(--cph-onyx))]'
                           : 'bg-white text-[hsl(var(--cph-onyx))]'
                       }`}
                     >
                       {celebration.name
                         .split(' ')
                         .map((part) => part[0])
                         .slice(0, 2)
                         .join('')
                         .toUpperCase()}
                     </span>
                     </PlayerProfileHoverCard>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-extrabold">{celebration.name}</p>
                      <p
                        className={`text-[12px] ${
                          isAnniversary
                            ? 'font-extrabold text-[hsl(var(--cph-emerald))]'
                            : 'text-[hsl(var(--cph-onyx)/0.76)]'
                        }`}
                      >
                        {isAnniversary
                          ? `${celebration.years} års jubilæum · ${formatCelebrationDate(celebration.date, celebration.isToday)}`
                          : `Fødselsdag · ${formatCelebrationDate(celebration.date, celebration.isToday)}`}
                      </p>
                    </div>
                  </div>
                  </PlayerProfileHoverCard>
                );
              })}
            </div>
          </section>
        )}

        </div>
      </div>

    </MainLayout>
  );
};

export default Home;
