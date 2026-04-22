import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Users, Zap, Clock, CheckCircle, XCircle, Plus, Loader2, ShieldCheck, AlertTriangle, FileText, CalendarDays, Eye, PhoneCall, Bell, Layout, BarChart3, UserMinus } from "lucide-react";

export const REASONS_BY_US = ["Afvist af recruiter", "Manuelt annulleret"];
export const REASON_PREFIX_BY_US = "Kandidat status ændret til:";
export const REASONS_BY_CANDIDATE = ["Kandidat afmeldte sig via link", "Kandidat svarede på SMS"];

export function classifyCancellation(reason: string | null | undefined): "cancelled_by_us" | "cancelled_by_candidate" {
  if (!reason) return "cancelled_by_us";
  if (REASONS_BY_CANDIDATE.includes(reason)) return "cancelled_by_candidate";
  return "cancelled_by_us";
}
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { BookingFlowTimeline } from "@/components/recruitment/BookingFlowTimeline";
import { RecruitmentKpiBar } from "@/components/recruitment/RecruitmentKpiBar";
import { FlowTemplatesTab } from "@/components/recruitment/FlowTemplatesTab";
import { BookingSettingsTab } from "@/components/recruitment/BookingSettingsTab";
import { BookingPreviewTab } from "@/components/recruitment/BookingPreviewTab";
import { BookingCalendarTab } from "@/components/recruitment/BookingCalendarTab";
import { BookingFlowConversationsTab } from "@/components/recruitment/BookingFlowConversationsTab";
import { BookingNotificationsTab } from "@/components/recruitment/BookingNotificationsTab";
import { BookingPagesTab } from "@/components/recruitment/BookingPagesTab";
import { addDays, setHours, setMinutes } from "date-fns";

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  active: { label: "Aktiv", icon: Zap, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  completed: { label: "Fuldført", icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-500/30" },
  cancelled: { label: "Annulleret", icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-500/30" },
  cancelled_by_us: { label: "Vi annullerede", icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-500/30" },
  cancelled_by_candidate: { label: "Kandidat trak sig", icon: UserMinus, color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  pending_approval: { label: "Afventer", icon: Clock, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
};

export default function BookingFlow() {
  const queryClient = useQueryClient();
  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);

  // Fetch all enrollments
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["booking-flow-enrollments", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("booking_flow_enrollments")
        .select(`
          *,
          candidates!inner(id, first_name, last_name, email, phone),
          applications(id, role, status),
          booking_flow_touchpoints(id, status, template_key)
        `)
        .order("enrolled_at", { ascending: false });

      if (filterStatus === "cancelled_by_us") {
        query = query.eq("status", "cancelled");
      } else if (filterStatus === "cancelled_by_candidate") {
        query = query.eq("status", "cancelled").in("cancelled_reason", REASONS_BY_CANDIDATE);
      } else if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (filterStatus === "cancelled_by_us") {
        return (data || []).filter((e: any) => classifyCancellation(e.cancelled_reason) === "cancelled_by_us");
      }
      return data;
    },
  });

  // Fetch pending approval enrollments (always)
  const { data: pendingApprovals } = useQuery({
    queryKey: ["booking-flow-pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_flow_enrollments")
        .select(`
          *,
          candidates!inner(id, first_name, last_name, email, phone, notes),
          applications(id, role, status, notes)
        `)
        .eq("status", "pending_approval")
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch touchpoints for selected enrollment
  const { data: touchpoints } = useQuery({
    queryKey: ["booking-flow-touchpoints", selectedEnrollment],
    queryFn: async () => {
      if (!selectedEnrollment) return [];
      const { data, error } = await supabase
        .from("booking_flow_touchpoints")
        .select("*")
        .eq("enrollment_id", selectedEnrollment)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEnrollment,
  });

  // Fetch unenrolled candidates
  const { data: unenrolledCandidates } = useQuery({
    queryKey: ["unenrolled-candidates"],
    queryFn: async () => {
      const { data: enrolled } = await supabase
        .from("booking_flow_enrollments")
        .select("candidate_id")
        .in("status", ["active", "pending_approval"]);

      const enrolledIds = (enrolled || []).map(e => e.candidate_id);

      let query = supabase
        .from("candidates")
        .select("id, first_name, last_name, email, phone")
        .order("created_at", { ascending: false })
        .limit(50);

      if (enrolledIds.length > 0) {
        query = query.not("id", "in", `(${enrolledIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: addCandidateOpen,
  });

  // Add candidate directly as pending_approval
  const addCandidateMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from("booking_flow_enrollments")
        .insert({
          candidate_id: candidateId,
          status: "pending_approval",
          approval_status: "pending",
          tier: "A",
        });
      if (error) throw error;

      // Fetch candidate info for the notification email
      const { data: candidate } = await supabase
        .from("candidates")
        .select("first_name, last_name, email, phone, applied_position")
        .eq("id", candidateId)
        .single();

      // Fetch notification recipients
      const { data: recipients } = await supabase
        .from("booking_notification_recipients")
        .select("email, name")
        .eq("notify_on_booking", true);

      if (candidate && recipients?.length) {
        const candidateName = `${candidate.first_name} ${candidate.last_name}`;
        const subject = `Ny kandidat i booking flow: ${candidateName}`;
        const content = `<p>Hej,</p>
<p>En ny kandidat er blevet tilføjet til booking flowet og afventer godkendelse:</p>
<ul>
  <li><strong>Navn:</strong> ${candidateName}</li>
  <li><strong>Stilling:</strong> ${candidate.applied_position || "Ikke angivet"}</li>
  <li><strong>Email:</strong> ${candidate.email || "Ikke angivet"}</li>
  <li><strong>Telefon:</strong> ${candidate.phone || "Ikke angivet"}</li>
</ul>
<p>Gå til booking flowet for at godkende eller afvise kandidaten.</p>`;

        // Send email to all recipients in parallel
        await Promise.allSettled(
          recipients.map((r) =>
            supabase.functions.invoke("send-recruitment-email", {
              body: {
                candidateId,
                email: r.email,
                subject,
                content,
              },
            })
          )
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["booking-flow-pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["unenrolled-candidates"] });
      toast.success("Kandidat tilføjet — afventer godkendelse");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  // Approve enrollment mutation
  const approveMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { data: enrollment, error: fetchErr } = await supabase
        .from("booking_flow_enrollments")
        .select("*")
        .eq("id", enrollmentId)
        .single();
      if (fetchErr) throw fetchErr;

      const { error: updateErr } = await supabase
        .from("booking_flow_enrollments")
        .update({
          status: "active",
          approval_status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", enrollmentId);
      if (updateErr) throw updateErr;

      const { data: flowSteps, error: stepsErr } = await supabase
        .from("booking_flow_steps")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (stepsErr) throw stepsErr;
      if (!flowSteps?.length) throw new Error("Ingen flow-trin fundet i databasen");

      const now = new Date();
      const touchpoints = flowSteps.map(step => {
        let scheduledAt: Date;
        if (step.day === 0 && step.offset_hours < 1) {
          scheduledAt = new Date(now.getTime() + step.offset_hours * 3600000);
        } else {
          const dayDate = addDays(now, step.day);
          scheduledAt = setMinutes(setHours(dayDate, Math.floor(step.offset_hours)), (step.offset_hours % 1) * 60);
        }
        return {
          enrollment_id: enrollmentId,
          day: step.day,
          channel: step.channel,
          template_key: step.template_key,
          scheduled_at: scheduledAt.toISOString(),
          status: "pending",
        };
      });

      const { error: tpErr } = await supabase.from("booking_flow_touchpoints").insert(touchpoints);
      if (tpErr) throw tpErr;

      // Safety net: verify touchpoints were actually created
      const { count } = await supabase
        .from("booking_flow_touchpoints")
        .select("id", { count: "exact", head: true })
        .eq("enrollment_id", enrollmentId);

      if (!count || count === 0) {
        await supabase
          .from("booking_flow_enrollments")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_reason: "Ingen touchpoints kunne genereres",
          })
          .eq("id", enrollmentId);
        throw new Error("Touchpoints blev ikke oprettet — flow markeret som fejlet");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["booking-flow-pending-approvals"] });
      toast.success("Flow godkendt og startet");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  // Reject enrollment mutation
  const rejectMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from("booking_flow_enrollments")
        .update({
          status: "cancelled",
          approval_status: "rejected",
          cancelled_at: new Date().toISOString(),
          cancelled_reason: "Afvist af recruiter",
        })
        .eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["booking-flow-pending-approvals"] });
      toast.success("Kandidat afvist");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  // Regenerate touchpoints for stuck enrollments
  const regenerateMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.functions.invoke("regenerate-flow-touchpoints", {
        body: { enrollment_id: enrollmentId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["booking-flow-touchpoints"] });
      toast.success("Touchpoints regenereret");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  // Cancel enrollment
  const cancelMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error: enrollError } = await supabase
        .from("booking_flow_enrollments")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: "Manuelt annulleret" })
        .eq("id", enrollmentId);
      if (enrollError) throw enrollError;

      const { error: tpError } = await supabase
        .from("booking_flow_touchpoints")
        .update({ status: "cancelled" })
        .eq("enrollment_id", enrollmentId)
        .eq("status", "pending");
      if (tpError) throw tpError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["booking-flow-touchpoints"] });
      toast.success("Flow annulleret");
    },
  });

  const activeCount = enrollments?.filter(e => e.status === "active").length || 0;
  const pendingCount = pendingApprovals?.length || 0;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Booking Flow</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automatiseret outreach med manuel godkendelse
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/recruitment/booking-flow/engagement">
                <BarChart3 className="h-4 w-4" />
                Engagement-rapport
              </Link>
            </Button>
            <Button onClick={() => setAddCandidateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Tilføj kandidat
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <Users className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Flow-skabeloner
            </TabsTrigger>
            <TabsTrigger value="booking-settings" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Booking-side
            </TabsTrigger>
            <TabsTrigger value="booking-preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="booking-samtaler" className="gap-2">
              <PhoneCall className="h-4 w-4" />
              Booking samtaler
            </TabsTrigger>
            <TabsTrigger value="planlagte-samtaler" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Planlagte jobsamtaler
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifikationer
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-2">
              <Layout className="h-4 w-4" />
              Sider
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">

        {/* KPI Overview */}
        <RecruitmentKpiBar />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{activeCount}</p>
                  <p className="text-xs text-muted-foreground">Aktive flows</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Afventer godkendelse</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approval Section */}
        {pendingCount > 0 && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Afventer godkendelse ({pendingCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {pendingApprovals?.map((enrollment: any) => {
                  const candidate = enrollment.candidates;

                  return (
                    <div key={enrollment.id} className="flex items-center justify-between py-3 px-1">
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <div>
                          <p className="font-medium text-sm">
                            {candidate?.first_name} {candidate?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {candidate?.email} {candidate?.phone ? `· ${candidate.phone}` : ""}
                          </p>
                          {(candidate?.notes || enrollment.applications?.[0]?.notes) && (
                            <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-2 italic max-w-md">
                              "{candidate?.notes || enrollment.applications?.[0]?.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => rejectMutation.mutate(enrollment.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Afvis
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(enrollment.id)}
                          disabled={approveMutation.isPending}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          Godkend & start flow
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statuser</SelectItem>
              <SelectItem value="active">Aktive</SelectItem>
              <SelectItem value="completed">Fuldførte</SelectItem>
              <SelectItem value="cancelled_by_us">Vi annullerede</SelectItem>
              <SelectItem value="cancelled_by_candidate">Kandidat trak sig</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Enrollment list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kandidater i flow</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !enrollments?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Ingen kandidater i flow endnu</p>
                <p className="text-xs mt-1">Tilføj en kandidat for at starte outreach-flowet</p>
              </div>
            ) : (
              <div className="divide-y">
                {enrollments.map((enrollment: any) => {
                  const candidate = enrollment.candidates;
                  const statusKey = enrollment.status === "cancelled"
                    ? classifyCancellation(enrollment.cancelled_reason)
                    : (enrollment.status as string);
                  const status = statusConfig[statusKey];
                  const StatusIcon = status?.icon || Clock;

                  // Detect "stuck" enrollments: active, no pending outreach touchpoints, approved >24h ago
                  const tps = (enrollment.booking_flow_touchpoints || []) as Array<{ status: string; template_key: string }>;
                  const pendingOutreach = tps.filter(
                    (t) => t.status === "pending" && t.template_key !== "booking_confirmation_sms"
                  ).length;
                  const baseTs = enrollment.approved_at ?? enrollment.enrolled_at;
                  const hoursSince = baseTs ? (Date.now() - new Date(baseTs).getTime()) / 3600000 : 0;
                  const isStuck =
                    enrollment.status === "active" && pendingOutreach === 0 && hoursSince > 24;

                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between py-3 px-1 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors"
                      onClick={() => setSelectedEnrollment(enrollment.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-sm">
                            {candidate?.first_name} {candidate?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {candidate?.email}
                          </p>
                          {isStuck && (
                            <p className="mt-1 text-xs font-medium text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Ingen touchpoints planlagt
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={status?.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status?.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Dag {enrollment.current_day}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date((enrollment as any).approved_at ?? enrollment.enrolled_at), { addSuffix: true, locale: da })}
                        </span>
                        {isStuck && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              regenerateMutation.mutate(enrollment.id);
                            }}
                            disabled={regenerateMutation.isPending}
                          >
                            <Zap className="h-3.5 w-3.5 mr-1" />
                            Regenerér
                          </Button>
                        )}
                        {enrollment.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelMutation.mutate(enrollment.id);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

          {/* Touchpoint timeline dialog */}
          <Dialog open={!!selectedEnrollment} onOpenChange={(open) => !open && setSelectedEnrollment(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Flow-tidslinje</DialogTitle>
              </DialogHeader>
              <BookingFlowTimeline touchpoints={touchpoints || []} />
            </DialogContent>
          </Dialog>
          </TabsContent>

          <TabsContent value="templates">
            <FlowTemplatesTab />
          </TabsContent>

          <TabsContent value="booking-settings">
            <BookingSettingsTab />
          </TabsContent>

          <TabsContent value="booking-preview">
            <BookingPreviewTab />
          </TabsContent>

          <TabsContent value="booking-samtaler">
            <BookingFlowConversationsTab />
          </TabsContent>

          <TabsContent value="planlagte-samtaler">
            <BookingCalendarTab />
          </TabsContent>

          <TabsContent value="notifications">
            <BookingNotificationsTab />
          </TabsContent>

          <TabsContent value="pages">
            <BookingPagesTab />
          </TabsContent>
        </Tabs>

        {/* Add candidate dialog */}
        <Dialog open={addCandidateOpen} onOpenChange={setAddCandidateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vælg kandidat</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {unenrolledCandidates?.map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setAddCandidateOpen(false);
                    addCandidateMutation.mutate(c.id);
                  }}
                >
                  <div>
                    <p className="font-medium text-sm">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
              {!unenrolledCandidates?.length && (
                <p className="text-center text-muted-foreground py-6 text-sm">
                  Ingen ledige kandidater fundet
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
