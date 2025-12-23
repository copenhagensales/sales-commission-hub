import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Building2, Target } from "lucide-react";

export default function CompanyOverview() {
  // Fetch unique employee count from team_members
  const { data: uniqueEmployeeCount = 0, isLoading } = useQuery({
    queryKey: ["company-overview-employee-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("employee_id");
      
      if (error) throw error;
      
      // Count unique employee IDs
      const uniqueIds = new Set(data.map(tm => tm.employee_id));
      return uniqueIds.size;
    },
  });

  const kpiCards = [
    {
      title: "Antal medarbejdere",
      value: isLoading ? "..." : uniqueEmployeeCount,
      icon: Users,
      description: "Unikke medarbejdere på tværs af teams",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "KPI 2",
      value: "-",
      icon: TrendingUp,
      description: "Kommer snart",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      title: "KPI 3",
      value: "-",
      icon: Building2,
      description: "Kommer snart",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      title: "KPI 4",
      value: "-",
      icon: Target,
      description: "Kommer snart",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
  ];

  return (
    <div className="p-6 space-y-6">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
