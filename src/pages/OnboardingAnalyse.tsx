import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Users, TrendingDown, UserCheck, UserMinus } from "lucide-react";
import { differenceInDays, parseISO, format, startOfMonth, subMonths, subDays, isAfter, isBefore, endOfMonth } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from "recharts";
import { da } from "date-fns/locale";

const normalizeTeamName = (name: string | null): string => {
  if (!name) return "Ukendt";
  const lower = name.toLowerCase().trim();
  if (lower.includes("eesy fm") || lower === "eesy fm") return "Fieldmarketing";
  if (lower.includes("eesy tm") || lower === "eesy tm") return "Eesy TM";
  if (lower.includes("fieldmarketing")) return "Fieldmarketing";
  if (lower.includes("relatel")) return "Relatel";
  if (lower.includes("tdc erhverv")) return "TDC Erhverv";
  if (lower.includes("united")) return "United";
  if (lower.includes("stab")) return "Stab";
  return name;
};

const EXCLUDED_TEAMS = ["Stab", "Ukendt"];

interface EmployeeRecord {
  name: string;
  team: string;
  startDate: Date;
  endDate: Date | null;
  tenureDays: number;
  isCurrent: boolean;
  leftWithin60: boolean;
}

const getChurnColor = (rate: number) => {
  if (rate <= 5) return "text-green-600";
  if (rate <= 10) return "text-emerald-600";
  if (rate <= 20) return "text-amber-600";
  return "text-red-600";
};

const getChurnBg = (rate: number) => {
  if (rate <= 5) return "bg-green-500";
  if (rate <= 10) return "bg-emerald-500";
  if (rate <= 20) return "bg-amber-500";
  return "bg-red-500";
};

const getChurnLabel = (rate: number) => {
  if (rate <= 5) return "Exceptionelt";
  if (rate <= 10) return "Sundt";
  if (rate <= 20) return "Advarsel";
  return "Rødt flag";
};

