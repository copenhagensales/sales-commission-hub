import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { X, Calendar, Info } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface DBDailyBreakdownProps {
  teamId: string;
  teamName: string;
  periodStart: Date;
  periodEnd: Date;
  onClose: () => void;
}

interface DailyData {
  date: string;
  revenue: number;
  sellerCommission: number;
  distributedExpense: number;
  specificExpense: number;
  db: number;
}

export function DBDailyBreakdown({ teamId, teamName, periodStart, periodEnd, onClose }: DBDailyBreakdownProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["team-daily-db", teamId, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      // Get team members
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("employee_id")
        .eq("team_id", teamId);

      const memberIds = teamMembers?.map(m => m.employee_id) || [];

      // Get agent mappings for team members
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent_id, agents(email, external_dialer_id)")
        .in("employee_id", memberIds);

      const agentEmails = agentMappings?.map(a => (a.agents as any)?.email?.toLowerCase()).filter(Boolean) || [];
      const agentExtIds = agentMappings?.map(a => (a.agents as any)?.external_dialer_id).filter(Boolean) || [];

      // Get sale items for the period with pagination to bypass 1000-row limit
      const saleItems = await fetchAllRows<{
        id: string;
        quantity: number;
        mapped_commission: number;
        mapped_revenue: number;
        sales: { id: string; sale_datetime: string; agent_email: string; agent_external_id: string };
      }>(
        "sale_items",
        "id, quantity, mapped_commission, mapped_revenue, sales!inner(id, sale_datetime, agent_email, agent_external_id)",
        (query) =>
          query
            .gte("sales.sale_datetime", periodStart.toISOString())
            .lte("sales.sale_datetime", periodEnd.toISOString()),
        { orderBy: "id", ascending: true }
      );

      // Filter to team sales
      const teamSales = saleItems?.filter(si => {
        const email = (si.sales as any)?.agent_email?.toLowerCase();
        const extId = (si.sales as any)?.agent_external_id;
        return agentEmails.includes(email) || agentExtIds.includes(extId);
      }) || [];

      // Get team expenses
      const { data: expenses } = await supabase
        .from("team_expenses")
        .select("amount, expense_date, all_days")
        .eq("team_id", teamId)
        .gte("expense_date", periodStart.toISOString().split("T")[0])
        .lte("expense_date", periodEnd.toISOString().split("T")[0]);

      // Separate all_days expenses from specific date expenses
      const allDaysExpenses = expenses?.filter(e => e.all_days === true) || [];
      const specificExpenses = expenses?.filter(e => e.all_days !== true) || [];
      const totalAllDaysExpense = allDaysExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Group sales by date
      const salesByDate: Record<string, { revenue: number; commission: number }> = {};
      teamSales.forEach(si => {
        const date = format(new Date((si.sales as any).sale_datetime), "yyyy-MM-dd");
        if (!salesByDate[date]) {
          salesByDate[date] = { revenue: 0, commission: 0 };
        }
        salesByDate[date].revenue += (Number(si.mapped_revenue) || 0) * (si.quantity || 1);
        salesByDate[date].commission += (Number(si.mapped_commission) || 0) * (si.quantity || 1);
      });

      // Group specific expenses by date
      const expensesByDate: Record<string, number> = {};
      specificExpenses.forEach(e => {
        const date = e.expense_date;
        if (!expensesByDate[date]) {
          expensesByDate[date] = 0;
        }
        expensesByDate[date] += Number(e.amount);
      });

      // Calculate sales days count
      const salesDates = Object.keys(salesByDate);
      const salesDaysCount = salesDates.length;

      // Distribute all_days expenses per sales day
      const expensePerSalesDay = salesDaysCount > 0 ? totalAllDaysExpense / salesDaysCount : 0;

      // Build daily data array
      const dailyData: DailyData[] = salesDates
        .sort()
        .map(date => {
          const dayData = salesByDate[date];
          const specificExpense = expensesByDate[date] || 0;
          const db = dayData.revenue - dayData.commission - expensePerSalesDay - specificExpense;
          
          return {
            date,
            revenue: dayData.revenue,
            sellerCommission: dayData.commission,
            distributedExpense: expensePerSalesDay,
            specificExpense,
            db,
          };
        });

      return {
        dailyData,
        totalAllDaysExpense,
        salesDaysCount,
        expensePerSalesDay,
      };
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);

  const totals = data?.dailyData.reduce(
    (acc, d) => ({
      revenue: acc.revenue + d.revenue,
      sellerCommission: acc.sellerCommission + d.sellerCommission,
      distributedExpense: acc.distributedExpense + d.distributedExpense,
      specificExpense: acc.specificExpense + d.specificExpense,
      db: acc.db + d.db,
    }),
    { revenue: 0, sellerCommission: 0, distributedExpense: 0, specificExpense: 0, db: 0 }
  ) || { revenue: 0, sellerCommission: 0, distributedExpense: 0, specificExpense: 0, db: 0 };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle>{teamName} - Daglig DB</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Expense distribution info */}
        {data && data.totalAllDaysExpense > 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span>
              Udgiftsfordeling: {formatCurrency(data.totalAllDaysExpense)} ÷ {data.salesDaysCount} salgsdage = {formatCurrency(data.expensePerSalesDay)}/dag
            </span>
          </div>
        )}

        {/* Daily table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dato</TableHead>
                <TableHead className="text-right">Omsætning</TableHead>
                <TableHead className="text-right">Sælgerløn</TableHead>
                <TableHead className="text-right">Udgift (fordelt)</TableHead>
                <TableHead className="text-right">Udgift (specifik)</TableHead>
                <TableHead className="text-right">DB</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Indlæser...
                  </TableCell>
                </TableRow>
              ) : !data?.dailyData.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ingen salg i perioden
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {data.dailyData.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">
                        {format(new Date(day.date), "d. MMM", { locale: da })}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(day.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatCurrency(day.sellerCommission)}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatCurrency(day.distributedExpense)}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {day.specificExpense > 0 ? `-${formatCurrency(day.specificExpense)}` : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${day.db >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {formatCurrency(day.db)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.revenue)}</TableCell>
                    <TableCell className="text-right text-destructive">-{formatCurrency(totals.sellerCommission)}</TableCell>
                    <TableCell className="text-right text-destructive">-{formatCurrency(totals.distributedExpense)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {totals.specificExpense > 0 ? `-${formatCurrency(totals.specificExpense)}` : "-"}
                    </TableCell>
                    <TableCell className={`text-right ${totals.db >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {formatCurrency(totals.db)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-sm text-muted-foreground">
          Udgifter markeret "Alle dage i perioden" fordeles ligeligt på de {data?.salesDaysCount || 0} dage med salg.
        </p>
      </CardContent>
    </Card>
  );
}
