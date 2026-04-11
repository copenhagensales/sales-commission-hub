import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Zap, Clock, CheckCircle, XCircle, Plus, RefreshCw, Mail, MessageSquare, Phone, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { SegmentationModal } from "@/components/recruitment/SegmentationModal";
import { BookingFlowTimeline } from "@/components/recruitment/BookingFlowTimeline";

const tierConfig = {
  A: { label: "Tier A", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", dot: "bg-emerald-500" },
  B: { label: "Tier B", color: "bg-violet-500/10 text-violet-700 border-violet-500/30", dot: "bg-violet-500" },
  C: { label: "Tier C", color: "bg-gray-500/10 text-gray-600 border-gray-500/30", dot: "bg-gray-500" },
};

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  active: { label: "Aktiv", icon: Zap, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  completed: { label: "Fuldført", icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-500/30" },
  cancelled: { label: "Annulleret", icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  call_reminder: Phone,
};

export default function BookingFlow() {
  const queryClient = useQueryClient();
  const [segModalOpen, setSegModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);

  // Fetch enrollments with candidate info
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

  // Fetch unenrolled candidates for adding to flow
  const { data: unenrolledCandidates } = useQuery({
    queryKey: ["unenrolled-candidates"],
    queryFn: async () => {
      // Get candidates with active applications that aren't in an active flow
      const { data: enrolled } = await supabase
        .from("booking_flow_enrollments")
        .select("candidate_id")
        .eq("status", "active");

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

  // Cancel enrollment
  const cancelMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      // Cancel enrollment
      const { error: enrollError } = await supabase
        .from("booking_flow_enrollments")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: "Manuelt annulleret" })
        .eq("id", enrollmentId);
      if (enrollError) throw enrollError;

      // Cancel pending touchpoints
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

  // Stats
  const activeCount = enrollments?.filter(e => e.status === "active").length || 0;
  const tierACnt = enrollments?.filter(e => e.tier === "A" && e.status === "active").length || 0;
  const tierBCnt = enrollments?.filter(e => e.tier === "B" && e.status === "active").length || 0;
  const tierCCnt = enrollments?.filter(e => e.tier === "C" && e.status === "active").length || 0;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Booking Flow</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automatiseret outreach med A/B/C-segmentering
            </p>
          </div>
          <Button onClick={() => setAddCandidateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Tilføj kandidat
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
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

        {/* Add candidate dialog → opens segmentation modal */}
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
                    // Store selected candidate temporarily
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
            queryClient.invalidateQueries({ queryKey: ["unenrolled-candidates"] });
          }}
        />
      </div>
    </MainLayout>
  );
}
