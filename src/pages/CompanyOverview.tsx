import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, TrendingDown, Minus, FileText, Clock, UserMinus } from "lucide-react";
import { subDays, format, differenceInDays, parseISO } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { TeamAvgTenureChart } from "@/components/company-overview/TeamAvgTenureChart";
import { NewHireChurnKpi } from "@/components/company-overview/NewHireChurnKpi";
import { HistoricalTenureStats } from "@/components/company-overview/HistoricalTenureStats";

// Normalize team names to handle variations
const normalizeTeamName = (name: string | null): string => {
  if (!name) return "Ukendt";
  const lower = name.toLowerCase().trim();
  if (lower.includes("eesy fm") || lower === "eesy fm") return "Eesy FM";
  if (lower.includes("eesy tm") || lower === "eesy tm") return "Eesy TM";
  if (lower.includes("fieldmarketing")) return "Fieldmarketing";
  if (lower.includes("relatel")) return "Relatel";
  if (lower.includes("tdc erhverv")) return "TDC Erhverv";
  if (lower.includes("united")) return "United";
  if (lower.includes("stab")) return "Stab";
  return name;
};

// Teams to exclude
const EXCLUDED_TEAMS = ["Stab", "Ukendt"];

export default function CompanyOverview() {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  const sixtyDaysAgo = subDays(today, 60);
  const thirtyDaysAgoStr = format(thirtyDaysAgo, "yyyy-MM-dd");
  const sixtyDaysAgoStr = format(sixtyDaysAgo, "yyyy-MM-dd");

  // Fetch current employee stats with 30-day comparison for growth trend
  const { data: employeeStats, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["company-overview-employee-growth-stats"],
    queryFn: async () => {
      // Current employees from team_members
      const { data: teamMembers, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;
      
      // Count unique current employees (including Stab, only excluding Ukendt)
      const currentEmployees = new Set<string>();
      (teamMembers || []).forEach(tm => {
        const teamName = normalizeTeamName((tm.team as any)?.name || null);
        if (teamName !== "Ukendt") {
          currentEmployees.add(tm.employee_id);
        }
      });
      
      const currentCount = currentEmployees.size;
      
      // Get employees who left in the last 30 days (from historical_employment)
      const thirtyDaysAgoDate = subDays(today, 30);
      const sixtyDaysAgoDate = subDays(today, 60);
      
      const { data: historicalData, error: histError } = await supabase
        .from("historical_employment")
        .select("id, team_name, end_date");
      if (histError) throw histError;
      
      // Get employees hired in last 30 days
      const { data: recentHires, error: hiresError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date")
        .eq("is_active", true)
        .gte("employment_start_date", format(thirtyDaysAgoDate, "yyyy-MM-dd"));
      if (hiresError) throw hiresError;
      
      // Get employees hired 30-60 days ago
      const { data: prevHires, error: prevHiresError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date")
        .eq("is_active", true)
        .gte("employment_start_date", format(sixtyDaysAgoDate, "yyyy-MM-dd"))
        .lt("employment_start_date", format(thirtyDaysAgoDate, "yyyy-MM-dd"));
      if (prevHiresError) throw prevHiresError;
      
      // Count leavers in last 30 days
      const leaversLast30 = (historicalData || []).filter(emp => {
        const teamName = normalizeTeamName(emp.team_name);
        if (EXCLUDED_TEAMS.includes(teamName)) return false;
        if (!emp.end_date) return false;
        const endDate = parseISO(emp.end_date);
        return endDate >= thirtyDaysAgoDate;
      }).length;
      
      // Count leavers 30-60 days ago
      const leavers30to60 = (historicalData || []).filter(emp => {
        const teamName = normalizeTeamName(emp.team_name);
        if (EXCLUDED_TEAMS.includes(teamName)) return false;
        if (!emp.end_date) return false;
        const endDate = parseISO(emp.end_date);
        return endDate >= sixtyDaysAgoDate && endDate < thirtyDaysAgoDate;
      }).length;
      
      // Net change in last 30 days = hires - leavers
      const hiresLast30 = (recentHires || []).length;
      const hiresPrev30 = (prevHires || []).length;
      
      const netChangeLast30 = hiresLast30 - leaversLast30;
      const netChangePrev30 = hiresPrev30 - leavers30to60;
      
      return { 
        currentCount, 
        netChange: netChangeLast30,
        prevNetChange: netChangePrev30,
        hiresLast30,
        leaversLast30
      };
    },
  });

  // Fetch candidate/application counts with 30-day comparison
  const { data: applicationStats, isLoading: isLoadingApplications } = useQuery({
    queryKey: ["company-overview-candidate-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, created_at");
      
      if (error) throw error;
      
      const now = new Date();
      const thirtyDaysAgoDate = subDays(now, 30);
      const sixtyDaysAgoDate = subDays(now, 60);
      
      const last30d = data.filter(c => {
        const created = new Date(c.created_at);
        return created >= thirtyDaysAgoDate;
      }).length;
      
      const prev30d = data.filter(c => {
        const created = new Date(c.created_at);
        return created >= sixtyDaysAgoDate && created < thirtyDaysAgoDate;
      }).length;
      
      let percentageChange = 0;
      if (prev30d !== 0) {
        percentageChange = ((last30d - prev30d) / prev30d) * 100;
      } else if (last30d !== 0) {
        percentageChange = 100;
      }
      
      const change = last30d - prev30d;
      
      return { currentCount: last30d, change, percentageChange };
    },
  });

  // Fetch average tenure for all employees (current + historical) with trend
  const { data: tenureStats, isLoading: isLoadingTenure } = useQuery({
    queryKey: ["company-overview-combined-tenure-stats"],
    queryFn: async () => {
      // Current employees
      const { data: employees, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date")
        .eq("is_active", true)
        .not("employment_start_date", "is", null);
      if (empError) throw empError;
      
      // Team memberships
      const { data: teamMemberships, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;
      
      // Historical employees with end_date for trend calculation
      const { data: historicalData, error: histError } = await supabase
        .from("historical_employment")
        .select("id, team_name, tenure_days, end_date");
      if (histError) throw histError;
      
      // Map employee_id to team name
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name && !employeeTeamMap.has(tm.employee_id)) {
          employeeTeamMap.set(tm.employee_id, tm.team.name);
        }
      });
      
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      let totalDays = 0;
      let count = 0;
      
      // Current employees tenure
      (employees || []).forEach(emp => {
        const teamName = normalizeTeamName(employeeTeamMap.get(emp.id) || null);
        if (EXCLUDED_TEAMS.includes(teamName)) return;
        
        const startDate = emp.employment_start_date ? parseISO(emp.employment_start_date) : now;
        const tenureDays = differenceInDays(now, startDate);
        totalDays += Math.max(0, tenureDays);
        count++;
      });
      
      // Historical employees tenure
      (historicalData || []).forEach(emp => {
        const teamName = normalizeTeamName(emp.team_name);
        if (EXCLUDED_TEAMS.includes(teamName)) return;
        
        totalDays += emp.tenure_days;
        count++;
      });
      
      const avgDays = count > 0 ? totalDays / count : 0;
      const avgMonths = avgDays / 30;
      
      // Calculate what avg tenure was 30 days ago (exclude employees who left in last 30 days)
      let prevTotalDays = 0;
      let prevCount = 0;
      
      (employees || []).forEach(emp => {
        const teamName = normalizeTeamName(employeeTeamMap.get(emp.id) || null);
        if (EXCLUDED_TEAMS.includes(teamName)) return;
        
        const startDate = emp.employment_start_date ? parseISO(emp.employment_start_date) : now;
        // Only count if they were employed 30 days ago
        if (startDate <= thirtyDaysAgo) {
          const tenureDays = differenceInDays(thirtyDaysAgo, startDate);
          prevTotalDays += Math.max(0, tenureDays);
          prevCount++;
        }
      });
      
      (historicalData || []).forEach(emp => {
        const teamName = normalizeTeamName(emp.team_name);
        if (EXCLUDED_TEAMS.includes(teamName)) return;
        
        // Include historical employees who were still employed 30 days ago
        const endDate = emp.end_date ? parseISO(emp.end_date) : null;
        if (!endDate || endDate > thirtyDaysAgo) {
          prevTotalDays += Math.max(0, emp.tenure_days - 30);
          prevCount++;
        }
      });
      
      const prevAvgDays = prevCount > 0 ? prevTotalDays / prevCount : 0;
      const prevAvgMonths = prevAvgDays / 30;
      
      const monthsChange = avgMonths - prevAvgMonths;
      const percentageChange = prevAvgMonths > 0 ? ((avgMonths - prevAvgMonths) / prevAvgMonths) * 100 : 0;
      
      return { 
        avgMonths: Math.round(avgMonths * 10) / 10, 
        totalCount: count,
        monthsChange: Math.round(monthsChange * 10) / 10,
        percentageChange: Math.round(percentageChange * 10) / 10
      };
    },
  });

  // Fetch 60-day churn (combined) with trend
  const { data: churnStats, isLoading: isLoadingChurn } = useQuery({
    queryKey: ["company-overview-combined-churn-stats"],
    queryFn: async () => {
      // Current employees
      const { data: employees, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date")
        .eq("is_active", true)
        .not("employment_start_date", "is", null);
      if (empError) throw empError;
      
      // Team memberships
      const { data: teamMemberships, error: tmError } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      if (tmError) throw tmError;
      
      // Historical employees with end_date
      const { data: historicalData, error: histError } = await supabase
        .from("historical_employment")
        .select("id, team_name, tenure_days, end_date");
      if (histError) throw histError;
      
      // Map employee_id to team name
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name && !employeeTeamMap.has(tm.employee_id)) {
          employeeTeamMap.set(tm.employee_id, tm.team.name);
        }
      });
      
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      
      let totalCount = 0;
      let exits60Days = 0;
      let prevTotalCount = 0;
      let prevExits60Days = 0;
      
      // Current employees (none have left within 60 days since they're still active)
      (employees || []).forEach(emp => {
        const teamName = normalizeTeamName(employeeTeamMap.get(emp.id) || null);
        if (EXCLUDED_TEAMS.includes(teamName)) return;
        totalCount++;
        
        // For prev calculation, only count if hired before 30 days ago
        const startDate = emp.employment_start_date ? parseISO(emp.employment_start_date) : now;
        if (startDate <= thirtyDaysAgo) {
          prevTotalCount++;
        }
      });
      
      // Historical employees
      (historicalData || []).forEach(emp => {
        const teamName = normalizeTeamName(emp.team_name);
        if (EXCLUDED_TEAMS.includes(teamName)) return;
        
        totalCount++;
        if (emp.tenure_days <= 60) {
          exits60Days++;
        }
        
        // For prev calculation - employees who left before 30 days ago
        const endDate = emp.end_date ? parseISO(emp.end_date) : null;
        if (endDate && endDate <= thirtyDaysAgo) {
          prevTotalCount++;
          if (emp.tenure_days <= 60) {
            prevExits60Days++;
          }
        }
      });
      
      const churnRate = totalCount > 0 ? (exits60Days / totalCount) * 100 : 0;
      const prevChurnRate = prevTotalCount > 0 ? (prevExits60Days / prevTotalCount) * 100 : 0;
      
      const churnChange = churnRate - prevChurnRate;
      
      return { 
        churnRate: Math.round(churnRate * 10) / 10, 
        totalCount,
        exits60Days,
        churnChange: Math.round(churnChange * 10) / 10
      };
    },
  });

  const formatTenure = (months: number) => {
    if (months < 12) return `${months.toFixed(1)} mdr`;
    const years = Math.floor(months / 12);
    const remainingMonths = Math.round(months % 12);
    if (remainingMonths === 0) return `${years} år`;
    return `${years} år ${remainingMonths} mdr`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return TrendingUp;
    if (change < 0) return TrendingDown;
    return Minus;
  };

  const getTrendColor = (change: number, invertColors = false) => {
    if (invertColors) {
      // For metrics where lower is better (like churn)
      if (change > 0) return "text-red-600";
      if (change < 0) return "text-green-600";
    } else {
      if (change > 0) return "text-green-600";
      if (change < 0) return "text-red-600";
    }
    return "text-muted-foreground";
  };

  const kpiCards = [
    {
      title: "Nuværende ansatte",
      value: isLoadingEmployees ? "..." : employeeStats?.currentCount ?? 0,
      icon: Users,
      description: employeeStats ? `${employeeStats.hiresLast30} ansat, ${employeeStats.leaversLast30} stoppet (30 dage)` : "Indlæser...",
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: employeeStats ? {
        change: employeeStats.netChange,
        // Percentage change relative to total current employees
        percentage: employeeStats.currentCount > 0 
          ? (employeeStats.netChange / employeeStats.currentCount) * 100
          : 0
      } : null
    },
    {
      title: "Ansøgninger",
      value: isLoadingApplications ? "..." : applicationStats?.currentCount ?? 0,
      icon: FileText,
      description: "Ansøgninger de sidste 30 dage",
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: applicationStats ? {
        change: applicationStats.change,
        percentage: applicationStats.percentageChange
      } : null
    },
    {
      title: "Gns. anciennitet",
      value: isLoadingTenure ? "..." : tenureStats ? formatTenure(tenureStats.avgMonths) : "-",
      icon: Clock,
      description: `Baseret på ${tenureStats?.totalCount ?? 0} ansatte (ekskl. Stab)`,
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: tenureStats ? {
        change: tenureStats.monthsChange,
        percentage: null, // Don't show percentage for tenure - months change is more meaningful
        unit: "mdr"
      } : null
    },
    {
      title: "60-dages Churn",
      value: isLoadingChurn ? "..." : churnStats ? `${churnStats.churnRate}%` : "-",
      icon: UserMinus,
      description: `${churnStats?.exits60Days ?? 0} af ${churnStats?.totalCount ?? 0} stoppede inden 60 dage`,
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: churnStats ? {
        change: churnStats.churnChange,
        percentage: churnStats.churnChange,
        invertColors: true // For churn, lower is better
      } : null
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Virksomhedsoverblik</h1>
          <p className="text-muted-foreground">Overblik over virksomhedens nøgletal (nuværende + historiske ansatte)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi, index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={`h-8 w-8 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{kpi.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                {kpi.trend && (
                  <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor(kpi.trend.change, kpi.trend.invertColors)}`}>
                    {(() => {
                      const TrendIcon = getTrendIcon(kpi.trend.change);
                      return <TrendIcon className="h-4 w-4" />;
                    })()}
                    <span>
                      {kpi.trend.change > 0 ? "+" : ""}{kpi.trend.change.toFixed(1)}{kpi.trend.unit ? ` ${kpi.trend.unit}` : ""} ift. forrige 30 dage
                    </span>
                    {kpi.trend.percentage !== null && kpi.trend.percentage !== 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({kpi.trend.percentage > 0 ? "+" : ""}{kpi.trend.percentage.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts and detailed KPIs */}
        <div className="space-y-6">
          <TeamAvgTenureChart />
          <NewHireChurnKpi />
          <HistoricalTenureStats />
        </div>
      </div>
    </MainLayout>
  );
}
