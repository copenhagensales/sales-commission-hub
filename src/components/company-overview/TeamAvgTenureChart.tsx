import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { differenceInMonths } from "date-fns";
import { useMemo } from "react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function TeamAvgTenureChart() {
  const { data: tenureData, isLoading } = useQuery({
    queryKey: ["company-overview-team-avg-tenure"],
    queryFn: async () => {
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

    // Group by team and calculate average tenure
    const teamMap = new Map<string, { totalMonths: number; count: number }>();

    tenureData.forEach((tm: any) => {
      const teamName = tm.teams?.name || "Ukendt team";
      const employee = tm.employee_master_data;
      
      if (!employee?.is_active || !employee?.employment_start_date) return;
      
      const months = differenceInMonths(new Date(), new Date(employee.employment_start_date));
      
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, { totalMonths: 0, count: 0 });
      }
      
      const teamData = teamMap.get(teamName)!;
      teamData.totalMonths += months;
      teamData.count++;
    });

    // Convert to array with average, exclude "Stab"
    return Array.from(teamMap.entries())
      .filter(([name]) => name.toLowerCase() !== "stab")
      .map(([name, data]) => ({
        name,
        avgMonths: data.count > 0 ? Math.round(data.totalMonths / data.count) : 0,
        count: data.count,
      }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.avgMonths - a.avgMonths);
  }, [tenureData]);

  const formatMonths = (months: number) => {
    if (months < 12) return `${months} mdr`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} år`;
    return `${years} år ${remainingMonths} mdr`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gennemsnitlig anciennitet pr. team</CardTitle>
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
          <CardTitle className="text-lg">Gennemsnitlig anciennitet pr. team</CardTitle>
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
        <CardTitle className="text-lg">Gennemsnitlig anciennitet pr. team</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
          >
            <XAxis 
              type="number" 
              tickFormatter={(value) => `${value} mdr`}
            />
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
              formatter={(value: number) => [formatMonths(value), "Gns. anciennitet"]}
              cursor={{ fill: "hsl(var(--primary) / 0.2)" }}
            />
            <Bar 
              dataKey="avgMonths" 
              name="Gns. anciennitet"
              style={{ cursor: "pointer" }}
            >
              {chartData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  style={{ 
                    filter: "brightness(1)",
                    transition: "filter 0.2s ease"
                  }}
                  onMouseEnter={(e: any) => e.target.style.filter = "brightness(1.3)"}
                  onMouseLeave={(e: any) => e.target.style.filter = "brightness(1)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}