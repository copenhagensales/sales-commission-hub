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
import { AddEventDialog } from "@/components/home/AddEventDialog";
import { useCelebrations } from "@/hooks/useCelebrations";
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
import { QualityFeedbackInbox } from "@/components/quality/QualityFeedbackInbox";
import { EventGallery } from "@/components/home/EventGallery";
import { RampCurveCard } from "@/components/ramp/RampCurveCard";
import { EventRsvpCard } from "@/components/home/EventRsvpCard";
import {
  useUpcomingCompanyEvents,
  useEventAttendees,
  useToggleEventAttendance,
  useDeleteCompanyEvent,
  type AttendanceStatus,
} from "@/hooks/useCompanyEvents";

import { getPayrollPeriod, getVacationPayRate } from "@/lib/calculations";


const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPreviewMode, previewEmployee } = useRolePreview();
  
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [celebrationsOpen, setCelebrationsOpen] = useState(true);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  
  const { isOwner, canEdit: canEditPermission } = usePermissions();
  const canManageEvents = canEditPermission("action_manage_company_events");
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

  // Fødselsdage og jubilæer – fælles med Pulsen (useCelebrations)
  const { data: celebrations = [] } = useCelebrations();

  // Only show today's celebrations prominently
  const todayCelebrations = celebrations.filter(c => c.isToday);
  const upcomingCelebrations = celebrations.filter(c => !c.isToday);


  // Begivenheder – fælles logik i useCompanyEvents (bruges også af Pulsen)
  const { data: companyEvents = [] } = useUpcomingCompanyEvents();
  const { data: eventAttendees = [] } = useEventAttendees(companyEvents.map(e => e.id));
  const toggleAttendanceMutation = useToggleEventAttendance(employee?.id);

  // Helper to get attendees for a specific event
  const getEventAttendees = (eventId: string) => {
    return eventAttendees.filter(a => a.event_id === eventId && a.status === 'attending');
  };

  // Helper to get current user's attendance status
  const getMyAttendance = (eventId: string): AttendanceStatus | null => {
    if (!employee?.id) return null;
    const myAttendance = eventAttendees.find(a => a.event_id === eventId && a.employee_id === employee.id);
    return myAttendance?.status as AttendanceStatus | null;
  };

  const deleteEventMutation = useDeleteCompanyEvent();


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

        {/* Kvalitetsfeedback: sælgerens egne sager og teamets sager for ledere */}
        <QualityFeedbackInbox />



        {/* ZONE 1: Hero + seneste 10 dage */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
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

        {/* Din opstart – kun inden for de første 40 arbejdsdage */}
        <RampCurveCard hideWhenCompleted />

        {/* Today's Celebrations - Only if there are any */}
        {todayCelebrations.length > 0 && (
          <CelebrationStrip celebrations={todayCelebrations} />
        )}


        {/* ZONE 2: Liga + kommende begivenheder */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <CompactLeagueView />
          </div>

        <Card className="h-full border-0 bg-card rounded-3xl">

          <CardHeader className="px-6 pb-2 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
                <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[hsl(var(--cph-onyx))]" />
                Begivenheder
              </CardTitle>

              <AddEventDialog
                open={addEventOpen}
                onOpenChange={setAddEventOpen}
                trigger={
                  <Button variant="ghost" size="sm" className="h-8 w-8 md:h-7 md:w-7 p-0" aria-label="Tilføj begivenhed">
                    <Plus className="w-4 h-4" />
                  </Button>
                }
              />
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
              <div className="flex flex-col gap-3">
                {companyEvents.slice(0, 3).map((event, idx) => (
                  <EventRsvpCard
                    key={event.id}
                    featured={idx === 0}
                    title={event.title}
                    eventDate={event.event_date}
                    eventTime={event.event_time}
                    location={event.location}
                    requiresRegistration={(event as { requires_registration?: boolean }).requires_registration}
                    attendeeCount={getEventAttendees(event.id).length}
                    attendees={getEventAttendees(event.id).map((a) => {
                      const emp = (a as { employee?: { id: string; first_name: string | null; last_name: string | null } | null }).employee;
                      return {
                        id: emp?.id ?? a.employee_id,
                        name: `${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`.trim() || "Ukendt",
                      };
                    })}
                    myStatus={getMyAttendance(event.id)}
                    disabled={toggleAttendanceMutation.isPending}
                    canManage={canManageEvents}
                    onRespond={(status) => toggleAttendanceMutation.mutate({ eventId: event.id, status })}
                    onOpenDetail={() => setSelectedEventForDetail(event.id)}
                    onEdit={() => setEditingEvent(event.id)}
                    onDelete={() => deleteEventMutation.mutate(event.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>

        </Card>
        </div>

        {/* ZONE 3: Billeder fra seneste event */}
        <EventGallery />

        {/* ZONE 4: Fødselsdage & jubilæer */}
        {upcomingCelebrations.length > 0 && (
          <section className="min-w-0 rounded-3xl bg-card p-5 sm:p-6 md:px-8">
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
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {upcomingCelebrations.map((celebration, idx) => {
                const isAnniversary = celebration.type === 'anniversary';
                 return (
                   <div
                     key={idx}
                     className={`flex min-w-0 items-center gap-3 rounded-2xl px-3.5 py-3 ${
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
                         className={`truncate text-[12px] ${
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
