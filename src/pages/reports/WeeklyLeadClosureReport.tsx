import { Fragment, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mail,
  Play,
  TableProperties,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import {
  useAddClosureRecipient,
  useLeadClosingStatuses,
  useRemoveClosureRecipient,
  useRunWeeklyLeadClosureReport,
  useSendWeeklyLeadClosureMailNow,
  useToggleClosureRecipient,
  useUpdateCampaignMapping,
  useWeeklyLeadCampaignMap,
  useWeeklyLeadClosureReportData,
  useWeeklyLeadClosureRecipients,
  useWeeklyLeadClosureRuns,
  useWeeklyLeadClosureTaskSummaries,
  useWeeklyLeadReportLines,
} from "@/hooks/useWeeklyLeadClosureReport";

const NO_LINE = "__none__";
const ACCOUNT_LABEL: Record<string, string> = { main: "Hovedkonto", lederne: "Lederne" };

/** Status for ugyldige emner (forkert nummer, allerede kunde m.m.). */
const INVALID_STATUS = "invalid";

/** Status der vises som "Ukvalificerede" i hovedtabellen. */
const UNQUALIFIED_STATUS = "unqualified";

/** Egen nøgle for Max Call Reach — indgår i "Ikke kontaktbare". */
const MCR_STATUS = "max_call_reach";


/** Tærskler for farvemarkering — justér her. */
const UNREACHABLE_WARN_PCT = 25;
const UNREACHABLE_ALERT_PCT = 40;
const SMALL_BASE_DECIDED = 50;

/** Visuel gruppering af rækkerne (ingen tal, ingen beregning). */
const COLD_CANVAS_LINES = ["Kanvas"];

const MONTHS_DA = [
  "januar",
  "februar",
  "marts",
  "april",
  "maj",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "december",
];

type PeriodMode = "week" | "month" | "ytd";

/** Aggregerede opkaldstal pr. rapportlinje. */
type CallTotals = {
  attempts: number;
  answered: number;
  leadsDialed: number;
  leadsAnswered: number;
};

const numberFmt = new Intl.NumberFormat("da-DK");

function formatCount(value: number): string {
  return numberFmt.format(value);
}

function pctValue(part: number, whole: number): number | null {
  if (!whole) return null;
  return (part / whole) * 100;
}

function formatPct(value: number | null): string {
  if (value === null) return "–";
  return `${value.toFixed(1).replace(".", ",")} %`;
}

/** Procent med altid én decimal, så kolonnen flugter. */
function hitrate(part: number, whole: number): string {
  return formatPct(pctValue(part, whole));
}

function weekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week =
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `Uge ${week}`;
}

/** "15.–21. september 2026" ud fra mandagsdatoen. */
function weekRangeLabel(weekStart: string): string {
  if (!weekStart) return "";
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const startPart =
    start.getUTCMonth() === end.getUTCMonth()
      ? `${start.getUTCDate()}.`
      : `${start.getUTCDate()}. ${MONTHS_DA[start.getUTCMonth()]}`;
  return `${startPart}–${end.getUTCDate()}. ${MONTHS_DA[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/** Vises hvor opkaldsdata endnu ikke er koblet på kampagnen. */
function MissingCallsChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
      opkaldsdata mangler
    </span>
  );
}

/** Kolonnebredder – bruges af både hovedtabellens hoved, grupper og rækker. */
const REPORT_GRID =
  "grid grid-cols-[minmax(150px,1.7fr)_0.9fr_1.15fr_1.1fr_1.25fr_0.8fr_1.5fr_1.05fr] items-center";

type FunnelTone = "neutral" | "amber" | "red" | "green";

const FUNNEL_TONE: Record<FunnelTone, string> = {
  neutral: "bg-muted/40 text-foreground",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  green: "bg-emerald-50 text-emerald-700",
};

/** Antal stort, andel af emner lukket i lille gråt under. Ét format i hele tragten. */
function FunnelCell({
  count,
  pct,
  tone = "neutral",
}: {
  count: number;
  pct: number | null;
  tone?: FunnelTone;
}) {
  return (
    <div
      className={`mx-1 whitespace-nowrap rounded-lg px-2 py-2 text-center tabular-nums ${FUNNEL_TONE[tone]}`}
    >
      <div className="text-base font-semibold">{formatCount(count)}</div>
      <div className="text-xs opacity-80">{formatPct(pct)}</div>
    </div>
  );
}


type ReasonSource = "adversus" | "enreach" | "none";

/** Konti hvor Adversus har et årsagsfelt for ugyldig. Lederne har ikke. */
const REASON_ACCOUNTS = ["main"];
/** Gemt årsag for uger hentet før opdelingen, som ikke kunne genskabes. */
const NOT_SPLIT_REASON = "Ikke opgjort";

function BreakdownLine({
  label,
  count,
  whole,
  indent = false,
  strong = false,
}: {
  label: string;
  count: number;
  whole: number;
  indent?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${indent ? "pl-4 text-muted-foreground" : ""}`}>
      <span className={`truncate text-left ${strong ? "font-medium" : ""}`} title={label}>
        {label}
      </span>
      <span className="whitespace-nowrap tabular-nums">
        {formatCount(count)}
        <span className="ml-1 text-muted-foreground">{formatPct(pctValue(count, whole))}</span>
      </span>
    </div>
  );
}

