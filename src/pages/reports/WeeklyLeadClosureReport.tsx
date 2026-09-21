import { useMemo, useState } from "react";
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
import { CheckCircle2, Loader2, Mail, Play, TableProperties, Trash2 } from "lucide-react";
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

/** Aggregerede opkaldstal pr. rapportlinje. */
type CallTotals = {
  attempts: number;
  answered: number;
  leadsDialed: number;
  leadsAnswered: number;
};

/** Procent med altid én decimal, så kolonnen flugter. */
function hitrate(part: number, whole: number): string {
  if (!whole) return "–";
  return `${((part / whole) * 100).toFixed(1).replace(".", ",")} %`;
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

export default function WeeklyLeadClosureReport() {
  const { isSuperadmin } = useIsSuperadmin();
  const [selectedWeek, setSelectedWeek] = useState<string>("");
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

  const weekRows = useMemo(
    () => stats.filter((s) => s.week_start === activeWeek),
    [stats, activeWeek],
  );

  /** Opkaldstal pr. rapportlinje for den valgte uge. */
  const callsByLine = useMemo(() => {
    const lineFor = new Map(
      mapping.map((m) => [`${m.account}|${m.adversus_campaign_id}`, m.report_line]),
    );
    const out = new Map<string, CallTotals>();
    for (const row of callStats) {
      if (row.week_start !== activeWeek) continue;
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
  }, [callStats, mapping, activeWeek]);

  const lineTotals = useMemo(() => {
    return lines.map((line) => {
      const rows = weekRows.filter((r) => r.report_line === line.report_line);
      const sum = (predicate: (status: string) => boolean) =>
        rows.filter((r) => predicate(r.status)).reduce((total, r) => total + r.lead_count, 0);
      const extras: Record<string, number> = {};
      for (const s of excludedStatuses) extras[s.status] = sum((status) => status === s.status);
      return {
        reportLine: line.report_line,
        closed: sum((status) => closingStatuses.includes(status)),
        decided: sum((status) => hitrateStatuses.includes(status)),
        booked: sum((status) => status === "success"),
        extras,
        calls: callsByLine.get(line.report_line) ?? null,
      };
    });
  }, [lines, weekRows, closingStatuses, hitrateStatuses, excludedStatuses, callsByLine]);

  /** Linjer med aktivitet vises; linjer uden nævnes i en note under tabellen. */
  const hasActivity = (l: { closed: number; calls: CallTotals | null }) =>
    l.closed > 0 || (l.calls?.attempts ?? 0) > 0;
  const activeLineTotals = useMemo(() => lineTotals.filter(hasActivity), [lineTotals]);
  const idleLines = useMemo(
    () => lineTotals.filter((l) => !hasActivity(l)).map((l) => l.reportLine),
    [lineTotals],
  );
  const linesWithoutCalls = useMemo(
    () => activeLineTotals.filter((l) => !l.calls).map((l) => l.reportLine),
    [activeLineTotals],
  );

  const totals = useMemo(() => {
    const extras: Record<string, number> = {};
    for (const s of excludedStatuses) {
      extras[s.status] = lineTotals.reduce((sum, l) => sum + (l.extras[s.status] ?? 0), 0);
    }
    const callSum = (pick: (c: CallTotals) => number) =>
      lineTotals.reduce((s, l) => s + (l.calls ? pick(l.calls) : 0), 0);
    return {
      closed: lineTotals.reduce((s, l) => s + l.closed, 0),
      decided: lineTotals.reduce((s, l) => s + l.decided, 0),
      booked: lineTotals.reduce((s, l) => s + l.booked, 0),
      extras,
      attempts: callSum((c) => c.attempts),
      answered: callSum((c) => c.answered),
      leadsDialed: callSum((c) => c.leadsDialed),
      leadsAnswered: callSum((c) => c.leadsAnswered),
    };
  }, [lineTotals, excludedStatuses]);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kampagneoversigt Tryg</h1>
            <p className="text-sm text-muted-foreground">
              Lukkede emner, bookede møder og hitrate pr. uge. Sendes automatisk mandag kl. 07.00.
            </p>
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
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TableProperties className="h-4 w-4" />
              Trygs skabelon
            </CardTitle>
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
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead colSpan={2} />
                    {excludedStatuses.length > 0 && (
                      <TableHead
                        colSpan={excludedStatuses.length}
                        className="text-center text-[10px] uppercase tracking-wider"
                      >
                        Frasorteret
                      </TableHead>
                    )}
                    <TableHead colSpan={3} className="text-center text-[10px] uppercase tracking-wider">
                      Kvalificeret
                    </TableHead>
                    <TableHead />
                    <TableHead colSpan={2} className="text-center text-[10px] uppercase tracking-wider">
                      Opkald
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead>Rapportlinje</TableHead>
                    <TableHead className="text-right">Lukkede</TableHead>
                    {excludedStatuses.map((s) => (
                      <TableHead key={s.status} className="text-right">
                        {s.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Ja/nej</TableHead>
                    <TableHead className="text-right">Ja/nej-andel</TableHead>
                    <TableHead className="text-right">Bookede</TableHead>
                    <TableHead className="text-right">Hitrate</TableHead>
                    <TableHead className="text-right">Svarprocent</TableHead>
                    <TableHead className="text-right">Kontaktandel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLineTotals.map((row) => (
                    <TableRow key={row.reportLine}>
                      <TableCell className="font-medium">{row.reportLine}</TableCell>
                      <TableCell className="text-right">{row.closed}</TableCell>
                      {excludedStatuses.map((s) => (
                        <TableCell key={s.status} className="text-right">
                          {sharePlusCount(row.extras[s.status] ?? 0, row.closed)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">{row.decided}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {hitrate(row.decided, row.closed)}
                      </TableCell>
                      <TableCell className="text-right">{row.booked}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {hitrate(row.booked, row.decided)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.calls ? hitrate(row.calls.answered, row.calls.attempts) : "–"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.calls ? hitrate(row.calls.leadsAnswered, row.calls.leadsDialed) : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Tryg i alt</TableCell>
                    <TableCell className="text-right">{totals.closed}</TableCell>
                    {excludedStatuses.map((s) => (
                      <TableCell key={s.status} className="text-right">
                        {totals.extras[s.status] ?? 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">{totals.decided}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {hitrate(totals.decided, totals.closed)}
                    </TableCell>
                    <TableCell className="text-right">{totals.booked}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {hitrate(totals.booked, totals.decided)}
                    </TableCell>
                    <TableCell className="text-right">
                      {hitrate(totals.answered, totals.attempts)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {hitrate(totals.leadsAnswered, totals.leadsDialed)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
            {!statsLoading && availableWeeks.length > 0 && idleLines.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {idleLines.length} {idleLines.length === 1 ? "linje" : "linjer"} uden aktivitet:{" "}
                {idleLines.join(", ")}
              </p>
            )}
            {!statsLoading && linesWithoutCalls.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Opkaldstal mangler for: {linesWithoutCalls.join(", ")}
              </p>
            )}
            {unmapped.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Ikke mappet:{" "}
                {unmapped
                  .map(
                    (u) =>
                      `${ACCOUNT_LABEL[u.account] ?? u.account}/${u.campaignId} (${u.closed} lukkede)`,
                  )
                  .join(", ")}
              </p>
            )}
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
