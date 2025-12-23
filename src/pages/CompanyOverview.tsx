import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, TrendingDown, Minus, Building2, Target, FileText, Clock } from "lucide-react";
import { subDays, format, differenceInMonths } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { TeamAvgTenureChart } from "@/components/company-overview/TeamAvgTenureChart";

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
      title: "KPI 4",
      value: "-",
      icon: Target,
      description: "Kommer snart",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      trend: null
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
                  <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor(kpi.trend.change)}`}>
                    {(() => {
                      const TrendIcon = getTrendIcon(kpi.trend.change);
                      return <TrendIcon className="h-4 w-4" />;
                    })()}
                    <span>
                      {kpi.trend.change > 0 ? "+" : ""}{kpi.trend.change}{kpi.trend.suffix || ""} ift. forrige periode
                    </span>
                    <span className="text-muted-foreground ml-1">
                      ({kpi.trend.percentage > 0 ? "+" : ""}{kpi.trend.percentage.toFixed(0)}%)
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Team Tenure Chart */}
        <TeamAvgTenureChart />
      </div>
    </MainLayout>
  );
}