function UnreachableBreakdown({
  source,
  invalid,
  mcr,
  reasons,
}: {
  source: ReasonSource;
  invalid: number;
  mcr: number;
  reasons: { reason: string | null; count: number }[];
}) {
  const total = invalid + mcr;
  if (source === "enreach") {
    return (
      <div className="ml-auto max-w-xs space-y-0.5 text-xs">
        <BreakdownLine label="Max call (lukket af dialeren)" count={mcr} whole={total} />
        <BreakdownLine label="Ugyldig" count={invalid} whole={total} />
      </div>
    );
  }
  if (source === "none") {
    return <span className="text-xs text-muted-foreground">årsag ikke tilgængelig</span>;
  }
  const marked = reasons
    .filter((r) => r.reason && r.reason !== NOT_SPLIT_REASON)
    .sort((a, b) => b.count - a.count);
  const markedTotal = marked.reduce((sum, r) => sum + r.count, 0);
  const notSplit = reasons
    .filter((r) => r.reason === NOT_SPLIT_REASON)
    .reduce((sum, r) => sum + r.count, 0);
  return (
    <div className="ml-auto max-w-xs space-y-0.5 text-xs">
      <BreakdownLine label="Sælgermarkeret ugyldig" count={markedTotal} whole={total} strong />
      {marked.map((r) => (
        <BreakdownLine
          key={r.reason}
          label={r.reason as string}
          count={r.count}
          whole={markedTotal}
          indent
        />
      ))}
      <BreakdownLine
        label="Lukket af dialeren (max kontaktforsøg eller dødt nummer)"
        count={total - markedTotal - notSplit}
        whole={total}
        strong
      />
      {notSplit > 0 && (
        <BreakdownLine label="Ikke opgjort (hentet før opdelingen)" count={notSplit} whole={total} />
      )}
    </div>
  );
}

