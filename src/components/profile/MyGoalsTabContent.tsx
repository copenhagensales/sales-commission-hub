import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SalesGoalTracker } from "@/components/my-profile/SalesGoalTracker";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { usePrecomputedKpis, getKpiValue, type KpiPeriod } from "@/hooks/usePrecomputedKpi";

interface MyGoalsTabContentProps {
  employeeId: string;
  salaryType: string | null;
}

export function MyGoalsTabContent({ employeeId, salaryType }: MyGoalsTabContentProps) {
  // Calculate payroll period (15th to 14th)
  const payrollPeriod = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    
    let start: Date, end: Date;
    
    if (currentDay >= 15) {
      start = new Date(today.getFullYear(), today.getMonth(), 15);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 14);
    } else {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 15);
      end = new Date(today.getFullYear(), today.getMonth(), 14);
    }
    
    return { start, end };
  }, []);

  // Fetch KPIs from cache for payroll period
  const { data: payrollKpis } = usePrecomputedKpis(
    ["sales_count", "total_commission"],
    "payroll_period" as KpiPeriod,
    "employee",
    employeeId
  );

  // Fetch KPIs from cache for today
  const { data: todayKpis } = usePrecomputedKpis(
    ["sales_count", "total_commission"],
    "today" as KpiPeriod,
    "employee",
    employeeId
  );

  // Get absences
  const { data: absences = [] } = useQuery({
    queryKey: ["my-goals-absences", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("absence_request_v2")
        .select("start_date, end_date, type")
        .eq("employee_id", employeeId)
        .eq("status", "approved");

      return (data || []).map(a => ({
        start_date: a.start_date,
        end_date: a.end_date,
        type: a.type,
      }));
    },
  });

  // Get Danish holidays
  const { data: danishHolidays = [] } = useQuery({
    queryKey: ["my-goals-danish-holidays"],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const { data } = await supabase
        .from("danish_holiday")
        .select("date, name")
        .gte("year", currentYear - 1)
        .lte("year", currentYear + 1);
      return (data || []).map(h => ({ date: h.date, name: h.name }));
    },
  });

  // Non-provision employees see a message
  if (salaryType !== 'provision') {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Mål er kun tilgængelige for provisionslønnede medarbejdere</p>
            <p className="text-sm mt-2">
              Kontakt din leder, hvis du mener dette er en fejl.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Extract values from cached KPIs
  const periodCommission = getKpiValue(payrollKpis?.total_commission);
  const periodSalesCount = getKpiValue(payrollKpis?.sales_count);
  const todayCommission = getKpiValue(todayKpis?.total_commission);
  const todaySalesCount = getKpiValue(todayKpis?.sales_count);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Mine Mål</h2>
        <p className="text-sm text-muted-foreground">Sæt og følg dine salgsmål for lønperioden</p>
      </div>

      <SalesGoalTracker
        employeeId={employeeId}
        payrollPeriod={payrollPeriod}
        commissionStats={{
          periodTotal: periodCommission,
          periodSales: periodSalesCount,
          monthTotal: periodCommission,
          monthSales: periodSalesCount,
          todayTotal: todayCommission,
          todaySales: todaySalesCount,
        }}
        absences={absences}
        danishHolidays={danishHolidays}
      />
    </div>
  );
}
