import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { subDays, formatISO, parseISO, differenceInHours } from "date-fns";

type Touchpoint = {
  id: string;
  enrollment_id: string;
  template_key: string | null;
  channel: string;
  status: string;
  sent_at: string | null;
  scheduled_at: string;
};

type Enrollment = {
  id: string;
  candidate_id: string;
  tier: string;
  status: string;
  cancelled_reason: string | null;
  enrolled_at: string;
};

type ShortLink = {
  id: string;
  candidate_id: string | null;
  link_type: string | null;
  click_count: number;
  first_clicked_at: string | null;
};

type Click = {
  short_link_id: string;
  candidate_id: string | null;
  clicked_at: string;
};

type CommLog = {
  candidate_id: string | null;
  direction: string;
  type: string;
  created_at: string;
};

type Candidate = {
  id: string;
  status: string | null;
};

const formatPct = (numerator: number, denominator: number) =>
  denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : "—";

export default function BookingFlowEngagement() {
  const today = new Date();
  const [from, setFrom] = useState<string>(formatISO(subDays(today, 30), { representation: "date" }));
  const [to, setTo] = useState<string>(formatISO(today, { representation: "date" }));

  const fromIso = useMemo(() => `${from}T00:00:00Z`, [from]);
  const toIso = useMemo(() => `${to}T23:59:59Z`, [to]);

  // Enrollments in period
  const { data: enrollments = [] } = useQuery({
    queryKey: ["bfe-enrollments", from, to],
    queryFn: async (): Promise<Enrollment[]> => {
      const { data, error } = await supabase
        .from("booking_flow_enrollments")
        .select("id, candidate_id, tier, status, cancelled_reason, enrolled_at")
        .gte("enrolled_at", fromIso)
        .lte("enrolled_at", toIso);
      if (error) throw error;
      return (data ?? []) as Enrollment[];
    },
  });

  const enrollmentIds = enrollments.map((e) => e.id);
  const candidateIds = Array.from(new Set(enrollments.map((e) => e.candidate_id).filter(Boolean)));

  // Touchpoints for these enrollments
  const { data: touchpoints = [] } = useQuery({
    queryKey: ["bfe-touchpoints", enrollmentIds.join(",")],
    enabled: enrollmentIds.length > 0,
    queryFn: async (): Promise<Touchpoint[]> => {
      const { data, error } = await supabase
        .from("booking_flow_touchpoints")
        .select("id, enrollment_id, template_key, channel, status, sent_at, scheduled_at")
        .in("enrollment_id", enrollmentIds);
      if (error) throw error;
      return (data ?? []) as Touchpoint[];
    },
  });

  // Short links for these candidates
  const { data: shortLinks = [] } = useQuery({
    queryKey: ["bfe-shortlinks", candidateIds.join(",")],
    enabled: candidateIds.length > 0,
    queryFn: async (): Promise<ShortLink[]> => {
      const { data, error } = await supabase
        .from("short_links")
        .select("id, candidate_id, link_type, click_count, first_clicked_at")
        .in("candidate_id", candidateIds);
      if (error) throw error;
      return (data ?? []) as ShortLink[];
    },
  });

  const shortLinkIds = shortLinks.map((s) => s.id);

  // Click events
  const { data: clicks = [] } = useQuery({
    queryKey: ["bfe-clicks", shortLinkIds.join(",")],
    enabled: shortLinkIds.length > 0,
    queryFn: async (): Promise<Click[]> => {
      const { data, error } = await supabase
        .from("short_link_clicks")
        .select("short_link_id, candidate_id, clicked_at")
        .in("short_link_id", shortLinkIds);
      if (error) throw error;
      return (data ?? []) as Click[];
    },
  });

  // Inbound SMS replies
  const { data: smsReplies = [] } = useQuery({
    queryKey: ["bfe-sms-replies", candidateIds.join(","), from, to],
    enabled: candidateIds.length > 0,
    queryFn: async (): Promise<CommLog[]> => {
      const { data, error } = await supabase
        .from("communication_logs")
        .select("candidate_id, direction, type, created_at")
        .in("candidate_id", candidateIds)
        .eq("direction", "inbound")
        .eq("type", "sms")
        .gte("created_at", fromIso)
        .lte("created_at", toIso);
      if (error) throw error;
      return (data ?? []) as CommLog[];
    },
  });

  // Candidate statuses
  const { data: candidates = [] } = useQuery({
    queryKey: ["bfe-candidates", candidateIds.join(",")],
    enabled: candidateIds.length > 0,
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, status")
        .in("id", candidateIds);
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
  });

  // ---------- Aggregations ----------
  const sentTouchpoints = touchpoints.filter((t) => t.status === "sent");
  const failedTouchpoints = touchpoints.filter((t) => t.status === "failed");
  const sentCount = sentTouchpoints.length;

  const linkByCandidate = new Map<string, ShortLink[]>();
  shortLinks.forEach((sl) => {
    if (!sl.candidate_id) return;
    const arr = linkByCandidate.get(sl.candidate_id) ?? [];
    arr.push(sl);
    linkByCandidate.set(sl.candidate_id, arr);
  });

  const bookingClickedCandidates = new Set<string>();
  const unsubscribeClickedCandidates = new Set<string>();
  const linkById = new Map(shortLinks.map((s) => [s.id, s]));
  clicks.forEach((c) => {
    const link = linkById.get(c.short_link_id);
    if (!link?.candidate_id) return;
    if (link.link_type === "booking") bookingClickedCandidates.add(link.candidate_id);
    if (link.link_type === "unsubscribe") unsubscribeClickedCandidates.add(link.candidate_id);
  });

  const repliedCandidates = new Set(smsReplies.map((r) => r.candidate_id).filter(Boolean) as string[]);

  const candidateStatus = new Map(candidates.map((c) => [c.id, c.status]));
  const ghosted = candidateIds.filter((id) => candidateStatus.get(id) === "ghostet").length;
  const takketNej = candidateIds.filter((id) => candidateStatus.get(id) === "takket_nej").length;
  const interviewScheduled = candidateIds.filter((id) => candidateStatus.get(id) === "interview_scheduled").length;
  const selfBooked = enrollments.filter(
    (e) =>
      (e.cancelled_reason && /kandidat selv/i.test(e.cancelled_reason)) ||
      candidateStatus.get(e.candidate_id) === "interview_scheduled"
  ).length;

  const funnel = [
    { label: "Kandidater i flow", value: enrollments.length },
    { label: "Touchpoints sendt", value: sentCount, isBase: true },
    { label: "Unikke kandidater der åbnede booking-link", value: bookingClickedCandidates.size },
    { label: "Kandidater der svarede på SMS", value: repliedCandidates.size },
    { label: "Selvbookede interviews", value: selfBooked },
    { label: "Interview planlagt", value: interviewScheduled },
    { label: "Ghosted", value: ghosted },
    { label: "Takket nej", value: takketNej },
    { label: "Afmeldt (unsubscribe)", value: unsubscribeClickedCandidates.size },
  ];

  // Per-touchpoint breakdown
  type TpRow = {
    template_key: string;
    sent: number;
    smsReply48h: number;
    bookingClick48h: number;
    booked48h: number;
    failed: number;
  };
  const enrollmentToCandidate = new Map(enrollments.map((e) => [e.id, e.candidate_id]));
  const repliesByCandidate = new Map<string, Date[]>();
  smsReplies.forEach((r) => {
    if (!r.candidate_id) return;
    const arr = repliesByCandidate.get(r.candidate_id) ?? [];
    arr.push(parseISO(r.created_at));
    repliesByCandidate.set(r.candidate_id, arr);
  });
  const clicksByCandidate = new Map<string, { type: string | null; at: Date }[]>();
  clicks.forEach((c) => {
    const link = linkById.get(c.short_link_id);
    if (!link?.candidate_id) return;
    const arr = clicksByCandidate.get(link.candidate_id) ?? [];
    arr.push({ type: link.link_type, at: parseISO(c.clicked_at) });
    clicksByCandidate.set(link.candidate_id, arr);
  });

  const tpMap = new Map<string, TpRow>();
  const ensureRow = (key: string): TpRow => {
    let row = tpMap.get(key);
    if (!row) {
      row = { template_key: key, sent: 0, smsReply48h: 0, bookingClick48h: 0, booked48h: 0, failed: 0 };
      tpMap.set(key, row);
    }
    return row;
  };
  touchpoints.forEach((tp) => {
    const key = tp.template_key ?? "(ukendt)";
    const row = ensureRow(key);
    if (tp.status === "failed") row.failed += 1;
    if (tp.status !== "sent" || !tp.sent_at) return;
    row.sent += 1;
    const cid = enrollmentToCandidate.get(tp.enrollment_id);
    if (!cid) return;
    const sentAt = parseISO(tp.sent_at);
    const within48 = (d: Date) => {
      const diff = differenceInHours(d, sentAt);
      return diff >= 0 && diff <= 48;
    };
    if ((repliesByCandidate.get(cid) ?? []).some(within48)) row.smsReply48h += 1;
    const cClicks = clicksByCandidate.get(cid) ?? [];
    if (cClicks.some((c) => c.type === "booking" && within48(c.at))) row.bookingClick48h += 1;
    if (candidateStatus.get(cid) === "interview_scheduled") row.booked48h += 1;
  });
  const tpRows = Array.from(tpMap.values()).sort((a, b) => b.sent - a.sent);

  // Per-tier breakdown
  type TierRow = {
    tier: string;
    candidates: number;
    sent: number;
    replied: number;
    bookingClicked: number;
    booked: number;
    ghosted: number;
  };
  const tierMap = new Map<string, TierRow>();
  enrollments.forEach((e) => {
    const tier = e.tier ?? "(ukendt)";
    let row = tierMap.get(tier);
    if (!row) {
      row = { tier, candidates: 0, sent: 0, replied: 0, bookingClicked: 0, booked: 0, ghosted: 0 };
      tierMap.set(tier, row);
    }
    row.candidates += 1;
    if (repliedCandidates.has(e.candidate_id)) row.replied += 1;
    if (bookingClickedCandidates.has(e.candidate_id)) row.bookingClicked += 1;
    if (candidateStatus.get(e.candidate_id) === "interview_scheduled") row.booked += 1;
    if (candidateStatus.get(e.candidate_id) === "ghostet") row.ghosted += 1;
  });
  touchpoints.forEach((tp) => {
    if (tp.status !== "sent") return;
    const cid = enrollmentToCandidate.get(tp.enrollment_id);
    const enr = enrollments.find((e) => e.id === tp.enrollment_id);
    if (!enr) return;
    const row = tierMap.get(enr.tier ?? "(ukendt)");
    if (row) row.sent += 1;
  });
  const tierRows = Array.from(tierMap.values()).sort((a, b) => a.tier.localeCompare(b.tier));

  return (
    <MainLayout>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/recruitment/booking-flow">
                <ArrowLeft className="h-4 w-4 mr-1" /> Booking Flow
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Engagement-rapport</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Måler hvordan kandidater interagerer med booking-flowet.
              </p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fra</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Til</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Antal</TableHead>
                  <TableHead className="text-right">% af sendt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnel.map((f) => (
                  <TableRow key={f.label}>
                    <TableCell className={f.isBase ? "font-medium" : ""}>{f.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.value}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {f.isBase ? "—" : formatPct(f.value, sentCount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per touchpoint (template)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead className="text-right">Sendt</TableHead>
                  <TableHead className="text-right">SMS-svar &lt;48t</TableHead>
                  <TableHead className="text-right">Link åbnet &lt;48t</TableHead>
                  <TableHead className="text-right">Booket &lt;48t</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tpRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Ingen touchpoints i perioden.
                    </TableCell>
                  </TableRow>
                )}
                {tpRows.map((r) => (
                  <TableRow key={r.template_key}>
                    <TableCell className="font-mono text-xs">{r.template_key}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sent}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.smsReply48h} <span className="text-muted-foreground text-xs">({formatPct(r.smsReply48h, r.sent)})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.bookingClick48h} <span className="text-muted-foreground text-xs">({formatPct(r.bookingClick48h, r.sent)})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.booked48h} <span className="text-muted-foreground text-xs">({formatPct(r.booked48h, r.sent)})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{r.failed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per tier (segment)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Kandidater</TableHead>
                  <TableHead className="text-right">Sendt</TableHead>
                  <TableHead className="text-right">Svaret</TableHead>
                  <TableHead className="text-right">Klikket</TableHead>
                  <TableHead className="text-right">Booket</TableHead>
                  <TableHead className="text-right">Ghosted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tierRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Ingen kandidater i perioden.
                    </TableCell>
                  </TableRow>
                )}
                {tierRows.map((r) => (
                  <TableRow key={r.tier}>
                    <TableCell className="font-medium uppercase">{r.tier}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.candidates}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sent}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.replied} <span className="text-muted-foreground text-xs">({formatPct(r.replied, r.candidates)})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.bookingClicked} <span className="text-muted-foreground text-xs">({formatPct(r.bookingClicked, r.candidates)})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.booked} <span className="text-muted-foreground text-xs">({formatPct(r.booked, r.candidates)})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.ghosted}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
