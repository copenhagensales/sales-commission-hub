import { useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import {
  TRYG_FLOW_FLAG,
  useDanishHolidayDates,
  useRunTrygFlowSync,
  useToggleTrygFlowRecipient,
  useTrygFlowDaily,
  useTrygFlowRecipients,
} from "@/hooks/useTrygFlowStatus";
import {
  useLeadClosingStatuses,
  useWeeklyLeadCampaignMap,
  useWeeklyLeadReportLines,
} from "@/hooks/useWeeklyLeadClosureReport";
import { computeFlowLines, type FlowStatus } from "@/lib/trygFlow";

const fmt = (n: number | null, digits = 0) =>
  n === null ? "–" : n.toLocaleString("da-DK", { maximumFractionDigits: digits, minimumFractionDigits: digits });

const STATUS: Record<FlowStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  green: { label: "Grøn", variant: "default" },
  yellow: { label: "Gul", variant: "secondary" },
  red: { label: "Rød", variant: "destructive" },
};

function copenhagenToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(new Date());
}

/** Leveringsstatus – denne uge (intern). Skjult bag feature-flag; superadmin ser den til afstemning. */
export function TrygFlowStatus() {
  const { data: flagOn = false } = useFeatureFlag(TRYG_FLOW_FLAG);
  const { isSuperadmin } = useIsSuperadmin();
  const visible = flagOn || isSuperadmin;

  const daily = useTrygFlowDaily(visible);
  const holidays = useDanishHolidayDates();
  const lines = useWeeklyLeadReportLines();
  const map = useWeeklyLeadCampaignMap();
  const statuses = useLeadClosingStatuses();
  const recipients = useTrygFlowRecipients(visible && isSuperadmin);
  const toggle = useToggleTrygFlowRecipient();
  const sync = useRunTrygFlowSync();

  const rows = useMemo(() => {
    if (!daily.data || !lines.data || !map.data || !statuses.data) return [];
    const mapping = new Map(map.data.map((m) => [`${m.account}|${m.adversus_campaign_id}`, m.report_line]));
    return computeFlowLines({
      rows: daily.data,
      lines: lines.data.map((l) => l.report_line),
      lineOf: (a, c) => mapping.get(`${a}|${c}`) ?? null,
      closing: new Set(statuses.data.filter((s) => s.is_closing).map((s) => s.status)),
      holidays: new Set(holidays.data ?? []),
      today: copenhagenToday(),
    });
  }, [daily.data, lines.data, map.data, statuses.data, holidays.data]);

  if (!visible) return null;

  const internal = (recipients.data ?? []).filter((r) => r.recipient_email.toLowerCase().endsWith("@copenhagensales.dk"));

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Leveringsstatus – denne uge</CardTitle>
          <div className="flex items-center gap-2">
            {!flagOn && <Badge variant="outline">Skjult – afventer godkendt afstemning</Badge>}
            {isSuperadmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={sync.isPending}
                onClick={() =>
                  sync.mutate(2, {
                    onSuccess: () => toast.success("Leveringsstatus opdateres – tallene kommer om lidt"),
                    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Kunne ikke opdatere"),
                  })
                }
              >
                Opdatér nu
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Internt – ikke til kunden. Modtaget = emner oprettet i ugen. Lukket = Tryg-rapportens lukkede emner, uanset
          hvornår de er modtaget. <strong>Krævet, Status og Anbefaling er en prognose.</strong> Afstemningen mod Trygs
          tal har kendte afvigelser.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {daily.isLoading ? (
          <p className="text-sm text-muted-foreground">Henter…</p>
        ) : daily.error ? (
          <p className="text-sm text-destructive">Kunne ikke hente leveringsstatus.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kampagne</TableHead>
                  <TableHead className="text-right">Modtaget denne uge</TableHead>
                  <TableHead className="text-right">Sidste uges modtaget</TableHead>
                  <TableHead className="text-right">Lukket t.o.m. i går</TableHead>
                  <TableHead className="text-right">Mangler</TableHead>
                  <TableHead className="text-right">Lukkede pr. arbejdsdag</TableHead>
                  <TableHead className="text-right">Krævet pr. arbejdsdag*</TableHead>
                  <TableHead>Status*</TableHead>
                  <TableHead>Anbefaling*</TableHead>
                  <TableHead className="text-right">Pulje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.line}>
                    <TableCell className="font-medium">{r.line}</TableCell>
                    <TableCell className="text-right">{fmt(r.receivedThisWeek)}</TableCell>
                    <TableCell className="text-right">{fmt(r.receivedLastWeek)}</TableCell>
                    <TableCell className="text-right">{fmt(r.closedToYesterday)}</TableCell>
                    <TableCell className="text-right">{fmt(r.missing)}</TableCell>
                    <TableCell className="text-right">{fmt(r.pacePerWorkday, 1)}</TableCell>
                    <TableCell className="text-right">
                      {r.status && r.requiredPerWorkday === null ? "Ugen er slut" : fmt(r.requiredPerWorkday, 1)}
                    </TableCell>
                    <TableCell>
                      {r.status ? <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge> : "–"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.status === "red" && r.shortfallPerDay !== null
                        ? `Mangler ca. ${fmt(r.shortfallPerDay)} lukninger/dag${
                            r.extraSellers !== null ? ` ≈ ${fmt(r.extraSellers, 1)} sælgere` : ""
                          }`
                        : r.status === null
                          ? "Modtaget kan ikke opgøres endnu"
                          : "–"}
                    </TableCell>
                    <TableCell className="text-right">{fmt(r.pool)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {isSuperadmin && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Modtagere af den interne mandagsmail (kun @copenhagensales.dk)</p>
            {internal.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen interne modtagere på listen.</p>
            ) : (
              internal.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={r.flow_status}
                    onCheckedChange={(v) => toggle.mutate({ id: r.id, flowStatus: v })}
                  />
                  {r.recipient_email}
                </label>
              ))
            )}
            <p className="text-xs text-muted-foreground">
              Mailen sendes kun, når siden er godkendt og slået til.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