export default function OnboardingAnalyse() {
  const [periodKey, setPeriodKey] = useState("6m");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-analyse"],
    queryFn: async () => {
      const [empRes, histRes, tmRes] = await Promise.all([
        supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, employment_start_date, employment_end_date, is_active")
          .not("employment_start_date", "is", null),
        supabase
          .from("historical_employment")
          .select("id, employee_name, team_name, start_date, end_date, tenure_days"),
        supabase
          .from("team_members")
          .select("employee_id, team:teams(name)"),
      ]);

      if (empRes.error) throw empRes.error;
      if (histRes.error) throw histRes.error;
      if (tmRes.error) throw tmRes.error;

      const employeeTeamMap = new Map<string, string>();
      (tmRes.data || []).forEach((tm: any) => {
        if (tm.team?.name && !employeeTeamMap.has(tm.employee_id)) {
          employeeTeamMap.set(tm.employee_id, tm.team.name);
        }
      });

      // Build name→team fallback from historical_employment for stopped employees
      const normName = (n: string) => n.toLowerCase().replace(/\s+/g, " ").trim();
      const histNameTeamMap = new Map<string, string>();
      (histRes.data || []).forEach((h) => {
        if (h.employee_name && h.team_name) {
          histNameTeamMap.set(normName(h.employee_name), h.team_name);
        }
      });

      const resolveTeam = (empId: string, empName: string): string => {
        const fromTeamMembers = employeeTeamMap.get(empId);
        if (fromTeamMembers) return normalizeTeamName(fromTeamMembers);
        const fromHist = histNameTeamMap.get(normName(empName));
        if (fromHist) return normalizeTeamName(fromHist);
        return "Ukendt";
      };

      const today = new Date();
      const records: EmployeeRecord[] = [];

      // Current/inactive employees from master data
      (empRes.data || []).forEach((emp) => {
        const startDate = parseISO(emp.employment_start_date!);
        const endDate = emp.employment_end_date ? parseISO(emp.employment_end_date) : null;
        const tenureDays = endDate
          ? differenceInDays(endDate, startDate)
          : differenceInDays(today, startDate);
        const fullName = `${emp.first_name} ${emp.last_name}`;

        records.push({
          name: fullName,
          team: resolveTeam(emp.id, fullName),
          startDate,
          endDate,
          tenureDays: Math.max(0, tenureDays),
          isCurrent: emp.is_active ?? false,
          leftWithin60: !emp.is_active && endDate != null && differenceInDays(endDate, startDate) <= 60,
        });
      });

      // Historical employment
      (histRes.data || []).filter((e) => e.tenure_days >= 0).forEach((emp) => {
        const startDate = emp.start_date ? parseISO(emp.start_date) : null;
        const endDate = emp.end_date ? parseISO(emp.end_date) : null;

        // Skip if we already have this person from master data (match by name + similar dates)
        if (startDate) {
          const duplicate = records.find(
            (r) =>
              r.name.toLowerCase() === (emp.employee_name || "").toLowerCase() &&
              Math.abs(differenceInDays(r.startDate, startDate)) < 3
          );
          if (duplicate) return;
        }

        records.push({
          name: emp.employee_name || "Ukendt",
          team: normalizeTeamName(emp.team_name),
          startDate: startDate || today,
          endDate,
          tenureDays: emp.tenure_days,
          isCurrent: false,
          leftWithin60: emp.tenure_days <= 60,
        });
      });

      return records.filter((r) => !EXCLUDED_TEAMS.includes(r.team));
    },
  });

  const periodConfig = useMemo(() => {
    const now = new Date();
    switch (periodKey) {
      case "30d": return { label: "30 dage", cutoff: subDays(now, 30) };
      case "60d": return { label: "60 dage", cutoff: subDays(now, 60) };
      case "90d": return { label: "90 dage", cutoff: subDays(now, 90) };
      case "1m": return { label: "1 måned", cutoff: startOfMonth(now) };
      case "3m": return { label: "3 måneder", cutoff: startOfMonth(subMonths(now, 2)) };
      case "6m": return { label: "6 måneder", cutoff: startOfMonth(subMonths(now, 5)) };
      case "12m": return { label: "12 måneder", cutoff: startOfMonth(subMonths(now, 11)) };
      case "24m": return { label: "24 måneder", cutoff: startOfMonth(subMonths(now, 23)) };
      default: return { label: "6 måneder", cutoff: startOfMonth(subMonths(now, 5)) };
    }
  }, [periodKey]);

  const months = useMemo(() => {
    const result: Date[] = [];
    let current = startOfMonth(new Date());
    const earliest = startOfMonth(periodConfig.cutoff);
    while (!isBefore(current, earliest)) {
      result.push(current);
      current = startOfMonth(subMonths(current, 1));
    }
    return result;
  }, [periodConfig]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter((r) => !isBefore(r.startDate, periodConfig.cutoff));
  }, [data, periodConfig]);

  // Team stats
  const teamStats = useMemo(() => {
    const map = new Map<string, { total: number; exits: number; employees: EmployeeRecord[] }>();
    filteredData.forEach((r) => {
      if (!map.has(r.team)) map.set(r.team, { total: 0, exits: 0, employees: [] });
      const s = map.get(r.team)!;
      s.total++;
      if (r.leftWithin60) s.exits++;
      s.employees.push(r);
    });
    return Array.from(map.entries())
      .map(([team, s]) => ({
        team,
        total: s.total,
        exits: s.exits,
        churn: s.total > 0 ? Math.round((s.exits / s.total) * 1000) / 10 : 0,
        employees: s.employees.sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
      }))
      .sort((a, b) => b.churn - a.churn);
  }, [filteredData]);

  // Monthly churn per team (for line chart)
  const TEAM_COLORS: Record<string, string> = {
    "FM YouSee": "hsl(210, 70%, 50%)",
    "FM Eesy": "hsl(280, 60%, 55%)",
    "FM Øvrig": "hsl(45, 80%, 50%)",
    "Eesy TM": "hsl(330, 65%, 50%)",
    "Relatel": "hsl(160, 60%, 45%)",
    "TDC Erhverv": "hsl(200, 70%, 45%)",
    "United": "hsl(20, 75%, 50%)",
    "Eesy FM": "hsl(280, 60%, 55%)",
    "Fieldmarketing": "hsl(210, 70%, 50%)",
  };

  const monthlyTeamTrend = useMemo(() => {
    const allTeams = new Set(filteredData.map((r) => r.team));
    return [...months].reverse().map((month) => {
      const end = endOfMonth(month);
      const label = format(month, "MMM yy", { locale: da });
      const point: Record<string, any> = { label };
      allTeams.forEach((team) => {
        const cohort = filteredData.filter(
          (r) => r.team === team && !isBefore(r.startDate, month) && !isAfter(r.startDate, end)
        );
        const exits = cohort.filter((r) => r.leftWithin60).length;
        point[team] = cohort.length > 0 ? Math.round((exits / cohort.length) * 1000) / 10 : null;
      });
      return point;
    });
  }, [months, filteredData]);

  const activeTeams = useMemo(() => {
    return teamStats.map((t) => t.team);
  }, [teamStats]);

  // Monthly cohorts
  const monthlyCohorts = useMemo(() => {
    return months.map((month) => {
      const end = endOfMonth(month);
      const cohort = filteredData.filter(
        (r) => !isBefore(r.startDate, month) && !isAfter(r.startDate, end)
      );
      const exits = cohort.filter((r) => r.leftWithin60);
      return {
        month,
        label: format(month, "MMMM yyyy", { locale: da }),
        total: cohort.length,
        exits: exits.length,
        churn: cohort.length > 0 ? Math.round((exits.length / cohort.length) * 1000) / 10 : 0,
        exitNames: exits.map((e) => e.name),
        employees: cohort.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
      };
    });
  }, [months, filteredData]);

  // Overall KPIs
  const overallChurn = filteredData.length > 0
    ? Math.round((filteredData.filter((r) => r.leftWithin60).length / filteredData.length) * 1000) / 10
    : 0;
  const totalStarts = filteredData.length;
  const totalActive = filteredData.filter((r) => r.isCurrent).length;
  const retentionRate = totalStarts > 0 ? Math.round((totalActive / totalStarts) * 1000) / 10 : 0;

  const toggleTeam = (team: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(team) ? next.delete(team) : next.add(team);
      return next;
    });
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Onboarding Analyse</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Onboarding Analyse</h1>
          <p className="text-muted-foreground text-sm">60-dages churn breakdown per team og måned</p>
        </div>
        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1m">Denne måned</SelectItem>
            <SelectItem value="30d">Seneste 30 dage</SelectItem>
            <SelectItem value="60d">Seneste 60 dage</SelectItem>
            <SelectItem value="90d">Seneste 90 dage</SelectItem>
            <SelectItem value="3m">Seneste 3 mdr.</SelectItem>
            <SelectItem value="6m">Seneste 6 mdr.</SelectItem>
            <SelectItem value="12m">Seneste 12 mdr.</SelectItem>
            <SelectItem value="24m">Seneste 24 mdr.</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> 60-dages Churn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getChurnColor(overallChurn)}`}>{overallChurn}%</div>
            <Badge className={`mt-1 ${getChurnBg(overallChurn)} text-white border-0`}>{getChurnLabel(overallChurn)}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Starter i perioden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStarts}</div>
            <p className="text-xs text-muted-foreground mt-1">nye medarbejdere</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserMinus className="h-4 w-4" /> Stoppet ≤60 dage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{filteredData.filter((r) => r.leftWithin60).length}</div>
            <p className="text-xs text-muted-foreground mt-1">early leavers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Aktuel retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{retentionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{totalActive} stadig ansat</p>
          </CardContent>
        </Card>
      </div>

      {/* Team comparison line chart */}
      <Card>
        <CardHeader>
          <CardTitle>Team sammenligning – 60-dages churn % per måned</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthlyTeamTrend} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`${value}%`, ""]} />
              <Legend />
              <ReferenceLine y={overallChurn} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Gns. ${overallChurn}%`, position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              {activeTeams.map((team) => (
                <Line
                  key={team}
                  type="monotone"
                  dataKey={team}
                  name={team}
                  stroke={TEAM_COLORS[team] || "hsl(var(--foreground))"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Per-team breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Per team</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Kohorte</TableHead>
                <TableHead className="text-right">Stoppet ≤60d</TableHead>
                <TableHead className="text-right">Churn%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamStats.map((t) => (
                <Collapsible key={t.team} open={expandedTeams.has(t.team)} onOpenChange={() => toggleTeam(t.team)} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>{expandedTeams.has(t.team) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{t.team}</TableCell>
                        <TableCell className="text-right">{t.total}</TableCell>
                        <TableCell className="text-right">{t.exits}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${getChurnColor(t.churn)}`}>{t.churn}%</span>
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <>
                        {t.employees.map((emp, i) => (
                          <TableRow key={`${t.team}-${i}`} className="bg-muted/30">
                            <TableCell />
                            <TableCell className="pl-8 text-sm">
                              {emp.name}
                              {emp.leftWithin60 && (
                                <Badge variant="destructive" className="ml-2 text-xs">≤60d</Badge>
                              )}
                              {emp.isCurrent && (
                                <Badge variant="outline" className="ml-2 text-xs border-green-500 text-green-600">Aktiv</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {format(emp.startDate, "d. MMM yy", { locale: da })}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {emp.endDate ? format(emp.endDate, "d. MMM yy", { locale: da }) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {emp.tenureDays}d
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per-month cohorts */}
      <Card>
        <CardHeader>
          <CardTitle>Per måned</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Måned</TableHead>
                <TableHead className="text-right">Starter</TableHead>
                <TableHead className="text-right">Stoppet ≤60d</TableHead>
                <TableHead className="text-right">Churn%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyCohorts.map((c) => (
                <Collapsible key={c.label} open={expandedMonths.has(c.label)} onOpenChange={() => toggleMonth(c.label)} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>{expandedMonths.has(c.label) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium capitalize">{c.label}</TableCell>
                        <TableCell className="text-right">{c.total}</TableCell>
                        <TableCell className="text-right">{c.exits}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${getChurnColor(c.churn)}`}>
                            {c.total > 0 ? `${c.churn}%` : "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <>
                        {c.employees.map((emp, i) => (
                          <TableRow key={`${c.label}-${i}`} className="bg-muted/30">
                            <TableCell />
                            <TableCell className="pl-8 text-sm">
                              {emp.name}
                              {emp.leftWithin60 && (
                                <Badge variant="destructive" className="ml-2 text-xs">≤60d</Badge>
                              )}
                              {emp.isCurrent && (
                                <Badge variant="outline" className="ml-2 text-xs border-green-500 text-green-600">Aktiv</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {emp.team}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {format(emp.startDate, "d. MMM", { locale: da })}
                              {emp.endDate ? ` → ${format(emp.endDate, "d. MMM", { locale: da })}` : ""}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {emp.tenureDays}d
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
