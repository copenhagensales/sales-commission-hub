import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamDBStats } from "@/hooks/useTeamDBStats";
import { useCpoRevenue } from "@/hooks/useCpoRevenue";
import { formatCurrency } from "@/lib/calculations";
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
  // Get aggregated sales data from central hook
  const { byDate: salesByDate, isLoading: aggregatesLoading } = useTeamDBStats(
    periodStart,
    periodEnd,
    teamId,
    undefined,
    true
  );

  // Get CPO-based revenue for this team
  const { data: cpoRevenue, isLoading: cpoLoading } = useCpoRevenue({
    periodStart,
    periodEnd,
    teamId,
    enabled: true,
  });

  // Fetch team expenses separately (not part of sales aggregation)
  const { data: expenseData, isLoading: expenseLoading } = useQuery({
    queryKey: ["team-daily-expenses", teamId, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
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

      // Group specific expenses by date
      const expensesByDate: Record<string, number> = {};
      specificExpenses.forEach(e => {
        const date = e.expense_date;
        if (!expensesByDate[date]) {
          expensesByDate[date] = 0;
        }
        expensesByDate[date] += Number(e.amount);
      });

      return { totalAllDaysExpense, expensesByDate };
    },
  });

  const isLoading = aggregatesLoading || expenseLoading || cpoLoading;

  // Build daily data array from aggregated sales and expenses
  const computedData = (() => {
    if (isLoading || !expenseData) return null;

    const salesDates = Object.keys(salesByDate).filter(date => {
      const data = salesByDate[date];
      return data.revenue > 0 || data.commission > 0;
    });
    const salesDaysCount = salesDates.length;

    // Distribute all_days expenses per sales day
    const expensePerSalesDay = salesDaysCount > 0 ? expenseData.totalAllDaysExpense / salesDaysCount : 0;

    // Build daily data array
    const dailyData: DailyData[] = salesDates
      .sort()
      .map(date => {
        const dayData = salesByDate[date];
        const specificExpense = expenseData.expensesByDate[date] || 0;
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
      totalAllDaysExpense: expenseData.totalAllDaysExpense,
      salesDaysCount,
      expensePerSalesDay,
    };
  })();

  // formatCurrency imported from @/lib/calculations

  const totals = computedData?.dailyData.reduce(
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
        {computedData && computedData.totalAllDaysExpense > 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span>
              Udgiftsfordeling: {formatCurrency(computedData.totalAllDaysExpense)} ÷ {computedData.salesDaysCount} salgsdage = {formatCurrency(computedData.expensePerSalesDay)}/dag
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
              ) : !computedData?.dailyData.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ingen salg i perioden
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {computedData.dailyData.map((day) => (
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
          Udgifter markeret "Alle dage i perioden" fordeles ligeligt på de {computedData?.salesDaysCount || 0} dage med salg.
        </p>
      </CardContent>
    </Card>
  );
}
