import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Clock, AlertTriangle } from "lucide-react";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";
import { startOfMonth } from "date-fns";

export default function Dashboard() {
  const today = new Date();
  const monthStart = startOfMonth(today);

  const { totalSales, totalRevenue, totalCommission, totalHours, employeeStats, isLoading } = useDashboardSalesData({
    startDate: monthStart,
    endDate: today,
  });

  const unmappedEmployees = employeeStats.filter(e => e.totalSales === 0 && e.totalHours > 0).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overblik over salg denne måned (kun mappede medarbejdere)</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Provision</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : totalCommission.toLocaleString("da-DK")} DKK
              </div>
              <p className="text-xs text-muted-foreground">Baseret på dagsrapporter</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Omsætning</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : totalRevenue.toLocaleString("da-DK")} DKK
              </div>
              <p className="text-xs text-muted-foreground">Baseret på dagsrapporter</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Salg</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : totalSales}</div>
              <p className="text-xs text-muted-foreground">Kun mappede medarbejdere</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Timer</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : totalHours.toLocaleString("da-DK")}</div>
              <p className="text-xs text-muted-foreground">Fra vagtplaner/timestamps</p>
            </CardContent>
          </Card>
        </div>

        {unmappedEmployees > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-amber-500">Medarbejdere uden salg</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                <span className="font-bold text-amber-500">{unmappedEmployees}</span> medarbejdere har timer men ingen registrerede salg.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
