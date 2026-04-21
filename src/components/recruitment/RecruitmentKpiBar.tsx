import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  Ghost,
  ThumbsDown,
  CalendarCheck,
  Trophy,
  Clock,
  AlertTriangle,
  Percent,
  UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info";

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: typeof Users;
  subtext?: string;
  tone?: Tone;
  isLoading?: boolean;
}

const toneStyles: Record<Tone, { bg: string; text: string }> = {
  default: { bg: "bg-muted", text: "text-foreground" },
  info: { bg: "bg-blue-500/10", text: "text-blue-600" },
  success: { bg: "bg-green-500/10", text: "text-green-600" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-600" },
  danger: { bg: "bg-red-500/10", text: "text-red-600" },
};

function KpiCard({ label, value, icon: Icon, subtext, tone = "default", isLoading }: KpiCardProps) {
  const style = toneStyles[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg shrink-0", style.bg)}>
            <Icon className={cn("h-4 w-4", style.text)} />
          </div>
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className={cn("text-2xl font-semibold leading-tight", tone !== "default" && style.text)}>
                {value}
              </p>
            )}
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            {subtext && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecruitmentKpiBar() {
  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-kpi-bar"],
    queryFn: async () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const nowIso = now.toISOString();

      const REASONS_BY_CANDIDATE = ["Kandidat afmeldte sig via link", "Kandidat svarede på SMS"];

      const [
        active,
        newWeek,
        completed,
        cancelledByCandidate,
        cancelledTotal,
        ghostet,
        takketNej,
        interview,
        hired,
        pending,
        failed,
        flowStarted30d,
      ] = await Promise.all([
        supabase.from("booking_flow_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("booking_flow_enrollments").select("id", { count: "exact", head: true }).gte("enrolled_at", sevenDaysAgo),
        supabase.from("booking_flow_enrollments").select("id", { count: "exact", head: true }).eq("status", "completed").gte("updated_at", thirtyDaysAgo),
        supabase.from("booking_flow_enrollments").select("id", { count: "exact", head: true }).eq("status", "cancelled").in("cancelled_reason", REASONS_BY_CANDIDATE).gte("updated_at", thirtyDaysAgo),
        supabase.from("booking_flow_enrollments").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("updated_at", thirtyDaysAgo),
        supabase.from("candidates").select("id", { count: "exact", head: true }).eq("status", "ghostet").gte("updated_at", thirtyDaysAgo),
        supabase.from("candidates").select("id", { count: "exact", head: true }).eq("status", "takket_nej").gte("updated_at", thirtyDaysAgo),
        supabase.from("candidates").select("id", { count: "exact", head: true }).eq("status", "interview_scheduled"),
        supabase.from("candidates").select("id", { count: "exact", head: true }).eq("status", "hired").gte("updated_at", thirtyDaysAgo),
        supabase.from("booking_flow_touchpoints").select("id", { count: "exact", head: true }).eq("status", "pending").lte("scheduled_at", nowIso),
        supabase.from("booking_flow_touchpoints").select("id", { count: "exact", head: true }).eq("status", "failed").gte("updated_at", oneDayAgo),
        supabase.from("booking_flow_enrollments").select("id", { count: "exact", head: true }).gte("enrolled_at", thirtyDaysAgo),
      ]);

      const hiredCount = hired.count ?? 0;
      const startedCount = flowStarted30d.count ?? 0;
      const conversion = startedCount > 0 ? Math.round((hiredCount / startedCount) * 100) : 0;
      const cancelledCandidateCount = cancelledByCandidate.count ?? 0;
      const cancelledUsCount = Math.max(0, (cancelledTotal.count ?? 0) - cancelledCandidateCount);

      return {
        active: active.count ?? 0,
        newWeek: newWeek.count ?? 0,
        completed: completed.count ?? 0,
        cancelledByUs: cancelledUsCount,
        cancelledByCandidate: cancelledCandidateCount,
        ghostet: ghostet.count ?? 0,
        takketNej: takketNej.count ?? 0,
        interview: interview.count ?? 0,
        hired: hiredCount,
        pending: pending.count ?? 0,
        failed: failed.count ?? 0,
        conversion,
      };
    },
    refetchInterval: 60_000,
  });

  const d = data;

  return (
    <div className="space-y-3">
      {/* Række 1 — Flow-aktivitet */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Flow-aktivitet</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Aktive i flow" value={d?.active ?? 0} icon={Users} tone="info" isLoading={isLoading} />
          <KpiCard label="Nye sidste 7 dage" value={d?.newWeek ?? 0} icon={UserPlus} subtext="enrollments" isLoading={isLoading} />
          <KpiCard label="Gennemført flow" value={d?.completed ?? 0} icon={CheckCircle2} subtext="sidste 30 dage" tone="success" isLoading={isLoading} />
          <KpiCard label="Vi annullerede" value={d?.cancelledByUs ?? 0} icon={XCircle} subtext="sidste 30 dage" tone="danger" isLoading={isLoading} />
          <KpiCard label="Kandidat trak sig" value={d?.cancelledByCandidate ?? 0} icon={UserMinus} subtext="sidste 30 dage" tone="warning" isLoading={isLoading} />
        </div>
      </div>

      {/* Række 2 — Touchpoint-sundhed */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Touchpoint-sundhed</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Pending touchpoints"
            value={d?.pending ?? 0}
            icon={Clock}
            subtext="due nu eller før"
            tone={(d?.pending ?? 0) > 20 ? "warning" : "default"}
            isLoading={isLoading}
          />
          <KpiCard
            label="Failed (24t)"
            value={d?.failed ?? 0}
            icon={AlertTriangle}
            subtext="SMS/email fejlet"
            tone={(d?.failed ?? 0) > 0 ? "danger" : "success"}
            isLoading={isLoading}
          />
          <KpiCard
            label="Konverteringsrate"
            value={`${d?.conversion ?? 0}%`}
            icon={Percent}
            subtext="hired / startede flow (30d)"
            tone="info"
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
