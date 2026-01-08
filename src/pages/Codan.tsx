import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, TrendingUp, DollarSign, ShoppingCart, Clock, Users } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardDateRangePicker } from "@/components/dashboard/DashboardDateRangePicker";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";
import { startOfDay, startOfMonth, format } from "date-fns";
import { da } from "date-fns/locale";
import { DateRange } from "react-day-picker";

const formatCurrency = (value: number) => `${value.toLocaleString("da-DK")} DKK`;

export default function Codan() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: new Date(),
  });

  // Find Codan client ID
  const { data: codanClientId } = useQuery({
    queryKey: ["codan-client-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", "%codan%")
        .limit(1);
      return data?.[0]?.id || null;
    },
  });

  const startDate = dateRange?.from || startOfDay(new Date());
  const endDate = dateRange?.to || new Date();

  const { totalSales, totalRevenue, totalCommission, totalHours, employeeStats, isLoading } = useDashboardSalesData({
    clientId: codanClientId || undefined,
    startDate,
    endDate,
    enabled: !!codanClientId,
  });

  const getSubtitle = () => {
    if (!dateRange?.from) return "Salgsdata baseret på dagsrapporter";
    const isSingleDay = !dateRange.to || startOfDay(dateRange.from).getTime() === startOfDay(dateRange.to).getTime();
    if (isSingleDay) {
      const isToday = startOfDay(dateRange.from).getTime() === startOfDay(new Date()).getTime();
      return `Salg for ${isToday ? "i dag" : format(dateRange.from, "d. MMMM yyyy", { locale: da })}`;
    }
    return `Salg fra ${format(dateRange.from, "d. MMM", { locale: da })} til ${format(dateRange.to!, "d. MMM yyyy", { locale: da })}`;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <DashboardHeader
          title="Codan – salgsdashboard"
          subtitle={getSubtitle()}
          rightContent={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Kunde: Codan</span>
              </div>
              <DashboardDateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : totalSales}</div>
              <p className="text-xs text-muted-foreground mt-1">Kun mappede medarbejdere</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Omsætning</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Baseret på dagsrapporter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Provision</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(totalCommission)}</div>
              <p className="text-xs text-muted-foreground mt-1">Baseret på dagsrapporter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Timer</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : totalHours.toLocaleString("da-DK")}</div>
              <p className="text-xs text-muted-foreground mt-1">Fra vagtplaner</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle className="text-lg">Salg pr. medarbejder</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Indlæser...</div>
            ) : employeeStats.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Ingen salg registreret i perioden.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Timer</TableHead>
                    <TableHead className="text-right">Salg</TableHead>
                    <TableHead className="text-right">Omsætning</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeStats.map((emp) => (
                    <TableRow key={emp.employeeId}>
                      <TableCell className="font-medium">{emp.employeeName}</TableCell>
                      <TableCell>{emp.teamName || "—"}</TableCell>
                      <TableCell className="text-right">{emp.totalHours}</TableCell>
                      <TableCell className="text-right">{emp.totalSales}</TableCell>
                      <TableCell className="text-right">{formatCurrency(emp.totalRevenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(emp.totalCommission)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{totalHours}</TableCell>
                    <TableCell className="text-right">{totalSales}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalCommission)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
