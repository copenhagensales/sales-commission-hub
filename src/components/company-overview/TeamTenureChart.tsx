import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { differenceInMonths } from "date-fns";
import { useMemo } from "react";

const TENURE_BUCKETS = [
  { key: "under3", label: "<3 mdr", color: "hsl(var(--chart-1))" },
  { key: "3to6", label: "3-6 mdr", color: "hsl(var(--chart-2))" },
  { key: "6to12", label: "6-12 mdr", color: "hsl(var(--chart-3))" },
  { key: "1to2", label: "1-2 år", color: "hsl(var(--chart-4))" },
  { key: "over2", label: "2+ år", color: "hsl(var(--chart-5))" },
];

function getTenureBucket(employmentStartDate: string | null): string {
  if (!employmentStartDate) return "under3";
  
  const months = differenceInMonths(new Date(), new Date(employmentStartDate));
  
  if (months < 3) return "under3";
  if (months < 6) return "3to6";
  if (months < 12) return "6to12";
  if (months < 24) return "1to2";
  return "over2";
}

export function TeamTenureChart() {
  const { data: tenureData, isLoading } = useQuery({
    queryKey: ["company-overview-team-tenure"],
    queryFn: async () => {
      // Get team members with their employee data and team names
      const { data: teamMembers, error } = await supabase
        .from("team_members")
        .select(`
          employee_id,
          team_id,
          teams(name),
          employee_master_data(employment_start_date, is_active)
        `);
      
      if (error) throw error;
      
      return teamMembers;
    },
  });

  const chartData = useMemo(() => {
    if (!tenureData) return [];

    // Group by team and count tenure buckets
    const teamMap = new Map<string, { name: string; under3: number; "3to6": number; "6to12": number; "1to2": number; over2: number; total: number }>();

    tenureData.forEach((tm: any) => {
      const teamName = tm.teams?.name || "Ukendt team";
      const employee = tm.employee_master_data;
      
      // Only count active employees
      if (!employee?.is_active) return;
      
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, {
          name: teamName,
          under3: 0,
          "3to6": 0,
          "6to12": 0,
          "1to2": 0,
          over2: 0,
          total: 0,
        });
      }
      
      const bucket = getTenureBucket(employee.employment_start_date);
      const teamData = teamMap.get(teamName)!;
      teamData[bucket as keyof typeof teamData]++;
      teamData.total++;
    });

    // Convert to array and sort by total employees
    return Array.from(teamMap.values())
      .filter(t => t.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [tenureData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Anciennitet fordelt på teams</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Anciennitet fordelt på teams</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Ingen data tilgængelig</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Anciennitet fordelt på teams</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
          >
            <XAxis type="number" />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={90}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px"
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend />
            {TENURE_BUCKETS.map((bucket) => (
              <Bar
                key={bucket.key}
                dataKey={bucket.key}
                name={bucket.label}
                stackId="tenure"
                fill={bucket.color}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}