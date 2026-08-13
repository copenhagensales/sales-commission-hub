import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Clock, Download, FileWarning, RefreshCw, Search, Send, Ban } from "lucide-react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { downloadExcel } from "@/utils/excel";
import {
  useContractCompliance,
  COMPLIANCE_LABELS,
  type ComplianceState,
  type ContractComplianceRow,
} from "@/hooks/useContractCompliance";

const STATE_ORDER: ComplianceState[] = ["missing", "started_unsigned", "rejected", "pending", "ok"];

const stateBadge = (state: ComplianceState) => {
  switch (state) {
    case "missing":
      return <Badge variant="destructive">{COMPLIANCE_LABELS.missing}</Badge>;
    case "started_unsigned":
      return <Badge className="bg-orange-500 hover:bg-orange-500/90 text-white">{COMPLIANCE_LABELS.started_unsigned}</Badge>;
    case "rejected":
      return <Badge variant="destructive">{COMPLIANCE_LABELS.rejected}</Badge>;
    case "pending":
      return <Badge className="bg-amber-500 hover:bg-amber-500/90 text-white">{COMPLIANCE_LABELS.pending}</Badge>;
    default:
      return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white">{COMPLIANCE_LABELS.ok}</Badge>;
  }
};

const fmtDate = (value: string | null) => {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd. MMM yyyy", { locale: da });
  } catch {
    return "—";
  }
};

export function ContractComplianceTab() {
  const { rows, counts, isLoading, isError, refetch } = useContractCompliance();
  const [stateFilter, setStateFilter] = useState<"all" | "action" | ComplianceState>("action");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const teams = useMemo(
    () => Array.from(new Set(rows.map((r) => r.team_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "da")),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (stateFilter === "action") {
          if (r.compliance_state === "ok") return false;
        } else if (stateFilter !== "all" && r.compliance_state !== stateFilter) {
          return false;
        }
        if (teamFilter !== "all" && (r.team_name ?? "Uden team") !== teamFilter) return false;
        if (term) {
          const name = `${r.first_name} ${r.last_name}`.toLowerCase();
          if (!name.includes(term) && !(r.job_title ?? "").toLowerCase().includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const byState = STATE_ORDER.indexOf(a.compliance_state) - STATE_ORDER.indexOf(b.compliance_state);
        if (byState !== 0) return byState;
        return a.employment_start_date.localeCompare(b.employment_start_date);
      });
  }, [rows, stateFilter, teamFilter, search]);

  const daysSinceStart = (row: ContractComplianceRow) =>
    differenceInCalendarDays(new Date(), parseISO(row.employment_start_date));

  const handleExport = async () => {
    if (filtered.length === 0) {
      toast.error("Der er ingen rækker at eksportere");
      return;
    }
    try {
      await downloadExcel(`kontrakt-overvaagning-${format(new Date(), "yyyy-MM-dd")}.xlsx`, [
        {
          name: "Overvågning",
          rows: filtered.map((r) => ({
            Navn: `${r.first_name} ${r.last_name}`,
            Stilling: r.job_title ?? "",
            Team: r.team_name ?? "Uden team",
            Opstartsdato: r.employment_start_date,
            "Dage siden opstart": daysSinceStart(r),
            Status: COMPLIANCE_LABELS[r.compliance_state],
            Kontrakt: r.contract_title ?? "",
            Sendt: r.sent_at ? format(parseISO(r.sent_at), "yyyy-MM-dd") : "",
            "Påmindelser sendt": r.reminder_count,
            "Seneste påmindelse": r.last_reminder_at ? format(parseISO(r.last_reminder_at), "yyyy-MM-dd") : "",
          })),
        },
      ]);
      toast.success("Excel-fil hentet");
    } catch (e) {
      toast.error("Kunne ikke oprette Excel-filen");
    }
  };

  const kpis = [
    { key: "missing" as ComplianceState, value: counts.missing, icon: FileWarning, tone: "text-destructive", bg: "bg-destructive/10" },
    { key: "started_unsigned" as ComplianceState, value: counts.started_unsigned, icon: AlertTriangle, tone: "text-orange-600", bg: "bg-orange-100" },
    { key: "pending" as ComplianceState, value: counts.pending, icon: Clock, tone: "text-amber-600", bg: "bg-amber-100" },
    { key: "ok" as ComplianceState, value: counts.ok, icon: CheckCircle2, tone: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Overvågningen kunne ikke indlæses. Prøv igen — der er ikke ændret noget i systemet.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Prøv igen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map(({ key, value, icon: Icon, tone, bg }) => (
          <Card
            key={key}
            className={`cursor-pointer transition-colors ${stateFilter === key ? "border-primary" : ""}`}
            onClick={() => setStateFilter(key)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${bg}`}>
                  <Icon className={`h-6 w-6 ${tone}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "—" : value}</p>
                  <p className="text-sm text-muted-foreground">{COMPLIANCE_LABELS[key]}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {counts.rejected > 0 && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center gap-3">
            <Ban className="h-5 w-5 text-destructive" />
            <p className="text-sm">
              {counts.rejected} medarbejder{counts.rejected === 1 ? "" : "e"} har afvist sin kontrakt og er spærret fra
              systemet, indtil en ny kontrakt sendes.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg navn eller stilling..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as typeof stateFilter)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="action">Kræver handling</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
            {STATE_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {COMPLIANCE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle teams</SelectItem>
            <SelectItem value="Uden team">Uden team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" /> Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Opdater
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Opstart</TableHead>
                <TableHead className="text-right">Dage siden opstart</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sendt</TableHead>
                <TableHead className="text-right">Påmindelser</TableHead>
                <TableHead>Seneste påmindelse</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Indlæser...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Ingen medarbejdere matcher filtrene.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const days = daysSinceStart(r);
                  return (
                    <TableRow key={r.employee_id}>
                      <TableCell className="font-medium">
                        {r.first_name} {r.last_name}
                        {r.job_title && <span className="block text-xs text-muted-foreground">{r.job_title}</span>}
                      </TableCell>
                      <TableCell>{r.team_name ?? "Uden team"}</TableCell>
                      <TableCell>{fmtDate(r.employment_start_date)}</TableCell>
                      <TableCell className="text-right">
                        {days >= 0 ? days : `starter om ${Math.abs(days)}`}
                      </TableCell>
                      <TableCell>{stateBadge(r.compliance_state)}</TableCell>
                      <TableCell>{fmtDate(r.sent_at)}</TableCell>
                      <TableCell className="text-right">{r.reminder_count}</TableCell>
                      <TableCell>{fmtDate(r.last_reminder_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/employees/${r.employee_id}`}>
                            <Send className="h-4 w-4 mr-2" />
                            {r.compliance_state === "ok" ? "Åbn profil" : "Send kontrakt"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
