import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SalesGoalTracker } from "@/components/my-profile/SalesGoalTracker";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

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

  // Get commission stats for the payroll period
  const { data: commissionStats } = useQuery({
    queryKey: ["my-goals-commission-stats", employeeId, payrollPeriod.start.toISOString()],
    queryFn: async () => {
      const now = new Date();
      const periodStart = payrollPeriod.start.toISOString();
      const periodEnd = payrollPeriod.end.toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      let periodCommission = 0;
      let todayCommission = 0;
      let periodSalesCount = 0;
      let todaySalesCount = 0;

      // Check for agent mappings
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, agents(name)")
        .eq("employee_id", employeeId);

      if (mappings && mappings.length > 0) {
        const agentNames = mappings.map(m => {
          const agent = m.agents as { name: string } | null;
          return agent?.name;
        }).filter(Boolean) as string[];

        if (agentNames.length > 0) {
          const { data: periodSales } = await supabase
            .from("sales")
            .select(`
              id,
              sale_datetime,
              sale_items (
                id,
                mapped_commission,
                quantity
              )
            `)
            .in("agent_name", agentNames)
            .gte("sale_datetime", periodStart)
            .lte("sale_datetime", periodEnd);

          const { data: todaySales } = await supabase
            .from("sales")
            .select(`
              id,
              sale_items (
                id,
                mapped_commission,
                quantity
              )
            `)
            .in("agent_name", agentNames)
            .gte("sale_datetime", todayStart)
            .lte("sale_datetime", todayEnd);

          periodCommission += (periodSales || []).reduce((total, sale) => {
            const items = sale.sale_items as Array<{ mapped_commission?: number }> | null;
            return total + ((items || []).reduce((sum, item) => sum + (item.mapped_commission || 0), 0));
          }, 0);

          todayCommission += (todaySales || []).reduce((total, sale) => {
            const items = sale.sale_items as Array<{ mapped_commission?: number }> | null;
            return total + ((items || []).reduce((sum, item) => sum + (item.mapped_commission || 0), 0));
          }, 0);

          periodSalesCount += periodSales?.length || 0;
          todaySalesCount += todaySales?.length || 0;
        }
      }

      // Also check fieldmarketing_sales
      const { data: fmPeriodSales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, product_name, registered_at")
        .eq("seller_id", employeeId)
        .gte("registered_at", periodStart)
        .lte("registered_at", periodEnd);

      const { data: fmTodaySales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, product_name")
        .eq("seller_id", employeeId)
        .gte("registered_at", todayStart)
        .lte("registered_at", todayEnd);

      const allFmSales = [...(fmPeriodSales || []), ...(fmTodaySales || [])];
      if (allFmSales.length > 0) {
        const allProductNames = allFmSales.map(s => s.product_name).filter(Boolean) as string[];
        const uniqueProductNames = [...new Set(allProductNames)];

        if (uniqueProductNames.length > 0) {
          const { data: products } = await supabase
            .from("products")
            .select("name, commission_dkk")
            .in("name", uniqueProductNames);

          const productCommissionMap = new Map(
            (products || []).map(p => [p.name, p.commission_dkk || 0])
          );

          periodCommission += (fmPeriodSales || []).reduce((total, sale) => {
            return total + (productCommissionMap.get(sale.product_name) || 0);
          }, 0);

          todayCommission += (fmTodaySales || []).reduce((total, sale) => {
            return total + (productCommissionMap.get(sale.product_name) || 0);
          }, 0);
        }
      }

      periodSalesCount += fmPeriodSales?.length || 0;
      todaySalesCount += fmTodaySales?.length || 0;

      return {
        periodCommission,
        periodSalesCount,
        todayCommission,
        todaySalesCount,
      };
    },
    enabled: salaryType === 'provision',
  });

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
          periodTotal: commissionStats?.periodCommission || 0,
          periodSales: commissionStats?.periodSalesCount || 0,
          monthTotal: commissionStats?.periodCommission || 0,
          monthSales: commissionStats?.periodSalesCount || 0,
          todayTotal: commissionStats?.todayCommission || 0,
          todaySales: commissionStats?.todaySalesCount || 0,
        }}
        absences={absences}
        danishHolidays={danishHolidays}
      />
    </div>
  );
}
