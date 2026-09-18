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
import { CheckCircle2, Loader2, Play, TableProperties } from "lucide-react";
import { toast } from "sonner";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import {
  useLeadClosingStatuses,
  useRunWeeklyLeadClosureReport,
  useUpdateCampaignMapping,
  useWeeklyLeadCampaignMap,
  useWeeklyLeadClosureRuns,
  useWeeklyLeadClosureStats,
  useWeeklyLeadReportLines,
} from "@/hooks/useWeeklyLeadClosureReport";

const NO_LINE = "__none__";
const ACCOUNT_LABEL: Record<string, string> = { main: "Hovedkonto", lederne: "Lederne" };

function hitrate(booked: number, closed: number): string {
  if (!closed) return "–";
  return `${(Math.round((booked / closed) * 1000) / 10).toString().replace(".", ",")} %`;
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

  const { data: lines = [] } = useWeeklyLeadReportLines();
  const { data: mapping = [], isLoading: mappingLoading } = useWeeklyLeadCampaignMap();
  const { data: statuses = [] } = useLeadClosingStatuses();
  const { data: stats = [], isLoading: statsLoading } = useWeeklyLeadClosureStats();
  const { data: runs = [] } = useWeeklyLeadClosureRuns();
  const updateMapping = useUpdateCampaignMapping();
  const runReport = useRunWeeklyLeadClosureReport();

  const closingStatuses = useMemo(
    () => statuses.filter((s) => s.is_closing).map((s) => s.status),
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

  const lineTotals = useMemo(() => {
    return lines.map((line) => {
      const rows = weekRows.filter((r) => r.report_line === line.report_line);
      const closed = rows
        .filter((r) => closingStatuses.includes(r.status))
        .reduce((sum, r) => sum + r.lead_count, 0);
      const booked = rows
        .filter((r) => r.status === "success")
        .reduce((sum, r) => sum + r.lead_count, 0);
      return { reportLine: line.report_line, closed, booked };
    });
  }, [lines, weekRows, closingStatuses]);

  const totals = useMemo(
    () => ({
      closed: lineTotals.reduce((s, l) => s + l.closed, 0),
      booked: lineTotals.reduce((s, l) => s + l.booked, 0),
    }),
    [lineTotals],
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
          const scanned = data.accounts.reduce((s, a) => s + a.leadsScanned, 0);
          const failed = data.accounts.filter((a) => a.error);
          toast.success(
            `Kørsel færdig: ${scanned} emner gennemgået${data.mailQueued ? ", mail lagt i kø" : ""}`,
          );
          if (failed.length) {
            toast.warning(
              `Fejl på: ${failed.map((f) => `${ACCOUNT_LABEL[f.account] ?? f.account} (${f.error})`).join(", ")}`,
            );
          }
        },
        onError: (error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : "Kunne ikke køre rapporten",
          );
        },
      },
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mødebook-rapport (Tryg)</h1>
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
                  <TableRow>
                    <TableHead>Rapportlinje</TableHead>
                    <TableHead className="text-right">Antal lukkede emner</TableHead>
                    <TableHead className="text-right">Antal bookede møder</TableHead>
                    <TableHead className="text-right">Mødebook hitrate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineTotals.map((row) => (
                    <TableRow key={row.reportLine}>
                      <TableCell>{row.reportLine}</TableCell>
                      <TableCell className="text-right">{row.closed}</TableCell>
                      <TableCell className="text-right">{row.booked}</TableCell>
                      <TableCell className="text-right">{hitrate(row.booked, row.closed)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Tryg i alt</TableCell>
                    <TableCell className="text-right">{totals.closed}</TableCell>
                    <TableCell className="text-right">{totals.booked}</TableCell>
                    <TableCell className="text-right">
                      {hitrate(totals.booked, totals.closed)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
                    <TableHead className="text-right">Kampagner</TableHead>
                    <TableHead className="text-right">Emner</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
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
                      <TableCell className="text-right">{run.campaigns_scanned}</TableCell>
                      <TableCell className="text-right">{run.leads_scanned}</TableCell>
                      <TableCell>
                        {run.error ? (
                          <span className="text-destructive">{run.error}</span>
                        ) : (
                          "OK"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