export default function WeeklyLeadClosureReport() {
  const { isSuperadmin } = useIsSuperadmin();
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [period, setPeriod] = useState<PeriodMode>("week");
  const [showDetails, setShowDetails] = useState(false);
  const [sendMail, setSendMail] = useState(false);
  const [weeks, setWeeks] = useState("1");
  const [newRecipient, setNewRecipient] = useState("");

  const { data: lines = [] } = useWeeklyLeadReportLines();
  const { data: mapping = [], isLoading: mappingLoading } = useWeeklyLeadCampaignMap();
  const { data: statuses = [] } = useLeadClosingStatuses();
  const { data: report, isLoading: statsLoading } = useWeeklyLeadClosureReportData(
    period,
    selectedWeek || null,
  );
  const { data: runs = [] } = useWeeklyLeadClosureRuns();
  const { data: taskSummaries = [] } = useWeeklyLeadClosureTaskSummaries(
    runs.map((run) => run.id),
  );
  const updateMapping = useUpdateCampaignMapping();
  const runReport = useRunWeeklyLeadClosureReport();
  const { data: recipients = [], isLoading: recipientsLoading } =
    useWeeklyLeadClosureRecipients();
  const addRecipient = useAddClosureRecipient();
  const toggleRecipient = useToggleClosureRecipient();
  const removeRecipient = useRemoveClosureRecipient();
  const sendMailNow = useSendWeeklyLeadClosureMailNow();
  const activeRecipients = recipients.filter((r) => r.is_active).length;

  const handleAddRecipient = () => {
    const email = newRecipient.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Indtast en gyldig mailadresse");
      return;
    }
    if (recipients.some((r) => r.recipient_email.toLowerCase() === email)) {
      toast.error("Modtageren er allerede tilføjet");
      return;
    }
    addRecipient.mutate(email, {
      onSuccess: () => {
        setNewRecipient("");
        toast.success("Modtager tilføjet");
      },
      onError: (error: Error) => toast.error(error.message),
    });
  };

  const closingStatuses = useMemo(
    () => statuses.filter((s) => s.is_closing).map((s) => s.status),
    [statuses],
  );

  /** Statusser der er lukkede, men ikke må tælle i mødebook-hitraten. */
  const excludedStatuses = useMemo(
    () =>
      statuses
        .filter((s) => s.is_closing && s.counts_in_hitrate === false)
        .map((s) => ({ status: s.status, label: s.label_da || s.status }))
        .sort((a, b) => a.label.localeCompare(b.label, "da")),
    [statuses],
  );

  /** Frasorterede statusser ud over "Ugyldige leads" vises i detaljesektionen. */
  const detailStatuses = useMemo(
    () =>
      excludedStatuses.filter(
        (s) => s.status !== INVALID_STATUS && s.status !== UNQUALIFIED_STATUS,
      ),
    [excludedStatuses],
  );

  const hitrateStatuses = useMemo(
    () =>
      statuses
        .filter((s) => s.is_closing && s.counts_in_hitrate !== false)
        .map((s) => s.status),
    [statuses],
  );

  const availableWeeks = report?.weeks ?? [];
  const activeWeek = selectedWeek || availableWeeks[0] || "";
  const weekRows = report?.lines ?? [];


  const periodLabel = useMemo(() => {
    if (!activeWeek) return "";
    if (period === "week") return `${weekLabel(activeWeek)} · ${weekRangeLabel(activeWeek)}`;
    const year = activeWeek.slice(0, 4);
    if (period === "month") {
      const month = MONTHS_DA[Number(activeWeek.slice(5, 7)) - 1] ?? "";
      return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
    }
    return `År til dato ${year}`;
  }, [period, activeWeek]);

  /** Opkaldstal pr. rapportlinje for den valgte periode (aggregeret i databasen). */
  const callsByLine = useMemo(() => {
    const out = new Map<string, CallTotals>();
    for (const row of report?.calls ?? []) {
      out.set(row.report_line, {
        attempts: row.attempts,
        answered: row.answered,
        leadsDialed: row.leads_dialed,
        leadsAnswered: row.leads_answered,
      });
    }
    return out;
  }, [report]);


  /**
   * Linjer hvor dialeren selv markerer emner lukket ved max opkaldsforsøg.
   * Kun Enreach gør det (status "Depleted"); Adversus har ingen markering, så
   * linjer uden en Enreach-kampagne viser "ikke tilgængeligt".
   */
  const mcrAvailableLines = useMemo(
    () => new Set(report?.mcrLines ?? []),
    [report],
  );

  /** Ugyldige pr. årsag pr. rapportlinje (kun Adversus). */
  const reasonsByLine = useMemo(() => {
    const out = new Map<string, { reason: string | null; count: number }[]>();
    for (const r of report?.invalidReasons ?? []) {
      const list = out.get(r.report_line) ?? [];
      list.push({ reason: r.reason, count: r.lead_count });
      out.set(r.report_line, list);
    }
    return out;
  }, [report]);

  /** Hvilken opdeling en linje kan vise: Enreach, Adversus med årsagsfelt, eller ingen. */
  const reasonSourceOf = (reportLine: string): ReasonSource => {
    const accounts = (report?.lineAccounts ?? [])
      .filter((a) => a.report_line === reportLine)
      .map((a) => a.account);
    if (accounts.includes("enreach")) return "enreach";
    if (accounts.length > 0 && accounts.every((a) => REASON_ACCOUNTS.includes(a))) return "adversus";
    return "none";
  };

  const lineTotals = useMemo(() => {
    return lines.map((line) => {
      const rows = weekRows.filter((r) => r.report_line === line.report_line);
      const sum = (predicate: (status: string) => boolean) =>
        rows.filter((r) => predicate(r.status)).reduce((total, r) => total + r.lead_count, 0);
      const extras: Record<string, number> = {};
      for (const s of excludedStatuses) extras[s.status] = sum((status) => status === s.status);
      const closed = sum((status) => closingStatuses.includes(status));
      // Max Call Reach står uden for tragten og påvirker ingen af tallene ovenfor.
      const mcr = sum((status) => status === MCR_STATUS);
      return {
        reportLine: line.report_line,
        closed,
        decided: sum((status) => hitrateStatuses.includes(status)),
        booked: sum((status) => status === "success"),
        extras,
        calls: callsByLine.get(line.report_line) ?? null,
        mcr,
        mcrAvailable: mcrAvailableLines.has(line.report_line),
        /**
         * Emner lukket i alt = sælgerbehandlede + dialerens egne lukninger.
         * Hvor dialeren ikke markerer lukningen, ligger de allerede i invalid,
         * og tallet er derfor komplet uden MCR-leddet (mcr = 0).
         */
        closedTotal: closed + mcr,
      };
    });
  }, [
    lines,
    weekRows,
    closingStatuses,
    hitrateStatuses,
    excludedStatuses,
    callsByLine,
    mcrAvailableLines,
  ]);

  /** Linjer med aktivitet vises; linjer uden nævnes i en note under tabellen. */
  const hasActivity = (l: { closed: number; calls: CallTotals | null; mcr: number }) =>
    l.closed > 0 || (l.calls?.attempts ?? 0) > 0 || l.mcr > 0;
  const activeLineTotals = useMemo(() => lineTotals.filter(hasActivity), [lineTotals]);
  const idleLines = useMemo(
    () => lineTotals.filter((l) => !hasActivity(l)).map((l) => l.reportLine),
    [lineTotals],
  );
  const linesWithoutCalls = useMemo(
    () => activeLineTotals.filter((l) => !l.calls).map((l) => l.reportLine),
    [activeLineTotals],
  );
  const linesWithoutMcr = useMemo(
    () => activeLineTotals.filter((l) => !l.mcrAvailable).map((l) => l.reportLine),
    [activeLineTotals],
  );



  const unmapped = useMemo(() => {
    const out = new Map<string, { account: string; campaignId: string; closed: number }>();
    for (const row of report?.unmapped ?? []) {
      const key = `${row.account}|${row.campaign_id}`;
      const entry =
        out.get(key) ?? { account: row.account, campaignId: row.campaign_id, closed: 0 };
      if (closingStatuses.includes(row.status)) entry.closed += row.lead_count;
      out.set(key, entry);
    }
    return [...out.values()].sort((a, b) => b.closed - a.closed);
  }, [report, closingStatuses]);

  const unconfirmed = mapping.filter((m) => !m.is_confirmed).length;

  const handleRun = () => {
    runReport.mutate(
      { weeks: Number(weeks), sendMail },
      {
        onSuccess: (data) => {
          // Kørslen arbejder sig gennem en kø i baggrunden — status ses i
          // kørselsloggen nedenfor.
          toast.success(
            `Kørsel startet: ${data.tasks ?? 0} tasks i kø. Følg status i kørselsloggen.`,
          );
        },
        onError: (error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : "Kunne ikke køre rapporten",
          );
        },
      },
    );
  };

  const handleSendMailNow = () => {
    sendMailNow.mutate(undefined, {
      onSuccess: () => {
        toast.success(
          "Ugens tal hentes nu, og mailen sendes til alle aktive modtagere når kørslen er færdig",
        );
      },
      onError: (error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Kunne ikke sende mailen");
      },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tryg – ugerapport</h1>
            <p className="text-sm text-muted-foreground">
              {periodLabel ? `${periodLabel} · ` : ""}Resultater pr. kampagne
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(value) => value && setPeriod(value as PeriodMode)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="week">Uge</ToggleGroupItem>
              <ToggleGroupItem value="month">Måned</ToggleGroupItem>
              <ToggleGroupItem value="ytd">År til dato</ToggleGroupItem>
            </ToggleGroup>
            {availableWeeks.length > 0 && (
              <Select value={activeWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableWeeks.map((week) => (
                    <SelectItem key={week} value={week}>
                      {weekLabel(week)} ({week})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {isSuperadmin && (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={weeks} onValueChange={setWeeks}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Sidste uge</SelectItem>
                <SelectItem value="5">Seneste 5 uger</SelectItem>
                <SelectItem value="8">Seneste 8 uger</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="send-mail" checked={sendMail} onCheckedChange={setSendMail} />
              <Label htmlFor="send-mail" className="text-sm">
                Send mail
              </Label>
            </div>
            <Button onClick={handleRun} disabled={runReport.isPending}>
              {runReport.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Kør nu
            </Button>
            <Button
              variant="outline"
              onClick={handleSendMailNow}
              disabled={sendMailNow.isPending || activeRecipients === 0}
              title={
                activeRecipients === 0
                  ? "Tilføj mindst én aktiv modtager først"
                  : "Sender tallene for den igangværende uge"
              }
            >
              {sendMailNow.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send mail nu
            </Button>
          </div>
        )}

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TableProperties className="h-4 w-4" />
              Resultater pr. kampagne
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Henter tal…
              </div>
            ) : availableWeeks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Der er endnu ingen tal. Kør rapporten for at hente ugerne.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div className="min-w-[1000px]">
                    <div
                      className={`${REPORT_GRID} px-3 text-[11px] uppercase tracking-wider text-muted-foreground`}
                    >
                      <div />
                      <div />
                      <div className="col-span-2 text-center">
                        Frasorteret – ikke sælgerens ansvar
                      </div>
                      <div className="col-span-3 text-center">Sælger</div>
                      <div className="text-center">Kampagne</div>
                    </div>
                    {[
                      {
                        title: "Partnersegmenter (Trygs medlemslister)",
                        band: "bg-emerald-50/70",
                        iconBg: "bg-emerald-600",
                        icon: Users,
                        rows: activeLineTotals.filter(
                          (r) => !COLD_CANVAS_LINES.includes(r.reportLine),
                        ),
                      },
                      {
                        title: "Kold kanvas",
                        band: "bg-sky-50/70",
                        iconBg: "bg-sky-600",
                        icon: Target,
                        rows: activeLineTotals.filter((r) =>
                          COLD_CANVAS_LINES.includes(r.reportLine),
                        ),
                      },
                    ]
                      .filter((group) => group.rows.length > 0)
                      .map((group) => {
                        const GroupIcon = group.icon;
                        return (
                          <Fragment key={group.title}>
                            <div
                              className={`mt-4 flex items-center gap-3 rounded-lg px-3 py-2 ${group.band}`}
                            >
                              <span
                                className={`flex h-7 w-7 items-center justify-center rounded-full ${group.iconBg}`}
                              >
                                <GroupIcon className="h-4 w-4 text-white" />
                              </span>
                              <span className="text-sm font-semibold">{group.title}</span>
                            </div>
                            <div
                              className={`${REPORT_GRID} px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground`}
                            >
                              <div>Kampagne</div>
                              <div className="text-center">Emner lukket</div>
                              <div className="text-center">Ikke kontaktbare</div>
                              <div className="text-center">Ukvalificerede</div>
                              <div className="text-center">Kvalificerede samtaler</div>
                              <div className="text-center">Bookede</div>
                              <div className="text-center">Sælgerhitrate</div>
                              <div className="text-center">Emneudnyttelse</div>
                            </div>
                            {group.rows.map((row) => {
                              const invalid = row.extras[INVALID_STATUS] ?? 0;
                              /**
                               * Ikke kontaktbare = ugyldige + dialerens egne lukninger ved max
                               * kontaktforsøg. På Adversus ligger lukningerne allerede i ugyldige
                               * (mcr = 0), så begrebet er ens på tværs af systemer.
                               */
                              const unreachable = invalid + row.mcr;
                              const unreachablePct = pctValue(unreachable, row.closedTotal);
                              const unqualified = row.extras[UNQUALIFIED_STATUS] ?? 0;
                              const unqualifiedPct = pctValue(unqualified, row.closedTotal);
                              const decidedPct = pctValue(row.decided, row.closedTotal);
                              const hitPct = pctValue(row.booked, row.decided);
                              const usagePct = pctValue(row.booked, row.closedTotal);
                              const smallBase = row.decided < SMALL_BASE_DECIDED;
                              const unreachableTone: FunnelTone =
                                unreachablePct !== null && unreachablePct > UNREACHABLE_ALERT_PCT
                                  ? "red"
                                  : unreachablePct !== null &&
                                      unreachablePct >= UNREACHABLE_WARN_PCT
                                    ? "amber"
                                    : "neutral";
                              return (
                                <div
                                  key={row.reportLine}
                                  className={`${REPORT_GRID} mb-2 rounded-xl border bg-card px-3 py-2 shadow-sm`}
                                >
                                  <div className="text-sm font-semibold">{row.reportLine}</div>
                                  <div className="whitespace-nowrap text-center text-base font-semibold tabular-nums">
                                    {formatCount(row.closedTotal)}
                                  </div>
                                  <FunnelCell
                                    count={unreachable}
                                    pct={unreachablePct}
                                    tone={unreachableTone}
                                  />
                                  <FunnelCell count={unqualified} pct={unqualifiedPct} />
                                  <FunnelCell
                                    count={row.decided}
                                    pct={decidedPct}
                                    tone="green"
                                  />
                                  <div className="whitespace-nowrap text-center text-sm tabular-nums">
                                    {formatCount(row.booked)}
                                  </div>
                                  <div className="flex items-center justify-center gap-2 text-sm">
                                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={`h-full rounded-full ${
                                          smallBase ? "bg-muted-foreground/50" : "bg-emerald-500"
                                        }`}
                                        style={{
                                          width: `${Math.min(100, Math.max(0, hitPct ?? 0))}%`,
                                        }}
                                      />
                                    </div>
                                    <div className="text-right">
                                      <div
                                        className={`whitespace-nowrap tabular-nums ${
                                          smallBase
                                            ? "text-muted-foreground"
                                            : "font-semibold text-emerald-600"
                                        }`}
                                      >
                                        {formatPct(hitPct)}
                                      </div>
                                      {smallBase && (
                                        <div className="whitespace-nowrap text-xs text-muted-foreground">
                                          lille grundlag
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="whitespace-nowrap text-center text-base font-semibold tabular-nums">
                                    {formatPct(usagePct)}
                                  </div>
                                </div>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Kvalificerede samtaler
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    Ikke kontaktbare
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    Højt niveau (opmærksomhed)
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
                    Lavt grundlag
                  </span>
                </div>

                <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="mt-3 text-sm">
                      <ChevronDown
                        className={`mr-2 h-4 w-4 transition-transform ${
                          showDetails ? "rotate-180" : ""
                        }`}
                      />
                      Vis detaljer
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Table className="mt-2">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                            Kampagne
                          </TableHead>
                          {detailStatuses.map((s) => (
                            <TableHead
                              key={s.status}
                              className="text-right text-xs uppercase tracking-wider text-muted-foreground"
                            >
                              {s.label}
                            </TableHead>
                          ))}
                          <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                            Ja/nej-andel
                          </TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                            Kontaktandel
                          </TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                            Svarprocent
                          </TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                            Ikke kontaktbare – opdeling
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeLineTotals.map((row) => (
                          <TableRow key={row.reportLine}>
                            <TableCell className="text-sm font-medium">
                              {row.reportLine}
                            </TableCell>
                            {detailStatuses.map((s) => (
                              <TableCell
                                key={s.status}
                                className="text-right text-sm tabular-nums"
                              >
                                {formatPct(pctValue(row.extras[s.status] ?? 0, row.closed))}
                                <span className="ml-1 text-muted-foreground">
                                  ({formatCount(row.extras[s.status] ?? 0)})
                                </span>
                              </TableCell>
                            ))}
                            <TableCell className="text-right text-sm tabular-nums">
                              {hitrate(row.decided, row.closed)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {row.calls ? (
                                hitrate(row.calls.leadsAnswered, row.calls.leadsDialed)
                              ) : (
                                <MissingCallsChip />
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {row.calls ? (
                                hitrate(row.calls.answered, row.calls.attempts)
                              ) : (
                                <MissingCallsChip />
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <UnreachableBreakdown
                                source={reasonSourceOf(row.reportLine)}
                                invalid={row.extras[INVALID_STATUS] ?? 0}
                                mcr={row.mcr}
                                reasons={reasonsByLine.get(row.reportLine) ?? []}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {linesWithoutCalls.length > 0 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Kontaktandel kan ikke opgøres for {linesWithoutCalls.join(", ")} før
                        opkaldsdata er koblet på.
                      </p>
                    )}
                    {unmapped.length > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ikke mappet:{" "}
                        {unmapped
                          .map(
                            (u) =>
                              `${ACCOUNT_LABEL[u.account] ?? u.account}/${u.campaignId} (${u.closed} lukkede)`,
                          )
                          .join(", ")}
                      </p>
                    )}
                    <div className="mt-4 grid gap-4 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        <p className="font-medium text-foreground">Kontaktandel</p>
                        <p>
                          Andel af leads, hvor vi fik en person i røret. Lav andel peger typisk på
                          leadkvalitet eller forkerte numre.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Ikke kontaktbare – opdeling</p>
                        <p>
                          Sælgermarkeret ugyldig: sælgeren har talt med eller afklaret emnet og
                          markeret det ugyldigt med en årsag. Lukket af dialeren: emnet blev lukket
                          automatisk uden kontakt – ved max kontaktforsøg eller fordi nummeret ikke
                          virker. På Kanvas (Enreach) markerer dialeren selv max call.
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Ikke kontaktbare = sælgermarkeret ugyldig eller lukket af dialeren (max kontaktforsøg
              eller dødt nummer) – se opdelingen under detaljer.
            </p>
            {!statsLoading && availableWeeks.length > 0 && idleLines.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {idleLines.length} {idleLines.length === 1 ? "kampagne" : "kampagner"} uden
                aktivitet i perioden: {idleLines.join(", ")}
              </p>
            )}

            <div className="mt-6 grid gap-4 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="font-medium text-foreground">Emner lukket</p>
                <p>Alle emner afsluttet i perioden – af en sælger eller af dialeren.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Ikke kontaktbare</p>
                <p>
                  Emner vi aldrig fik en samtale med – forkert nummer, allerede kunde eller lukket
                  af dialeren ved max kontaktforsøg. Handler om listekvalitet, ikke om sælgerne
                  eller Trygs kvalificeringskriterier.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Ukvalificerede</p>
                <p>
                  Emner der opfyldte kriterierne for en samtale, men ikke for et møde. Ikke
                  sælgerens ansvar.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Sælgerhitrate</p>
                <p>
                  Bookede møder i procent af kvalificerede samtaler. Måler sælgerne. Vises gråt ved
                  under {SMALL_BASE_DECIDED} samtaler.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Emneudnyttelse</p>
                <p>
                  Bookede møder i procent af alle lukkede emner. Måler hvad kampagnen får ud af de
                  leverede leads.
                </p>
              </div>
            </div>


          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Modtagere af mandagsmailen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipientsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Henter modtagere…
              </div>
            ) : recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Der er ingen modtagere. Mailen sendes ikke, før mindst én er tilføjet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mailadresse</TableHead>
                    <TableHead className="text-right">Modtager mailen</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.recipient_email}</TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={row.is_active}
                          disabled={!isSuperadmin || toggleRecipient.isPending}
                          onCheckedChange={(checked) =>
                            toggleRecipient.mutate(
                              { id: row.id, isActive: checked },
                              { onError: (error: Error) => toast.error(error.message) },
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {isSuperadmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={removeRecipient.isPending}
                            onClick={() =>
                              removeRecipient.mutate(row.id, {
                                onSuccess: () => toast.success("Modtager fjernet"),
                                onError: (error: Error) => toast.error(error.message),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {isSuperadmin && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="email"
                  placeholder="navn@copenhagensales.dk"
                  className="w-[280px]"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddRecipient();
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={handleAddRecipient}
                  disabled={addRecipient.isPending}
                >
                  Tilføj modtager
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Kampagner og rapportlinjer
              {unconfirmed > 0 && (
                <Badge variant="secondary">{unconfirmed} ikke bekræftet</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mappingLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Henter opsætning…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Konto</TableHead>
                    <TableHead>Kampagne</TableHead>
                    <TableHead>Rapportlinje</TableHead>
                    <TableHead className="text-right">Bekræftet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapping.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{ACCOUNT_LABEL[row.account] ?? row.account}</TableCell>
                      <TableCell>
                        <div>{row.adversus_campaign_name ?? row.adversus_campaign_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.adversus_campaign_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.report_line ?? NO_LINE}
                          disabled={!isSuperadmin || updateMapping.isPending}
                          onValueChange={(value) =>
                            updateMapping.mutate(
                              {
                                id: row.id,
                                reportLine: value === NO_LINE ? null : value,
                                confirm: false,
                              },
                              {
                                onError: () => toast.error("Kunne ikke gemme rapportlinjen"),
                              },
                            )
                          }
                        >
                          <SelectTrigger className="w-[230px]">
                            <SelectValue placeholder="Ingen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_LINE}>Ingen</SelectItem>
                            {lines.map((line) => (
                              <SelectItem key={line.report_line} value={line.report_line}>
                                {line.report_line}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.is_confirmed ? (
                          <Badge className="gap-1" variant="secondary">
                            <CheckCircle2 className="h-3 w-3" /> Bekræftet
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!isSuperadmin || !row.report_line || updateMapping.isPending}
                            onClick={() =>
                              updateMapping.mutate(
                                { id: row.id, reportLine: row.report_line, confirm: true },
                                {
                                  onSuccess: () => toast.success("Mapping bekræftet"),
                                  onError: () => toast.error("Kunne ikke bekræfte mappingen"),
                                },
                              )
                            }
                          >
                            Bekræft
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {runs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seneste kørsler</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tidspunkt</TableHead>
                    <TableHead>Konto</TableHead>
                    <TableHead className="text-right">Færdige</TableHead>
                    <TableHead className="text-right">Afventer</TableHead>
                    <TableHead className="text-right">Fejl</TableHead>
                    <TableHead className="text-right">Emner</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const progress = taskSummaries.find((summary) => summary.runId === run.id);
                    return (
                    <TableRow key={run.id}>
                      <TableCell>
                        {new Date(run.started_at).toLocaleString("da-DK", {
                          timeZone: "Europe/Copenhagen",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        {run.mail_sent
                          ? "Mail"
                          : (ACCOUNT_LABEL[run.account ?? ""] ?? run.account ?? "–")}
                      </TableCell>
                      <TableCell className="text-right">{progress?.done ?? run.campaigns_scanned}</TableCell>
                      <TableCell className="text-right">
                        {(progress?.pending ?? 0) + (progress?.running ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">{progress?.error ?? 0}</TableCell>
                      <TableCell className="text-right">{run.leads_scanned}</TableCell>
                      <TableCell>
                        {run.finished_at === null ? (
                          <span className="text-muted-foreground">Kører</span>
                        ) : run.error ? (
                          <span className="text-destructive">{run.error}</span>
                        ) : (
                          "OK"
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
