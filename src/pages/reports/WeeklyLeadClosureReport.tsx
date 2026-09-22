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
  Trash2,
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
  useWeeklyLeadCallStats,
  useWeeklyLeadClosureRecipients,
  useWeeklyLeadClosureRuns,
  useWeeklyLeadClosureStats,
  useWeeklyLeadClosureTaskSummaries,
  useWeeklyLeadReportLines,
} from "@/hooks/useWeeklyLeadClosureReport";

const NO_LINE = "__none__";
const ACCOUNT_LABEL: Record<string, string> = { main: "Hovedkonto", lederne: "Lederne" };

/** Status der vises som "Ugyldige leads" i hovedtabellen. */
const INVALID_STATUS = "invalid";

/** Status der vises som "Ukvalificerede" i hovedtabellen. */
const UNQUALIFIED_STATUS = "unqualified";

/** Egen nøgle for Max Call Reach — står uden for tragten. */
const MCR_STATUS = "max_call_reach";


/** Tærskler for farvemarkering — justér her. */
const INVALID_WARN_PCT = 5;
const INVALID_ALERT_PCT = 15;
const CONTACT_WARN_PCT = 40;
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

/** Vises hvor dialeren lukker emner som ugyldige uden egen markering. */
function InInvalidChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
      i ugyldige
    </span>
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
  const { data: stats = [], isLoading: statsLoading } = useWeeklyLeadClosureStats();
  const { data: callStats = [] } = useWeeklyLeadCallStats();
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

  const availableWeeks = useMemo(
    () => [...new Set(stats.map((s) => s.week_start))].sort().reverse(),
    [stats],
  );
  const activeWeek = selectedWeek || availableWeeks[0] || "";

  /**
   * Uger der indgår i den valgte periode. Samme rækker og samme beregninger —
   * kun datointervallet er bredere.
   */
  const periodWeeks = useMemo(() => {
    if (!activeWeek) return [] as string[];
    if (period === "week") return [activeWeek];
    if (period === "month") {
      return availableWeeks.filter(
        (w) => w.slice(0, 7) === activeWeek.slice(0, 7) && w <= activeWeek,
      );
    }
    return availableWeeks.filter(
      (w) => w.slice(0, 4) === activeWeek.slice(0, 4) && w <= activeWeek,
    );
  }, [period, activeWeek, availableWeeks]);

  const weekRows = useMemo(
    () => stats.filter((s) => periodWeeks.includes(s.week_start)),
    [stats, periodWeeks],
  );

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

  /** Opkaldstal pr. rapportlinje for den valgte periode. */
  const callsByLine = useMemo(() => {
    const lineFor = new Map(
      mapping.map((m) => [`${m.account}|${m.adversus_campaign_id}`, m.report_line]),
    );
    const out = new Map<string, CallTotals>();
    for (const row of callStats) {
      if (!periodWeeks.includes(row.week_start)) continue;
      const line = lineFor.get(`${row.account}|${row.campaign_id}`);
      if (!line) continue;
      const entry = out.get(line) ??
        { attempts: 0, answered: 0, leadsDialed: 0, leadsAnswered: 0 };
      entry.attempts += row.attempts;
      entry.answered += row.answered;
      entry.leadsDialed += row.leads_dialed;
      entry.leadsAnswered += row.leads_answered;
      out.set(line, entry);
    }
    return out;
  }, [callStats, mapping, periodWeeks]);

  /**
   * Linjer hvor dialeren selv markerer emner lukket ved max opkaldsforsøg.
   * Kun Enreach gør det (status "Depleted"); Adversus har ingen markering, så
   * linjer uden en Enreach-kampagne viser "ikke tilgængeligt".
   */
  const mcrAvailableLines = useMemo(() => {
    const out = new Set<string>();
    for (const m of mapping) {
      if (!m.report_line || m.account !== "enreach") continue;
      out.add(m.report_line);
    }
    return out;
  }, [mapping]);

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
    for (const row of weekRows) {
      if (row.report_line) continue;
      const key = `${row.account}|${row.adversus_campaign_id}`;
      const entry =
        out.get(key) ?? { account: row.account, campaignId: row.adversus_campaign_id, closed: 0 };
      if (closingStatuses.includes(row.status)) entry.closed += row.lead_count;
      out.set(key, entry);
    }
    return [...out.values()].sort((a, b) => b.closed - a.closed);
  }, [weekRows, closingStatuses]);

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
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead colSpan={3} className="h-8" />
                      <TableHead
                        colSpan={3}
                        className="h-8 text-center text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        Frasorteret – ikke sælgerens ansvar
                      </TableHead>
                      <TableHead
                        colSpan={3}
                        className="h-8 text-center text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        Sælger
                      </TableHead>
                      <TableHead className="h-8 border-l text-center text-xs uppercase tracking-wider text-muted-foreground">
                        Kampagne
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                        Kampagne
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Emner lukket
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Kontaktandel
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Max Call Reach
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Ugyldige leads
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Ukvalificerede
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Kvalificerede samtaler
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Bookede
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Sælgerhitrate
                      </TableHead>
                      <TableHead className="border-l pl-4 text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Emneudnyttelse
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      {
                        title: "Partnersegmenter (Trygs medlemslister)",
                        rows: activeLineTotals.filter(
                          (r) => !COLD_CANVAS_LINES.includes(r.reportLine),
                        ),
                      },
                      {
                        title: "Kold kanvas",
                        rows: activeLineTotals.filter((r) =>
                          COLD_CANVAS_LINES.includes(r.reportLine),
                        ),
                      },
                    ]
                      .filter((group) => group.rows.length > 0)
                      .map((group) => (
                        <Fragment key={group.title}>
                          <TableRow className="hover:bg-transparent">
                            <TableCell
                              colSpan={9}
                              className="pt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                            >
                              {group.title}
                            </TableCell>
                          </TableRow>
                          {group.rows.map((row) => {
                            const invalid = row.extras[INVALID_STATUS] ?? 0;
                            const invalidPct = pctValue(invalid, row.closedTotal);
                            const unqualified = row.extras[UNQUALIFIED_STATUS] ?? 0;
                            const unqualifiedPct = pctValue(unqualified, row.closedTotal);
                            const contactPct = row.calls
                              ? pctValue(row.calls.leadsAnswered, row.calls.leadsDialed)
                              : null;
                            const hitPct = pctValue(row.booked, row.decided);
                            const usagePct = pctValue(row.booked, row.closedTotal);
                            const smallBase = row.decided < SMALL_BASE_DECIDED;
                            return (
                              <TableRow key={row.reportLine}>
                                <TableCell className="text-sm font-medium">
                                  {row.reportLine}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {formatCount(row.closedTotal)}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {!row.calls ? (
                                    <MissingCallsChip />
                                  ) : contactPct !== null &&
                                    contactPct < CONTACT_WARN_PCT ? (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 bg-amber-50 tabular-nums text-amber-700"
                                    >
                                      {formatPct(contactPct)}
                                    </Badge>
                                  ) : (
                                    formatPct(contactPct)
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {!row.mcrAvailable ? (
                                    <InInvalidChip />
                                  ) : (
                                    <>
                                      <span>{formatCount(row.mcr)}</span>
                                      <span className="ml-1 text-muted-foreground">
                                        ({formatPct(pctValue(row.mcr, row.closedTotal))})
                                      </span>
                                    </>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {invalidPct !== null && invalidPct > INVALID_ALERT_PCT ? (
                                    <Badge
                                      variant="outline"
                                      className="border-red-300 bg-red-50 tabular-nums text-red-700"
                                    >
                                      {formatPct(invalidPct)}
                                    </Badge>
                                  ) : invalidPct !== null && invalidPct >= INVALID_WARN_PCT ? (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 bg-amber-50 tabular-nums text-amber-700"
                                    >
                                      {formatPct(invalidPct)}
                                    </Badge>
                                  ) : (
                                    <span>{formatPct(invalidPct)}</span>
                                  )}
                                  <span className="ml-1 text-muted-foreground">
                                    ({formatCount(invalid)})
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  <span>{formatPct(unqualifiedPct)}</span>
                                  <span className="ml-1 text-muted-foreground">
                                    ({formatCount(unqualified)})
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {formatCount(row.decided)}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {formatCount(row.booked)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right text-sm">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={`h-full rounded-full ${
                                          smallBase
                                            ? "bg-muted-foreground/50"
                                            : "bg-emerald-500"
                                        }`}
                                        style={{
                                          width: `${Math.min(100, Math.max(0, hitPct ?? 0))}%`,
                                        }}
                                      />
                                    </div>
                                    <span
                                      className={`whitespace-nowrap tabular-nums ${
                                        smallBase
                                          ? "text-muted-foreground"
                                          : "font-semibold text-emerald-600"
                                      }`}
                                    >
                                      {formatPct(hitPct)}
                                    </span>
                                    {smallBase && (
                                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                                        lille grundlag
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="border-l pl-4 text-right text-sm font-semibold tabular-nums">
                                  {formatPct(usagePct)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      ))}
                  </TableBody>
                </Table>

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
                            Svarprocent
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
                                hitrate(row.calls.answered, row.calls.attempts)
                              ) : (
                                <MissingCallsChip />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
            {!statsLoading && linesWithoutCalls.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Kontaktandel kan ikke opgøres for {linesWithoutCalls.join(", ")} før opkaldsdata
                er koblet på.
              </p>
            )}
            {!statsLoading && linesWithoutMcr.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Max Call Reach kan ikke opgøres for {linesWithoutMcr.join(", ")}, da Adversus ikke
                markerer emner lukket ved max forsøg.
              </p>
            )}

            {!statsLoading && availableWeeks.length > 0 && idleLines.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {idleLines.length} {idleLines.length === 1 ? "kampagne" : "kampagner"} uden
                aktivitet i perioden: {idleLines.join(", ")}
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

            <div className="mt-6 grid gap-4 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="font-medium text-foreground">Leads behandlet</p>
                <p>Leads fra jeres lister, som vi har færdigbehandlet i perioden.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Kontaktandel</p>
                <p>
                  Andel af leads, hvor vi fik en person i røret. Lav andel peger typisk på
                  leadkvalitet eller forkerte numre.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Ugyldige leads</p>
                <p>
                  Forkert nummer, allerede kunde, afgået m.m. Markeres gult over{" "}
                  {INVALID_WARN_PCT} % og rødt over {INVALID_ALERT_PCT} %.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Ukvalificerede</p>
                <p>Samtaler hvor kunden ikke opfyldte kriterierne for et møde.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Hitrate</p>
                <p>
                  Bookede i procent af kvalificerede samtaler. Vises gråt ved under{" "}
                  {SMALL_BASE_DECIDED} samtaler, hvor tallet svinger meget.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Max Call Reach</p>
                <p>
                  Leads dialeren selv har lukket, fordi loftet af opkaldsforsøg er nået. Tallet er
                  dialerens egen markering (Enreach: status Depleted). Tæller ikke med i Leads
                  behandlet eller hitrate.
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
