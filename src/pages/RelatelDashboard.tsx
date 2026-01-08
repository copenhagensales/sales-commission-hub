import { useState } from "react";
import { format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { Users, DollarSign, ShoppingCart, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardDateRangePicker } from "@/components/dashboard/DashboardDateRangePicker";
import { DateRange } from "react-day-picker";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value) + ' DKK';

export default function RelatelDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: new Date()
  });

  const { totalSales, totalCommission, totalHours, employeeStats, isLoading } = useDashboardSalesData({
    clientName: "relatel",
    startDate: dateRange?.from || new Date(),
    endDate: dateRange?.to || new Date(),
  });

  const getSubtitle = () => {
    if (!dateRange?.from) return "Baseret på dagsrapporter";
    const isSingleDay = !dateRange.to || startOfDay(dateRange.from).getTime() === startOfDay(dateRange.to).getTime();
    if (isSingleDay) {
      return `Salg for ${format(dateRange.from, "d. MMMM yyyy", { locale: da })} • Baseret på dagsrapporter`;
    }
    return `Salg fra ${format(dateRange.from, "d. MMM", { locale: da })} til ${format(dateRange.to!, "d. MMM yyyy", { locale: da })} • Baseret på dagsrapporter`;
  };

  const datePickerContent = (
    <DashboardDateRangePicker 
      dateRange={dateRange} 
      onDateRangeChange={setDateRange} 
    />
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader 
        title="Relatel – Overblik" 
        subtitle={getSubtitle()}
        rightContent={datePickerContent}
      />
      <div className="space-y-6">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Antal salg</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{isLoading ? "..." : totalSales}</div>
              <p className="text-xs text-muted-foreground mt-1">Kun mappede medarbejdere</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Provision</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "..." : formatCurrency(totalCommission)}</div>
              <p className="text-xs text-muted-foreground mt-1">Fra dagsrapporter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Timer</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "..." : totalHours.toLocaleString("da-DK")}</div>
              <p className="text-xs text-muted-foreground mt-1">Fra vagtplaner/timestamps</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Salg pr. sælger
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Indlæser...</p>
            ) : employeeStats.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ingen salg registreret i perioden</p>
            ) : (
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
                  {employeeStats.map(emp => (
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
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}