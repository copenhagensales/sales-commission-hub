import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { SalesGoalTracker } from "@/components/my-profile/SalesGoalTracker";
import { PayrollDayByDay } from "@/components/my-profile/PayrollDayByDay";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, AlertCircle, ArrowLeft } from "lucide-react";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { Button } from "@/components/ui/button";
import { usePersonalSalesStats } from "@/hooks/usePersonalSalesStats";
import { PayrollPeriodSelector } from "@/components/employee/PayrollPeriodSelector";
import { getPayrollPeriod } from "@/lib/calculations";
import { PayrollErrorReportDialog } from "@/components/my-profile/PayrollErrorReportDialog";

type EmployeeData = {
  id: string;
  salary_type: string | null;
  first_name: string;
  last_name: string;
};

export default function MyGoals() {
  const { employeeId: urlEmployeeId } = useParams<{ employeeId?: string }>();
  const { previewEmployee } = useRolePreview();
  
  // Payroll period state for Løn tab
  const [lonPeriod, setLonPeriod] = useState(() => getPayrollPeriod());
  const handleLonPeriodChange = useCallback((start: Date, end: Date) => {
    setLonPeriod({ start, end });
  }, []);

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
      
      // Use RPC that matches on auth_user_id OR email, with auto-linking
      const { data: employeeId } = await supabase.rpc("get_current_employee_id");
      if (!employeeId) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("employee_master_data")
        .select("id, salary_type, first_name, last_name")
        .eq("id", employeeId)
        .single();
      return data as EmployeeData | null;
    },
    enabled: !!currentUser?.id || !!previewEmployee?.id || !!urlEmployeeId,
  });

  // Determine if viewing another employee's goals
  const isViewingOther = !!urlEmployeeId;

  // Calculate payroll period (15th to 14th)
  const payrollPeriod = useMemo(() => getPayrollPeriod(), []);

  // Fetch live sales stats for payroll period
  const salesStats = usePersonalSalesStats(
    employee?.id || "",
    payrollPeriod.start,
    payrollPeriod.end
  );

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
              <Wallet className="h-6 w-6" />
              Løn & Mål
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
            <Link to="/employees">
              <ArrowLeft className="h-4 w-4" />
              Tilbage til medarbejdere
            </Link>
          </Button>
        )}
        
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            {isViewingOther ? `${employee.first_name} ${employee.last_name}s Mål` : "Løn & Mål"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isViewingOther 
              ? `Se og følg ${employee.first_name}s salgsmål for lønperioden`
              : "Sæt og følg dine salgsmål for lønperioden"
            }
          </p>
        </div>

        <Tabs defaultValue="maal" className="w-full">
          <TabsList>
            <TabsTrigger value="maal">Mål</TabsTrigger>
            <TabsTrigger value="lon">Løn</TabsTrigger>
          </TabsList>

          <TabsContent value="maal">
            <SalesGoalTracker
              employeeId={employee.id}
              payrollPeriod={payrollPeriod}
              commissionStats={{
                periodTotal: salesStats.periodTotal,
                periodSales: salesStats.periodSales,
                monthTotal: salesStats.monthTotal,
                monthSales: salesStats.monthSales,
                todayTotal: salesStats.todayTotal,
                todaySales: salesStats.todaySales,
                weekTotal: salesStats.weekTotal,
              }}
              absences={absences}
              danishHolidays={danishHolidays}
            />
          </TabsContent>

          <TabsContent value="lon">
            <div className="space-y-4">
              <div className="flex justify-center">
                <PayrollPeriodSelector onChange={handleLonPeriodChange} />
              </div>
              <div className="flex justify-end">
                <PayrollErrorReportDialog
                  employeeId={employee.id}
                  payrollPeriodStart={lonPeriod.start}
                  payrollPeriodEnd={lonPeriod.end}
                />
              </div>
              <PayrollDayByDay
                employeeId={employee.id}
                payrollPeriod={lonPeriod}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
