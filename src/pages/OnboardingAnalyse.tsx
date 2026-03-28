import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Users, TrendingDown, TrendingUp, UserCheck, UserMinus } from "lucide-react";
import { differenceInDays, parseISO, format, startOfMonth, subMonths, subDays, isAfter, isBefore, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, Legend, Cell } from "recharts";
import { Shield, Clock, BarChart3 } from "lucide-react";
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
  leftWithin30: boolean;
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

/** Shows a delta vs previous period with colored arrow */
function DeltaIndicator({ current, previous, suffix = "", invertColors = false }: {
  current: number; previous: number; suffix?: string; invertColors?: boolean;
}) {
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return <p className="text-xs text-muted-foreground mt-1.5">– ift. forrige periode</p>;
  const isPositive = delta > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <p className={`text-xs mt-1.5 flex items-center gap-1 ${isGood ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3 w-3" />
      {previous}{suffix} forrige periode
    </p>
  );
}

export default function OnboardingAnalyse() {
  const [periodKey, setPeriodKey] = useState("6m");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-analyse"],
    queryFn: async () => {
      const [empRes, histRes, tmRes, fmSalesRes] = await Promise.all([
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
        supabase
          .from("sales")
          .select("agent_name, client_campaign_id, client_campaigns:client_campaign_id(client_id, clients:client_id(name))")
          .eq("source", "fieldmarketing")
          .not("client_campaign_id", "is", null),
      ]);

      if (empRes.error) throw empRes.error;
      if (histRes.error) throw histRes.error;
      if (tmRes.error) throw tmRes.error;
      // FM sales query is best-effort
      
      // Build FM agent → primary client map (by sale count majority)
      const fmAgentClientCounts = new Map<string, Map<string, number>>();
      (fmSalesRes.data || []).forEach((s: any) => {
        const clientName = s.client_campaigns?.clients?.name;
        const agentName = s.agent_name;
        if (!clientName || !agentName) return;
        const normAgent = agentName.toLowerCase().replace(/\s+/g, " ").trim();
        if (!fmAgentClientCounts.has(normAgent)) fmAgentClientCounts.set(normAgent, new Map());
        const counts = fmAgentClientCounts.get(normAgent)!;
        counts.set(clientName, (counts.get(clientName) || 0) + 1);
      });
      const fmAgentPrimaryClient = new Map<string, string>();
      fmAgentClientCounts.forEach((counts, agent) => {
        let maxClient = "";
        let maxCount = 0;
        counts.forEach((count, client) => {
          if (count > maxCount) { maxCount = count; maxClient = client; }
        });
        if (maxClient) fmAgentPrimaryClient.set(agent, maxClient);
      });

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
        const baseTeam = fromTeamMembers
          ? normalizeTeamName(fromTeamMembers)
          : normalizeTeamName(histNameTeamMap.get(normName(empName)) || null);
        
        if (baseTeam === "Ukendt") {
          // Check if they have FM sales → assign to Fieldmarketing
          const fmClient = fmAgentPrimaryClient.get(normName(empName));
          if (fmClient) return "Fieldmarketing";
        }
        return baseTeam || "Ukendt";
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
          leftWithin30: !emp.is_active && endDate != null && differenceInDays(endDate, startDate) <= 30,
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
          leftWithin30: emp.tenure_days <= 30,
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

  // Team-wide average tenure (all employees, not just cohort)
  const teamAvgTenure = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, { sum: number; count: number }>();
    data.forEach((r) => {
      if (!map.has(r.team)) map.set(r.team, { sum: 0, count: 0 });
      const s = map.get(r.team)!;
      s.sum += r.tenureDays;
      s.count++;
    });
    const result = new Map<string, number>();
    map.forEach((v, team) => result.set(team, v.count > 0 ? Math.round(v.sum / v.count) : 0));
    return result;
  }, [data]);

  // Team stats
  const teamStats = useMemo(() => {
    const map = new Map<string, { total: number; exits30: number; exits60: number; employees: EmployeeRecord[] }>();
    filteredData.forEach((r) => {
      if (!map.has(r.team)) map.set(r.team, { total: 0, exits30: 0, exits60: 0, employees: [] });
      const s = map.get(r.team)!;
      s.total++;
      if (r.leftWithin30) s.exits30++;
      if (r.leftWithin60) s.exits60++;
      s.employees.push(r);
    });
    return Array.from(map.entries())
      .map(([team, s]) => ({
        team,
        total: s.total,
        exits30: s.exits30,
        exits60: s.exits60,
        churn30: s.total > 0 ? Math.round((s.exits30 / s.total) * 1000) / 10 : 0,
        churn60: s.total > 0 ? Math.round((s.exits60 / s.total) * 1000) / 10 : 0,
        avgTenureDays: teamAvgTenure.get(team) ?? 0,
        employees: s.employees.sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
      }))
      .sort((a, b) => b.churn60 - a.churn60);
  }, [filteredData, teamAvgTenure]);

  // Monthly churn per team (for line chart)
  const TEAM_COLORS: Record<string, string> = {
    "Fieldmarketing": "hsl(210, 70%, 50%)",
    "Eesy TM": "hsl(330, 65%, 50%)",
    "Relatel": "hsl(160, 60%, 45%)",
    "TDC Erhverv": "hsl(200, 70%, 45%)",
    "United": "hsl(20, 75%, 50%)",
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

  // Initialize selectedTeams when activeTeams changes
  const visibleTeams = useMemo(() => {
    if (selectedTeams.size === 0) return activeTeams;
    return activeTeams.filter((t) => selectedTeams.has(t));
  }, [activeTeams, selectedTeams]);

  const toggleSelectedTeam = (team: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team)) {
        next.delete(team);
      } else {
        next.add(team);
      }
      return next;
    });
  };

  // Transform data for grouped bar chart
  const barChartData = useMemo(() => {
    return monthlyTeamTrend.map((point) => {
      const entry: Record<string, any> = { label: point.label };
      visibleTeams.forEach((team) => {
        entry[team] = point[team];
        // Store cohort details for tooltip
        const monthIdx = monthlyTeamTrend.indexOf(point);
        const monthDate = [...months].reverse()[monthIdx];
        if (monthDate) {
          const end = endOfMonth(monthDate);
          const cohort = filteredData.filter(
            (r) => r.team === team && !isBefore(r.startDate, monthDate) && !isAfter(r.startDate, end)
          );
          entry[`${team}_starters`] = cohort.length;
          entry[`${team}_exits`] = cohort.filter((r) => r.leftWithin60).length;
        }
      });
      return entry;
    });
  }, [monthlyTeamTrend, visibleTeams, months, filteredData]);

  // Monthly cohorts
  const monthlyCohorts = useMemo(() => {
    return months.map((month) => {
      const end = endOfMonth(month);
      const cohort = filteredData.filter(
        (r) => !isBefore(r.startDate, month) && !isAfter(r.startDate, end)
      );
      const exits30 = cohort.filter((r) => r.leftWithin30);
      const exits60 = cohort.filter((r) => r.leftWithin60);

      // Average tenure for ALL employees active during this month
      const allActiveThisMonth = (data || []).filter((r) => {
        const started = !isAfter(r.startDate, end);
        const notYetLeft = !r.endDate || !isBefore(r.endDate, month);
        return started && notYetLeft;
      });
      const avgTenureAll = allActiveThisMonth.length > 0
        ? Math.round(allActiveThisMonth.reduce((sum, r) => {
            const tenureAtMonth = differenceInDays(end, r.startDate);
            return sum + Math.max(0, tenureAtMonth);
          }, 0) / allActiveThisMonth.length)
        : 0;

      return {
        month,
        label: format(month, "MMMM yyyy", { locale: da }),
        total: cohort.length,
        exits30: exits30.length,
        exits60: exits60.length,
        churn30: cohort.length > 0 ? Math.round((exits30.length / cohort.length) * 1000) / 10 : 0,
        churn60: cohort.length > 0 ? Math.round((exits60.length / cohort.length) * 1000) / 10 : 0,
        avgTenureDays: avgTenureAll,
        exitNames: exits60.map((e) => e.name),
        employees: cohort.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
      };
    });
  }, [months, filteredData, data]);

  // Overall KPIs
  const overallChurn60 = filteredData.length > 0
    ? Math.round((filteredData.filter((r) => r.leftWithin60).length / filteredData.length) * 1000) / 10
    : 0;
  const overallChurn30 = filteredData.length > 0
    ? Math.round((filteredData.filter((r) => r.leftWithin30).length / filteredData.length) * 1000) / 10
    : 0;
  const totalStarts = filteredData.length;
  const earlyLeavers = filteredData.filter((r) => r.leftWithin60).length;
  const totalActive = filteredData.filter((r) => r.isCurrent).length;
  const retentionRate = totalStarts > 0 ? Math.round((totalActive / totalStarts) * 1000) / 10 : 0;

  // Post-60d retention: of those who survived 60 days, how many are still active?
  const postOnboardingRetention = useMemo(() => {
    const survivors = filteredData.filter((r) => !r.leftWithin60);
    const survivorsStillActive = survivors.filter((r) => r.isCurrent);
    const stoppedAfter60 = survivors.filter((r) => !r.isCurrent);
    const rate = survivors.length > 0 ? Math.round((survivorsStillActive.length / survivors.length) * 1000) / 10 : 0;
    const avgTenureSurvivors = survivors.length > 0
      ? Math.round(survivors.reduce((sum, r) => sum + r.tenureDays, 0) / survivors.length)
      : 0;
    return { survivors: survivors.length, active: survivorsStillActive.length, stopped: stoppedAfter60.length, rate, avgTenureDays: avgTenureSurvivors };
  }, [filteredData]);

  // Previous period comparison
  const previousPeriodKPIs = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const currentCutoff = periodConfig.cutoff;
    const periodLengthMs = now.getTime() - currentCutoff.getTime();
    const prevEnd = currentCutoff;
    const prevStart = new Date(currentCutoff.getTime() - periodLengthMs);

    const prevData = data.filter(
      (r) => !isBefore(r.startDate, prevStart) && isBefore(r.startDate, prevEnd)
    );
    if (prevData.length === 0) return null;

    const prevEarlyLeavers = prevData.filter((r) => r.leftWithin60).length;
    const prevChurn60 = Math.round((prevEarlyLeavers / prevData.length) * 1000) / 10;
    const prevChurn30 = Math.round((prevData.filter((r) => r.leftWithin30).length / prevData.length) * 1000) / 10;
    const prevActive = prevData.filter((r) => r.isCurrent).length;
    const prevRetention = Math.round((prevActive / prevData.length) * 1000) / 10;

    const prevSurvivors = prevData.filter((r) => !r.leftWithin60);
    const prevSurvivorsActive = prevSurvivors.filter((r) => r.isCurrent).length;
    const prevPost60Retention = prevSurvivors.length > 0
      ? Math.round((prevSurvivorsActive / prevSurvivors.length) * 1000) / 10
      : 0;

    return {
      churn60: prevChurn60,
      churn30: prevChurn30,
      starts: prevData.length,
      earlyLeavers: prevEarlyLeavers,
      retention: prevRetention,
      post60Retention: prevPost60Retention,
    };
  }, [data, periodConfig]);

  // Tenure distribution histogram (all employees, buckets)
  const tenureDistribution = useMemo(() => {
    const buckets = [
      { label: "0-30d", min: 0, max: 30 },
      { label: "31-60d", min: 31, max: 60 },
      { label: "61-90d", min: 61, max: 90 },
      { label: "91-180d", min: 91, max: 180 },
      { label: "6-12 mdr", min: 181, max: 365 },
      { label: "1-2 år", min: 366, max: 730 },
      { label: "2+ år", min: 731, max: Infinity },
    ];
    return buckets.map((b) => {
      const inBucket = filteredData.filter((r) => r.tenureDays >= b.min && r.tenureDays <= b.max);
      return {
        label: b.label,
        aktive: inBucket.filter((r) => r.isCurrent).length,
        stoppede: inBucket.filter((r) => !r.isCurrent).length,
        total: inBucket.length,
      };
    });
  }, [filteredData]);

  // Survivor tenure trend per team (avg tenure for those who passed 60d)
  const survivorTenureTrend = useMemo(() => {
    const allTeams = new Set(filteredData.map((r) => r.team));
    return [...months].reverse().map((month) => {
      const end = endOfMonth(month);
      const label = format(month, "MMM yy", { locale: da });
      const point: Record<string, any> = { label };
      allTeams.forEach((team) => {
        const cohort = filteredData.filter(
          (r) => r.team === team && !isBefore(r.startDate, month) && !isAfter(r.startDate, end) && !r.leftWithin60
        );
        if (cohort.length > 0) {
          point[team] = Math.round(cohort.reduce((s, r) => s + r.tenureDays, 0) / cohort.length);
        } else {
          point[team] = null;
        }
      });
      return point;
    });
  }, [months, filteredData]);

  // Median tenure per monthly cohort
  const medianTenureByCohort = useMemo(() => {
    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    };
    return [...months].reverse().map((month) => {
      const end = endOfMonth(month);
      const cohort = filteredData.filter(
        (r) => !isBefore(r.startDate, month) && !isAfter(r.startDate, end)
      );
      return {
        label: format(month, "MMM yy", { locale: da }),
        median: median(cohort.map((r) => r.tenureDays)),
        count: cohort.length,
      };
    });
  }, [months, filteredData]);

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
      <MainLayout>
        <div className="container mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Onboarding Analyse</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
    <div className="container mx-auto space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> 30-dages Churn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getChurnColor(overallChurn30)}`}>{overallChurn30}%</div>
            <Badge className={`mt-1 ${getChurnBg(overallChurn30)} text-white border-0`}>{getChurnLabel(overallChurn30)}</Badge>
            {previousPeriodKPIs && <DeltaIndicator current={overallChurn30} previous={previousPeriodKPIs.churn30} suffix="%" invertColors />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> 60-dages Churn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getChurnColor(overallChurn60)}`}>{overallChurn60}%</div>
            <Badge className={`mt-1 ${getChurnBg(overallChurn60)} text-white border-0`}>{getChurnLabel(overallChurn60)}</Badge>
            {previousPeriodKPIs && <DeltaIndicator current={overallChurn60} previous={previousPeriodKPIs.churn60} suffix="%" invertColors />}
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
            {previousPeriodKPIs && <DeltaIndicator current={totalStarts} previous={previousPeriodKPIs.starts} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserMinus className="h-4 w-4" /> Stoppet ≤60 dage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{earlyLeavers}</div>
            <p className="text-xs text-muted-foreground mt-1">early leavers</p>
            {previousPeriodKPIs && <DeltaIndicator current={earlyLeavers} previous={previousPeriodKPIs.earlyLeavers} invertColors />}
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
            {previousPeriodKPIs && <DeltaIndicator current={retentionRate} previous={previousPeriodKPIs.retention} suffix="pp" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" /> Post-60d retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{postOnboardingRetention.rate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {postOnboardingRetention.active} aktive / {postOnboardingRetention.survivors} survivors
            </p>
            {postOnboardingRetention.stopped > 0 && (
              <p className="text-xs text-destructive mt-0.5">
                {postOnboardingRetention.stopped} stoppet efter 60d
              </p>
            )}
            {previousPeriodKPIs && <DeltaIndicator current={postOnboardingRetention.rate} previous={previousPeriodKPIs.post60Retention} suffix="pp" />}
          </CardContent>
        </Card>
      </div>

      {/* Team comparison grouped bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Team sammenligning – 60-dages churn % per måned</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Team filter toggles */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTeams(new Set())}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedTeams.size === 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              Alle teams
            </button>
            {activeTeams.map((team) => (
              <button
                key={team}
                onClick={() => toggleSelectedTeam(team)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  selectedTeams.size === 0 || selectedTeams.has(team)
                    ? "border-foreground/30 bg-background text-foreground"
                    : "border-border bg-muted/50 text-muted-foreground/50 hover:bg-accent"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: TEAM_COLORS[team] || "hsl(var(--foreground))" }}
                />
                {team}
                {teamStats.find((t) => t.team === team) && (
                  <span className="text-muted-foreground">
                    ({teamStats.find((t) => t.team === team)!.churn60}%)
                  </span>
                )}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={barChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg text-xs space-y-1.5">
                      <p className="font-semibold text-sm">{label}</p>
                      {payload
                        .filter((p) => p.value != null)
                        .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
                        .map((p) => {
                          const team = p.dataKey as string;
                          const starters = p.payload[`${team}_starters`] || 0;
                          const exits = p.payload[`${team}_exits`] || 0;
                          return (
                            <div key={team} className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.fill as string }} />
                              <span className="font-medium">{team}</span>
                              <span className="ml-auto font-mono tabular-nums font-semibold">{p.value}%</span>
                              <span className="text-muted-foreground">({exits}/{starters})</span>
                            </div>
                          );
                        })}
                    </div>
                  );
                }}
              />
              <ReferenceLine y={overallChurn60} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Gns. ${overallChurn60}%`, position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              {visibleTeams.map((team) => (
                <Bar
                  key={team}
                  dataKey={team}
                  name={team}
                  fill={TEAM_COLORS[team] || "hsl(var(--foreground))"}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={28}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>



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
                <TableHead className="text-right">≤30d</TableHead>
                <TableHead className="text-right">30d Churn</TableHead>
                <TableHead className="text-right">≤60d</TableHead>
                <TableHead className="text-right">60d Churn</TableHead>
                <TableHead className="text-right">Gns. anciennitet</TableHead>
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
                        <TableCell className="text-right">{t.exits30}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${getChurnColor(t.churn30)}`}>{t.churn30}%</span>
                        </TableCell>
                        <TableCell className="text-right">{t.exits60}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${getChurnColor(t.churn60)}`}>{t.churn60}%</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{t.avgTenureDays}d</TableCell>
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
                              {emp.endDate ? format(emp.endDate, "d. MMM yy", { locale: da }) : "–"}
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
                <TableHead className="text-right">≤30d</TableHead>
                <TableHead className="text-right">30d Churn</TableHead>
                <TableHead className="text-right">≤60d</TableHead>
                <TableHead className="text-right">60d Churn</TableHead>
                <TableHead className="text-right">Gns. anciennitet</TableHead>
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
                        <TableCell className="text-right">{c.exits30}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${getChurnColor(c.churn30)}`}>
                            {c.total > 0 ? `${c.churn30}%` : "–"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{c.exits60}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${getChurnColor(c.churn60)}`}>
                            {c.total > 0 ? `${c.churn60}%` : "–"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{c.avgTenureDays}d</TableCell>
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
    </MainLayout>
  );
}
