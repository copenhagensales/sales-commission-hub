import { useState } from "react";
import { format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Users, DollarSign, Clock } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardDateRangePicker } from "@/components/dashboard/DashboardDateRangePicker";
import { DateRange } from "react-day-picker";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value) + ' DKK';

const TrygDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: new Date()
  });

  const { totalSales, totalCommission, totalHours, employeeStats, isLoading } = useDashboardSalesData({
    clientName: "tryg",
    startDate: dateRange?.from || new Date(),
    endDate: dateRange?.to || new Date(),
  });

  const getSubtitle = () => {
    if (!dateRange?.from) return "Baseret på dagsrapporter";
    const isSingleDay = !dateRange.to || startOfDay(dateRange.from).getTime() === startOfDay(dateRange.to).getTime();
    if (isSingleDay) {
      const isToday = startOfDay(dateRange.from).getTime() === startOfDay(new Date()).getTime();
      return `Salg for ${isToday ? "i dag" : format(dateRange.from, "d. MMMM yyyy", { locale: da })} • Baseret på dagsrapporter`;
    }
    return `Salg fra ${format(dateRange.from, "d. MMM", { locale: da })} til ${format(dateRange.to!, "d. MMM yyyy", { locale: da })} • Baseret på dagsrapporter`;
  };

  const datePickerContent = (
    <DashboardDateRangePicker 
      dateRange={dateRange} 
      onDateRangeChange={setDateRange} 
    />
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <DashboardHeader title="Tryg – Overblik" subtitle="Baseret på dagsrapporter" />
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader 
        title="Tryg – Overblik" 
        subtitle={getSubtitle()}
        rightContent={datePickerContent}
      />
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Salg</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSales}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sælgere</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employeeStats.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Provision</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCommission)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Timer</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHours.toLocaleString("da-DK")}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Salg pr. sælger</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sælger</TableHead>
                  <TableHead className="text-right">Timer</TableHead>
                  <TableHead className="text-right">Salg</TableHead>
                  <TableHead className="text-right">Provision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Ingen salg registreret i perioden
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {employeeStats.map((emp) => (
                      <TableRow key={emp.employeeId}>
                        <TableCell className="font-medium">{emp.employeeName}</TableCell>
                        <TableCell className="text-right">{emp.totalHours.toLocaleString("da-DK")}</TableCell>
                        <TableCell className="text-right">{emp.totalSales}</TableCell>
                        <TableCell className="text-right">{formatCurrency(emp.totalCommission)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{totalHours.toLocaleString("da-DK")}</TableCell>
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

export default TrygDashboard;