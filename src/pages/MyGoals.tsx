import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { SalesGoalTracker } from "@/components/my-profile/SalesGoalTracker";
import { Card, CardContent } from "@/components/ui/card";
import { Target, AlertCircle, ArrowLeft } from "lucide-react";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type EmployeeData = {
  id: string;
  salary_type: string | null;
  first_name: string;
  last_name: string;
};

export default function MyGoals() {
  const { employeeId: urlEmployeeId } = useParams<{ employeeId?: string }>();
  const { previewEmployee } = useRolePreview();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get employee data - prioritize URL param, then preview, then current user
  const { data: employee, isLoading: employeeLoading } = useQuery<EmployeeData | null>({
    queryKey: ["my-goals-employee", currentUser?.id, previewEmployee?.id, urlEmployeeId],
    queryFn: async (): Promise<EmployeeData | null> => {
      // Priority: URL param > preview > current user
      const targetEmployeeId = urlEmployeeId || previewEmployee?.id;
      
      if (targetEmployeeId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("employee_master_data")
          .select("id, salary_type, first_name, last_name")
          .eq("id", targetEmployeeId)
          .single();
        return data as EmployeeData | null;
      }
      
      if (!currentUser?.id) return null;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("employee_master_data")
        .select("id, salary_type, first_name, last_name")
        .eq("auth_user_id", currentUser.id)
        .single();
      return data as EmployeeData | null;
    },
    enabled: !!currentUser?.id || !!previewEmployee?.id || !!urlEmployeeId,
  });

  // Determine if viewing another employee's goals
  const isViewingOther = !!urlEmployeeId;

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

  // Get commission stats for the payroll period (matching MyProfile logic)
  const { data: commissionStats } = useQuery({
    queryKey: ["my-goals-commission-stats", employee?.id, payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (!employee?.id) return null;

      const now = new Date();
      const periodStart = payrollPeriod.start.toISOString();
      const periodEnd = payrollPeriod.end.toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      let periodCommission = 0;
      let todayCommission = 0;
      let periodSalesCount = 0;
      let todaySalesCount = 0;

      // Check for agent mappings (for dialer-based sales)
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, agents(name)")
        .eq("employee_id", employee.id);

      if (mappings && mappings.length > 0) {
        const agentNames = mappings.map(m => {
          const agent = m.agents as { name: string } | null;
          return agent?.name;
        }).filter(Boolean) as string[];

        if (agentNames.length > 0) {
          // Fetch period sales for this employee's agents
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

          // Fetch today's sales
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

          // Calculate totals - mapped_commission already contains total (base × quantity)
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

      // Also check fieldmarketing_sales (for fieldmarketing employees)
      const { data: fmPeriodSales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, product_name, registered_at")
        .eq("seller_id", employee.id)
        .gte("registered_at", periodStart)
        .lte("registered_at", periodEnd);

      const { data: fmTodaySales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, product_name")
        .eq("seller_id", employee.id)
        .gte("registered_at", todayStart)
        .lte("registered_at", todayEnd);

      // Fetch products to get commission values for fieldmarketing sales
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

          // Add fieldmarketing commission for period
          periodCommission += (fmPeriodSales || []).reduce((total, sale) => {
            return total + (productCommissionMap.get(sale.product_name) || 0);
          }, 0);

          // Add fieldmarketing commission for today
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
    enabled: !!employee?.id && employee?.salary_type === 'provision',
  });

  // Get absences for the employee
  const { data: absences = [] } = useQuery({
    queryKey: ["my-goals-absences", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];

      const { data } = await supabase
        .from("absence_request_v2")
        .select("start_date, end_date, type")
        .eq("employee_id", employee.id)
        .eq("status", "approved");

      return (data || []).map(a => ({
        start_date: a.start_date,
        end_date: a.end_date,
        type: a.type,
      }));
    },
    enabled: !!employee?.id,
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

  if (employeeLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  // Check if employee is provision-based
  if (employee?.salary_type !== 'provision') {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6" />
              Mine Mål
            </h1>
            <p className="text-muted-foreground mt-1">
              Sæt og følg dine salgsmål
            </p>
          </div>

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
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {isViewingOther && (
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link to="/dashboards/tdc-erhverv-goals">
              <ArrowLeft className="h-4 w-4" />
              Tilbage til team oversigt
            </Link>
          </Button>
        )}
        
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            {isViewingOther ? `${employee.first_name} ${employee.last_name}s Mål` : "Mine Mål"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isViewingOther 
              ? `Se og følg ${employee.first_name}s salgsmål for lønperioden`
              : "Sæt og følg dine salgsmål for lønperioden"
            }
          </p>
        </div>

        <SalesGoalTracker
          employeeId={employee.id}
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
    </MainLayout>
  );
}
