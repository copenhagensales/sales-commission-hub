import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Calendar, FileText, AlertTriangle, CheckCircle2, Clock, Users, Beaker, GraduationCap, FolderOpen, ListChecks } from "lucide-react";
import { format, differenceInDays, addMonths, addYears } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type ComplianceStatus = "green" | "yellow" | "red" | "unknown";

interface StatusCardProps {
  title: string;
  status: ComplianceStatus;
  detail: string;
  icon: React.ReactNode;
  href?: string;
}

function StatusCard({ title, status, detail, icon, href }: StatusCardProps) {
  const navigate = useNavigate();
  const colors: Record<ComplianceStatus, string> = {
    green: "border-emerald-500/50 bg-emerald-500/10",
    yellow: "border-yellow-500/50 bg-yellow-500/10",
    red: "border-red-500/50 bg-red-500/10",
    unknown: "border-muted-foreground/30 bg-muted/30",
  };
  const dotColors: Record<ComplianceStatus, string> = {
    green: "bg-emerald-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
    unknown: "bg-muted-foreground",
  };

  return (
    <div
      onClick={() => href && navigate(href)}
      className={cn(
        "rounded-xl border p-4 transition-all",
        colors[status],
        href && "cursor-pointer hover:scale-[1.02]"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-muted-foreground">{icon}</div>
        <div className={cn("h-3 w-3 rounded-full", dotColors[status])} />
      </div>
      <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}

function calcComplianceScore(statuses: ComplianceStatus[]): number {
  if (statuses.length === 0) return 0;
  const scores: Record<ComplianceStatus, number> = { green: 100, yellow: 50, red: 0, unknown: 0 };
  const total = statuses.reduce((sum, s) => sum + scores[s], 0);
  return Math.round(total / statuses.length);
}

export default function AmoDashboard() {
  const today = new Date();

  // Fetch all data in parallel
  const { data: meetings } = useQuery({
    queryKey: ["amo-meetings"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_meetings").select("*").order("planned_date", { ascending: true });
      return data || [];
    },
  });

  const { data: annualDiscussions } = useQuery({
    queryKey: ["amo-annual-discussions"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_annual_discussions").select("*").order("discussion_date", { ascending: false });
      return data || [];
    },
  });

  const { data: apvRecords } = useQuery({
    queryKey: ["amo-apv"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_apv").select("*").order("next_due_date", { ascending: true });
      return data || [];
    },
  });

  const { data: kemiApv } = useQuery({
    queryKey: ["amo-kemi-apv"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_kemi_apv").select("*");
      return data || [];
    },
  });

  const { data: elections } = useQuery({
    queryKey: ["amo-amr-elections"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_amr_elections").select("*").order("next_election_due", { ascending: true });
      return data || [];
    },
  });

  const { data: training } = useQuery({
    queryKey: ["amo-training"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_training_courses").select("*");
      return data || [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["amo-members"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_members").select("*").eq("active", true);
      return data || [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["amo-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_tasks").select("*").in("status", ["open", "in_progress", "overdue"]);
      return data || [];
    },
  });

  const { data: documents } = useQuery({
    queryKey: ["amo-documents-recent"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_documents").select("*").order("upload_date", { ascending: false }).limit(5);
      return data || [];
    },
  });

  // Calculate statuses
  const nextMeeting = meetings?.find(m => m.status === "planned" && new Date(m.planned_date) >= today);
  const meetingStatus: ComplianceStatus = nextMeeting
    ? differenceInDays(new Date(nextMeeting.planned_date), today) <= 7 ? "yellow" : "green"
    : (meetings?.length ?? 0) === 0 ? "unknown" : "red";
  const meetingDetail = nextMeeting
    ? `Næste: ${format(new Date(nextMeeting.planned_date), "d. MMM yyyy", { locale: da })}`
    : "Intet planlagt møde";

  const latestDiscussion = annualDiscussions?.[0];
  const discussionDue = latestDiscussion?.next_due_date ? new Date(latestDiscussion.next_due_date) : null;
  const discussionStatus: ComplianceStatus = !latestDiscussion
    ? "red"
    : !discussionDue ? "yellow"
    : discussionDue < today ? "red"
    : differenceInDays(discussionDue, today) <= 60 ? "yellow"
    : latestDiscussion.minutes_url ? "green" : "yellow";
  const discussionDetail = discussionDue
    ? `Frist: ${format(discussionDue, "d. MMM yyyy", { locale: da })}`
    : latestDiscussion ? `Seneste: ${format(new Date(latestDiscussion.discussion_date), "d. MMM yyyy", { locale: da })}` : "Ingen registreret";

  const latestApv = apvRecords?.[0];
  const apvDue = latestApv?.next_due_date ? new Date(latestApv.next_due_date) : null;
  const apvStatus: ComplianceStatus = !latestApv
    ? "red"
    : !apvDue ? "yellow"
    : apvDue < today ? "red"
    : differenceInDays(apvDue, today) <= 90 ? "yellow"
    : "green";
  const apvDetail = apvDue
    ? `Frist: ${format(apvDue, "d. MMM yyyy", { locale: da })}`
    : "Ingen APV registreret";

  const hazardProducts = kemiApv?.filter(k => k.hazard_flag) || [];
  const kemiMissingSds = hazardProducts.filter(k => !k.sds_url);
  const kemiOverdueReviews = (kemiApv || []).filter(k => k.next_review_due && new Date(k.next_review_due) < today);
  const kemiSoonDueReviews = (kemiApv || []).filter(k => k.next_review_due && new Date(k.next_review_due) >= today && differenceInDays(new Date(k.next_review_due), today) <= 30);
  const kemiStatus: ComplianceStatus = (kemiApv?.length ?? 0) === 0
    ? "unknown"
    : kemiMissingSds.length > 0 || kemiOverdueReviews.length > 0 ? "red"
    : kemiSoonDueReviews.length > 0 ? "yellow"
    : "green";
  const kemiDetailParts: string[] = [];
  if (kemiOverdueReviews.length > 0) kemiDetailParts.push(`${kemiOverdueReviews.length} forfaldne reviews`);
  if (kemiMissingSds.length > 0) kemiDetailParts.push(`${kemiMissingSds.length} mangler sikkerhedsblad`);
  if (kemiSoonDueReviews.length > 0) kemiDetailParts.push(`${kemiSoonDueReviews.length} review snart`);
  const kemiDetail = kemiDetailParts.length > 0 ? kemiDetailParts.join(", ") : `${kemiApv?.length || 0} produkter registreret`;

  const nearestElection = elections?.[0];
  const electionDue = nearestElection?.next_election_due ? new Date(nearestElection.next_election_due) : null;
  const electionStatus: ComplianceStatus = !nearestElection
    ? "unknown"
    : !electionDue ? "yellow"
    : electionDue < today ? "red"
    : differenceInDays(electionDue, today) <= 60 ? "yellow"
    : "green";
  const electionDetail = electionDue
    ? `Næste valg: ${format(electionDue, "d. MMM yyyy", { locale: da })}`
    : "Ingen AMR-valg registreret";

  const pendingTraining = training?.filter(t => t.requirement_applies && !t.completed_date) || [];
  const overdueTraining = pendingTraining.filter(t => t.deadline_date && new Date(t.deadline_date) < today);
  const trainingStatus: ComplianceStatus = overdueTraining.length > 0 ? "red"
    : pendingTraining.length > 0 ? "yellow"
    : (training?.length ?? 0) === 0 ? "unknown" : "green";
  const trainingDetail = overdueTraining.length > 0
    ? `${overdueTraining.length} overskredet deadline`
    : pendingTraining.length > 0
    ? `${pendingTraining.length} afventer gennemførelse`
    : "Alle krav opfyldt";

  const missingCerts = training?.filter(t => t.completed_date && !t.certificate_url) || [];
  const certStatus: ComplianceStatus = missingCerts.length > 0 ? "yellow" : (training?.length ?? 0) === 0 ? "unknown" : "green";
  const certDetail = missingCerts.length > 0 ? `${missingCerts.length} mangler certifikat` : "Alle certifikater uploadet";

  const allStatuses: ComplianceStatus[] = [meetingStatus, discussionStatus, apvStatus, kemiStatus, electionStatus, trainingStatus, certStatus];
  const complianceScore = calcComplianceScore(allStatuses);

  const scoreColor = complianceScore >= 80 ? "text-emerald-400" : complianceScore >= 50 ? "text-yellow-400" : "text-red-400";
  const scoreBg = complianceScore >= 80 ? "from-emerald-500/20 to-emerald-500/5" : complianceScore >= 50 ? "from-yellow-500/20 to-yellow-500/5" : "from-red-500/20 to-red-500/5";

  // Data quality warnings
  const dataWarnings: string[] = [];
  if (members) {
    const names = members.map(m => m.full_name.toLowerCase());
    if (names.some(n => n.includes("seiding")) && names.some(n => n.includes("hoe"))) {
      dataWarnings.push('Datakvalitetsadvarsel: "William Seiding" og "William Hoe" kan være samme person. Verificér navnene på tværs af dokumenter.');
    }
  }

  return (
    <MainLayout>
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <Shield className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">AMO Compliance Hub</h1>
          <p className="text-sm text-muted-foreground">Copenhagen Sales – Arbejdsmiljøoverblik</p>
        </div>
      </div>

      {/* Data quality warnings */}
      {dataWarnings.map((w, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-200">{w}</p>
        </div>
      ))}

      {/* Compliance Score Hero */}
      <div className={cn("rounded-xl border border-muted bg-gradient-to-br p-6 flex items-center gap-6", scoreBg)}>
        <div className="text-center">
          <div className={cn("text-5xl font-bold", scoreColor)}>{complianceScore}%</div>
          <div className="text-xs text-muted-foreground mt-1">Samlet compliance</div>
        </div>
        <div className="flex-1">
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", complianceScore >= 80 ? "bg-emerald-500" : complianceScore >= 50 ? "bg-yellow-500" : "bg-red-500")}
              style={{ width: `${complianceScore}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{allStatuses.filter(s => s === "green").length} grøn</span>
            <span>{allStatuses.filter(s => s === "yellow").length} gul</span>
            <span>{allStatuses.filter(s => s === "red").length} rød</span>
          </div>
        </div>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard title="Næste AMO-møde" status={meetingStatus} detail={meetingDetail} icon={<Calendar className="h-5 w-5" />} href="/amo/meetings" />
        <StatusCard title="Årlig drøftelse" status={discussionStatus} detail={discussionDetail} icon={<Users className="h-5 w-5" />} href="/amo/annual-discussion" />
        <StatusCard title="APV" status={apvStatus} detail={apvDetail} icon={<FileText className="h-5 w-5" />} href="/amo/apv" />
        <StatusCard title="Kemi-APV" status={kemiStatus} detail={kemiDetail} icon={<Beaker className="h-5 w-5" />} href="/amo/kemi-apv" />
        <StatusCard title="AMR-valg" status={electionStatus} detail={electionDetail} icon={<CheckCircle2 className="h-5 w-5" />} href="/amo/organisation" />
        <StatusCard title="Uddannelseskrav" status={trainingStatus} detail={trainingDetail} icon={<GraduationCap className="h-5 w-5" />} href="/amo/training" />
        <StatusCard title="Certifikater" status={certStatus} detail={certDetail} icon={<FolderOpen className="h-5 w-5" />} href="/amo/documents" />
        <StatusCard
          title="Åbne opgaver"
          status={tasks && tasks.length > 0 ? (tasks.some(t => t.status === "overdue") ? "red" : "yellow") : "green"}
          detail={`${tasks?.length || 0} åbne opgaver`}
          icon={<ListChecks className="h-5 w-5" />}
          href="/amo/tasks"
        />
      </div>

      {/* Bottom widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open tasks */}
        <div className="rounded-xl border border-muted bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            Åbne opgaver
          </h3>
          {tasks && tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between text-sm border-b border-muted pb-2">
                  <span className="text-foreground">{task.title}</span>
                  <div className="flex items-center gap-2">
                    {task.due_date && (
                      <span className={cn("text-xs", new Date(task.due_date) < today ? "text-red-400" : "text-muted-foreground")}>
                        {format(new Date(task.due_date), "d. MMM", { locale: da })}
                      </span>
                    )}
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      task.status === "overdue" ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
                    )}>
                      {task.status === "overdue" ? "Overskredet" : task.status === "in_progress" ? "I gang" : "Åben"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen åbne opgaver</p>
          )}
        </div>

        {/* Recent documents */}
        <div className="rounded-xl border border-muted bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            Seneste uploads
          </h3>
          {documents && documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between text-sm border-b border-muted pb-2">
                  <span className="text-foreground">{doc.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(doc.upload_date), "d. MMM yyyy", { locale: da })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen dokumenter uploadet endnu</p>
          )}
        </div>
      </div>

      {/* AMO Members overview */}
      <div className="rounded-xl border border-muted bg-card p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          AMO-organisation
        </h3>
        {members && members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map(m => {
              const roleLabels: Record<string, string> = {
                admin: "Admin",
                ledelsesrepresentant: "Ledelsesrepræsentant",
                arbejdsleder: "Arbejdsleder",
                amr: "Arbejdsmiljørepræsentant",
                readonly: "Læseadgang",
              };
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold">
                    {m.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground">{roleLabels[m.role_type] || m.role_type}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ingen AMO-medlemmer registreret</p>
        )}
      </div>
    </div>
    </MainLayout>
  );
}
