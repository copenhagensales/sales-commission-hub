import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Users, Clock } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardDateRangePicker } from "@/components/dashboard/DashboardDateRangePicker";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";
import { DateRange } from "react-day-picker";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("da-DK", { style: "decimal", maximumFractionDigits: 0 }).format(value) + " DKK";

const AseDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: new Date(),
  });

  // Find ASE client ID - ASE sales are matched by source containing 'ase'
  // For now, we'll use a generic approach without client filtering
  // since ASE is source-based, not client-based

  const startDate = dateRange?.from || startOfDay(new Date());
  const endDate = dateRange?.to || new Date();

  // We need a client-agnostic approach for ASE since it's source-based
  // Using the hook without clientId to get all mapped employees
  const { totalSales, totalCommission, totalHours, employeeStats, isLoading } = useDashboardSalesData({
    startDate,
    endDate,
  });

  const getSubtitle = () => {
    if (!dateRange?.from) return "Salgsdata baseret på dagsrapporter";
    const isSingleDay =
      !dateRange.to || startOfDay(dateRange.from).getTime() === startOfDay(dateRange.to).getTime();
    if (isSingleDay) {
      const isToday = startOfDay(dateRange.from).getTime() === startOfDay(new Date()).getTime();
      return `Salg for ${isToday ? "i dag" : format(dateRange.from, "d. MMMM yyyy", { locale: da })} • Baseret på dagsrapporter`;
    }
    return `Salg fra ${format(dateRange.from, "d. MMM", { locale: da })} til ${format(dateRange.to!, "d. MMM yyyy", { locale: da })} • Baseret på dagsrapporter`;
  };

  const datePickerContent = <DashboardDateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <DashboardHeader title="ASE – Overblik" subtitle="Salgsdata baseret på dagsrapporter" />
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader title="ASE – Overblik" subtitle={getSubtitle()} rightContent={datePickerContent} />
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Salg</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSales}</div>
              <p className="text-xs text-muted-foreground">Kun mappede medarbejdere</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Timer</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHours.toLocaleString("da-DK")}</div>
              <p className="text-xs text-muted-foreground">Fra vagtplaner</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Provision</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCommission)}</div>
              <p className="text-xs text-muted-foreground">Baseret på dagsrapporter</p>
            </CardContent>
          </Card>
        </div>

        {/* Employee Table */}
        <Card>
          <CardHeader>
            <CardTitle>Salg pr. medarbejder</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medarbejder</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Timer</TableHead>
                  <TableHead className="text-right">Salg</TableHead>
                  <TableHead className="text-right">Provision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Ingen salg registreret i perioden
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {employeeStats.map((emp) => (
                      <TableRow key={emp.employeeId}>
                        <TableCell className="font-medium">{emp.employeeName}</TableCell>
                        <TableCell>{emp.teamName || "—"}</TableCell>
                        <TableCell className="text-right">{emp.totalHours}</TableCell>
                        <TableCell className="text-right">{emp.totalSales}</TableCell>
                        <TableCell className="text-right">{formatCurrency(emp.totalCommission)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{totalHours}</TableCell>
                      <TableCell className="text-right">{totalSales}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totalCommission)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AseDashboard;
