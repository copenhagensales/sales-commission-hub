import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, TrendingUp, Percent, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/calculations";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  isLoading?: boolean;
}

function KpiCard({ title, value, icon, subtitle, isLoading }: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
            ) : (
              <>
                <p className="text-xl font-bold truncate">{value}</p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SalaryDashboardKPIs() {
  // Fetch personnel salaries counts
  const { data: personnelCounts, isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ["personnel-salaries-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_salaries")
        .select("salary_type, is_active")
        .eq("is_active", true);

      if (error) throw error;

      const counts = {
        team_leaders: 0,
        assistants: 0,
        staff: 0,
      };

      data?.forEach((item) => {
        if (item.salary_type === "team_leader") counts.team_leaders++;
        else if (item.salary_type === "assistant") counts.assistants++;
        else if (item.salary_type === "staff") counts.staff++;
      });

      return counts;
    },
    staleTime: 60000,
  });

  // Fetch active sellers count
  const { data: activeSellers = 0, isLoading: isLoadingSellers } = useQuery({
    queryKey: ["active-sellers-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_master_data")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("job_title", "Sælger");

      if (error) throw error;
      return count || 0;
    },
    staleTime: 60000,
  });

  // Fetch total monthly salary costs
  const { data: totalMonthlySalary = 0, isLoading: isLoadingSalary } = useQuery({
    queryKey: ["total-monthly-salary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_salaries")
        .select("monthly_salary")
        .eq("is_active", true);

      if (error) throw error;
      return data?.reduce((sum, item) => sum + (item.monthly_salary || 0), 0) || 0;
    },
    staleTime: 60000,
  });

  const totalPersonnel = 
    (personnelCounts?.team_leaders || 0) + 
    (personnelCounts?.assistants || 0) + 
    (personnelCounts?.staff || 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard
        title="Personale løn"
        value={formatCurrency(totalMonthlySalary)}
        icon={<DollarSign className="h-5 w-5" />}
        subtitle="månedlig"
        isLoading={isLoadingSalary}
      />
      <KpiCard
        title="Aktive sælgere"
        value={activeSellers.toString()}
        icon={<TrendingUp className="h-5 w-5" />}
        isLoading={isLoadingSellers}
      />
      <KpiCard
        title="Personale"
        value={totalPersonnel.toString()}
        icon={<Users className="h-5 w-5" />}
        subtitle={`${personnelCounts?.team_leaders || 0} TL / ${personnelCounts?.assistants || 0} Ass / ${personnelCounts?.staff || 0} Stab`}
        isLoading={isLoadingPersonnel}
      />
      <KpiCard
        title="Lønarter"
        value="–"
        icon={<Percent className="h-5 w-5" />}
        subtitle="konfigureret"
        isLoading={false}
      />
    </div>
  );
}
