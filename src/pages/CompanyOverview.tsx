import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, TrendingDown, Minus, FileText, Clock, UserMinus } from "lucide-react";
import { subDays, subMonths, format, differenceInMonths, differenceInDays } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { TeamAvgTenureChart } from "@/components/company-overview/TeamAvgTenureChart";
import { NewHireChurnKpi } from "@/components/company-overview/NewHireChurnKpi";
import { HistoricalTenureStats } from "@/components/company-overview/HistoricalTenureStats";
export default function CompanyOverview() {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  const sixtyDaysAgo = subDays(today, 60);
  const thirtyDaysAgoStr = format(thirtyDaysAgo, "yyyy-MM-dd");
  const sixtyDaysAgoStr = format(sixtyDaysAgo, "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");

  // Fetch employee counts with 30-day comparison
  const { data: employeeStats, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["company-overview-employee-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("employee_id, created_at");
      
      if (error) throw error;
      
      const currentUniqueIds = new Set(data.map(tm => tm.employee_id));
      const currentCount = currentUniqueIds.size;
      
      const employeesThirtyDaysAgo = data.filter(tm => 
        tm.created_at && tm.created_at < thirtyDaysAgoStr
      );
      const countThirtyDaysAgo = new Set(employeesThirtyDaysAgo.map(tm => tm.employee_id)).size;
      
      const employeesSixtyDaysAgo = data.filter(tm => 
        tm.created_at && tm.created_at < sixtyDaysAgoStr
      );
      const countSixtyDaysAgo = new Set(employeesSixtyDaysAgo.map(tm => tm.employee_id)).size;
      
      const changeLastThirtyDays = currentCount - countThirtyDaysAgo;
      const changePreviousThirtyDays = countThirtyDaysAgo - countSixtyDaysAgo;
      
      let percentageChange = 0;
      if (changePreviousThirtyDays !== 0) {
        percentageChange = ((changeLastThirtyDays - changePreviousThirtyDays) / Math.abs(changePreviousThirtyDays)) * 100;
      } else if (changeLastThirtyDays !== 0) {
        percentageChange = changeLastThirtyDays > 0 ? 100 : -100;
      }
      
      return { currentCount, changeLastThirtyDays, percentageChange };
    },
  });

  // Fetch candidate/application counts with 30-day comparison (matching recruitment dashboard logic)
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
      
      // Candidates in the last 30 days
      const last30d = data.filter(c => {
        const created = new Date(c.created_at);
        return created >= thirtyDaysAgoDate;
      }).length;
      
      // Candidates in the previous 30 days (30-60 days ago)
      const prev30d = data.filter(c => {
        const created = new Date(c.created_at);
        return created >= sixtyDaysAgoDate && created < thirtyDaysAgoDate;
      }).length;
      
      console.log("Candidate stats:", { total: data.length, last30d, prev30d, thirtyDaysAgoDate });
      
      // Calculate percentage change
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

  // Fetch average tenure for all employees (excluding Stab)
  const { data: tenureStats, isLoading: isLoadingTenure } = useQuery({
    queryKey: ["company-overview-tenure-stats"],
    queryFn: async () => {
      const { data: teamMembers, error } = await supabase
        .from("team_members")
        .select(`
          employee_id,
          teams(name),
          employee_master_data(employment_start_date, is_active)
        `);
      
      if (error) throw error;
      
      // Filter active employees not in "Stab" team, get unique by employee_id
      const uniqueEmployees = new Map<string, { startDate: string }>();
      
      teamMembers.forEach((tm: any) => {
        const teamName = tm.teams?.name?.toLowerCase() || "";
        const employee = tm.employee_master_data;
        
        if (teamName === "stab" || !employee?.is_active || !employee?.employment_start_date) return;
        
        // Keep earliest start date for employees in multiple teams
        if (!uniqueEmployees.has(tm.employee_id) || 
            employee.employment_start_date < uniqueEmployees.get(tm.employee_id)!.startDate) {
          uniqueEmployees.set(tm.employee_id, { startDate: employee.employment_start_date });
        }
      });
      
      // Calculate current average tenure in months
      const now = new Date();
      const thirtyDaysAgoDate = subDays(now, 30);
      
      let totalMonthsNow = 0;
      let totalMonthsThirtyDaysAgo = 0;
      let countNow = 0;
      let countThirtyDaysAgo = 0;
      
      uniqueEmployees.forEach(({ startDate }) => {
        const start = new Date(startDate);
        
        // Current average
        const monthsNow = differenceInMonths(now, start);
        totalMonthsNow += monthsNow;
        countNow++;
        
        // 30 days ago - only count employees who were employed then
        if (start <= thirtyDaysAgoDate) {
          const monthsThirtyDaysAgo = differenceInMonths(thirtyDaysAgoDate, start);
          totalMonthsThirtyDaysAgo += monthsThirtyDaysAgo;
          countThirtyDaysAgo++;
        }
      });
      
      const avgMonthsNow = countNow > 0 ? totalMonthsNow / countNow : 0;
      const avgMonthsThirtyDaysAgo = countThirtyDaysAgo > 0 ? totalMonthsThirtyDaysAgo / countThirtyDaysAgo : 0;
      
      const changeMonths = avgMonthsNow - avgMonthsThirtyDaysAgo;
      
      let percentageChange = 0;
      if (avgMonthsThirtyDaysAgo !== 0) {
        percentageChange = ((avgMonthsNow - avgMonthsThirtyDaysAgo) / avgMonthsThirtyDaysAgo) * 100;
      }
      
      return { avgMonths: Math.round(avgMonthsNow * 10) / 10, changeMonths: Math.round(changeMonths * 10) / 10, percentageChange };
    },
  });

  // Fetch 60-day new-hire churn (overall)
  const { data: churnStats, isLoading: isLoadingChurn } = useQuery({
    queryKey: ["company-overview-churn-stats"],
    queryFn: async () => {
      const now = new Date();
      const twelveMonthsAgo = subMonths(now, 12);
      const sixMonthsAgo = subMonths(now, 6);

      const { data: employees, error } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date, employment_end_date, is_active, is_staff_employee, team_id, teams:team_id(name)")
        .gte("employment_start_date", format(twelveMonthsAgo, "yyyy-MM-dd"));

      if (error) throw error;

      // Filter: exclude Stab employees
      const relevantEmployees = employees?.filter(e => {
        const teamName = (e.teams as any)?.name?.toLowerCase() || "";
        return teamName !== "stab" && !e.is_staff_employee;
      }) || [];

      // Current period (rolling 12 months)
      const currentPeriodHires = relevantEmployees;
      const currentPeriodExits = currentPeriodHires.filter(e => {
        if (!e.employment_end_date || !e.employment_start_date) return false;
        const startDate = new Date(e.employment_start_date);
        const endDate = new Date(e.employment_end_date);
        const daysEmployed = differenceInDays(endDate, startDate);
        return daysEmployed <= 60;
      });

      // Previous period (6-12 months ago)
      const previousPeriodHires = relevantEmployees.filter(e => {
        const startDate = new Date(e.employment_start_date!);
        return startDate >= twelveMonthsAgo && startDate < sixMonthsAgo;
      });
      const previousPeriodExits = previousPeriodHires.filter(e => {
        if (!e.employment_end_date || !e.employment_start_date) return false;
        const startDate = new Date(e.employment_start_date);
        const endDate = new Date(e.employment_end_date);
        const daysEmployed = differenceInDays(endDate, startDate);
        return daysEmployed <= 60;
      });

      const overallChurn = currentPeriodHires.length > 0 
        ? (currentPeriodExits.length / currentPeriodHires.length) * 100 
        : 0;
      
      const previousPeriodChurn = previousPeriodHires.length > 0 
        ? (previousPeriodExits.length / previousPeriodHires.length) * 100 
        : 0;

      const trend = overallChurn - previousPeriodChurn;

      return { 
        churnRate: Math.round(overallChurn * 10) / 10, 
        trend: Math.round(trend * 10) / 10,
        totalHires: currentPeriodHires.length,
        totalExits: currentPeriodExits.length
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

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  // For churn, lower is better, so inverted colors
  const getChurnTrendColor = (change: number) => {
    if (change > 0) return "text-red-600"; // Increase in churn is bad
    if (change < 0) return "text-green-600"; // Decrease in churn is good
    return "text-muted-foreground";
  };

  const kpiCards = [
    {
      title: "Antal medarbejdere",
      value: isLoadingEmployees ? "..." : employeeStats?.currentCount ?? 0,
      icon: Users,
      description: "Unikke medarbejdere på tværs af teams",
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: employeeStats ? {
        change: employeeStats.changeLastThirtyDays,
        percentage: employeeStats.percentageChange
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
      description: "Gennemsnitlig anciennitet (ekskl. Stab)",
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: tenureStats ? {
        change: tenureStats.changeMonths,
        percentage: tenureStats.percentageChange,
        suffix: " mdr"
      } : null
    },
    {
      title: "60-dages Churn",
      value: isLoadingChurn ? "..." : churnStats ? `${churnStats.churnRate}%` : "-",
      icon: UserMinus,
      description: "New-hire churn (rolling 12 mdr)",
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: churnStats ? {
        change: churnStats.trend,
        percentage: 0, // Not showing percentage for this KPI
        suffix: " pp",
        invertColors: true // For churn, lower is better
      } : null
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Virksomhedsoverblik</h1>
          <p className="text-muted-foreground">Overblik over virksomhedens nøgletal</p>
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
                  <div className={`flex items-center gap-1 mt-2 text-sm ${kpi.trend.invertColors ? getChurnTrendColor(kpi.trend.change) : getTrendColor(kpi.trend.change)}`}>
                    {(() => {
                      const TrendIcon = getTrendIcon(kpi.trend.change);
                      return <TrendIcon className="h-4 w-4" />;
                    })()}
                    <span>
                      {kpi.trend.change > 0 ? "+" : ""}{kpi.trend.change}{kpi.trend.suffix || ""} ift. forrige periode
                    </span>
                    {kpi.trend.percentage !== 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({kpi.trend.percentage > 0 ? "+" : ""}{kpi.trend.percentage.toFixed(0)}%)
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