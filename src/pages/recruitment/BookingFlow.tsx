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
import { Users, Zap, Clock, CheckCircle, XCircle, Plus, Mail, MessageSquare, Loader2, ShieldCheck, AlertTriangle, FileText, CalendarDays, Eye, PhoneCall } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { SegmentationModal } from "@/components/recruitment/SegmentationModal";
import { BookingFlowTimeline } from "@/components/recruitment/BookingFlowTimeline";
import { FlowTemplatesTab } from "@/components/recruitment/FlowTemplatesTab";
import { BookingSettingsTab } from "@/components/recruitment/BookingSettingsTab";
import { BookingPreviewTab } from "@/components/recruitment/BookingPreviewTab";
import { BookingCalendarTab } from "@/components/recruitment/BookingCalendarTab";
import { addDays, setHours, setMinutes } from "date-fns";

const tierConfig = {
  A: { label: "Tier A", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", dot: "bg-emerald-500" },
  B: { label: "Tier B", color: "bg-violet-500/10 text-violet-700 border-violet-500/30", dot: "bg-violet-500" },
  C: { label: "Tier C", color: "bg-gray-500/10 text-gray-600 border-gray-500/30", dot: "bg-gray-500" },
};

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  active: { label: "Aktiv", icon: Zap, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  completed: { label: "Fuldført", icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-500/30" },
  cancelled: { label: "Annulleret", icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-500/30" },
  pending_approval: { label: "Afventer", icon: Clock, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
};

export default function BookingFlow() {
  const queryClient = useQueryClient();
  const [segModalOpen, setSegModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);

  // Fetch all enrollments
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["booking-flow-enrollments", filterTier, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("booking_flow_enrollments")
        .select(`
          *,
          candidates!inner(id, first_name, last_name, email, phone),
          applications(id, role, status)
        `)
        .order("enrolled_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }
      if (filterTier !== "all") {
        query = query.eq("tier", filterTier);
      }

      const { data, error } = await query;
      if (error) throw error;
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
          candidates!inner(id, first_name, last_name, email, phone),
          applications(id, role, status)
        `)
        .eq("status", "pending_approval")
        .order("tier", { ascending: true })
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

  // Approve enrollment mutation
  const approveMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      // Get enrollment details
      const { data: enrollment, error: fetchErr } = await supabase
        .from("booking_flow_enrollments")
        .select("*")
        .eq("id", enrollmentId)
        .single();
      if (fetchErr) throw fetchErr;

      // Update status to active
      const { error: updateErr } = await supabase
        .from("booking_flow_enrollments")
        .update({
          status: "active",
          approval_status: "approved",
        })
        .eq("id", enrollmentId);
      if (updateErr) throw updateErr;

      // Fetch flow steps from DB
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
        if (step.day === 0 && step.offsetHours < 1) {
          scheduledAt = new Date(now.getTime() + step.offsetHours * 3600000);
        } else {
          const dayDate = addDays(now, step.day);
          scheduledAt = setMinutes(setHours(dayDate, Math.floor(step.offsetHours)), (step.offsetHours % 1) * 60);
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
  const tierACnt = enrollments?.filter(e => e.tier === "A" && e.status === "active").length || 0;
  const tierBCnt = enrollments?.filter(e => e.tier === "B" && e.status === "active").length || 0;
  const tierCCnt = enrollments?.filter(e => e.tier === "C" && e.status === "active").length || 0;
  const pendingCount = pendingApprovals?.length || 0;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Booking Flow</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automatiseret outreach med intelligent A/B/C-segmentering
            </p>
          </div>
          <Button onClick={() => setAddCandidateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Tilføj kandidat
          </Button>
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
            <TabsTrigger value="samtaler" className="gap-2">
              <PhoneCall className="h-4 w-4" />
              Samtaler
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
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
                  <p className="text-xs text-muted-foreground">Afventer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {[
            { tier: "A", count: tierACnt, color: "emerald" },
            { tier: "B", count: tierBCnt, color: "violet" },
            { tier: "C", count: tierCCnt, color: "gray" },
          ].map(({ tier, count, color }) => (
            <Card key={tier}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${color}-500/10`}>
                    <Zap className={`h-5 w-5 text-${color}-600`} />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{count}</p>
                    <p className="text-xs text-muted-foreground">Tier {tier}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                  const tier = tierConfig[enrollment.tier as keyof typeof tierConfig];
                  const signals = enrollment.segmentation_signals as any;

                  return (
                    <div key={enrollment.id} className="flex items-center justify-between py-3 px-1">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${tier?.dot}`} />
                        <div>
                          <p className="font-medium text-sm">
                            {candidate?.first_name} {candidate?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {enrollment.tier === "B"
                              ? "Erfaren kandidat — godkend for at starte flow"
                              : "Muligt mismatch — gennemse inden flow"
                            }
                          </p>
                          {signals && (
                            <div className="flex gap-1.5 mt-1">
                              {signals.detectedAge && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {signals.detectedAge} år
                                </Badge>
                              )}
                              {signals.detectedExperienceYears !== null && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {signals.detectedExperienceYears} års erfaring
                                </Badge>
                              )}
                              {!signals.isDanish && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                                  Engelsk ({signals.englishWordPct}%)
                                </Badge>
                              )}
                              {signals.isPartTime && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                                  Deltid
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={tier?.color}>
                          {tier?.label}
                        </Badge>
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
                          Godkend
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
              <SelectItem value="cancelled">Annullerede</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle tiers</SelectItem>
              <SelectItem value="A">Tier A</SelectItem>
              <SelectItem value="B">Tier B</SelectItem>
              <SelectItem value="C">Tier C</SelectItem>
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
                  const tier = tierConfig[enrollment.tier as keyof typeof tierConfig];
                  const status = statusConfig[enrollment.status as string];
                  const StatusIcon = status?.icon || Clock;

                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between py-3 px-1 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors"
                      onClick={() => setSelectedEnrollment(enrollment.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${tier?.dot}`} />
                        <div>
                          <p className="font-medium text-sm">
                            {candidate?.first_name} {candidate?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {candidate?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={tier?.color}>
                          {tier?.label}
                        </Badge>
                        <Badge variant="outline" className={status?.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status?.label}
                        </Badge>
                        {enrollment.approval_status === "auto_approved" && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            Auto
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Dag {enrollment.current_day}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(enrollment.enrolled_at), { addSuffix: true, locale: da })}
                        </span>
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

          <TabsContent value="samtaler">
            <BookingCalendarTab />
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
                    setSegModalOpen(true);
                    (window as any).__selectedCandidateForFlow = c;
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

        {/* Segmentation modal */}
        <SegmentationModal
          open={segModalOpen}
          onOpenChange={setSegModalOpen}
          onEnrolled={() => {
            queryClient.invalidateQueries({ queryKey: ["booking-flow-enrollments"] });
            queryClient.invalidateQueries({ queryKey: ["booking-flow-pending-approvals"] });
            queryClient.invalidateQueries({ queryKey: ["unenrolled-candidates"] });
          }}
        />
      </div>
    </MainLayout>
  );
}
