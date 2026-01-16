import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Clock, RefreshCw } from "lucide-react";
import { usePrecomputedKpis, getKpiValue, getKpiDisplay } from "@/hooks/usePrecomputedKpi";

export default function Dashboard() {
  // Use cached KPIs instead of direct database queries
  const { data: monthKpis, isLoading, dataUpdatedAt } = usePrecomputedKpis(
    ["sales_count", "total_commission", "total_revenue", "live_sales_hours"],
    "this_month",
    "global"
  );

  const totalSales = getKpiValue(monthKpis?.sales_count, 0);
  const totalCommission = getKpiValue(monthKpis?.total_commission, 0);
  const totalRevenue = getKpiValue(monthKpis?.total_revenue, 0);
  const totalHours = getKpiValue(monthKpis?.live_sales_hours, 0);

  const lastUpdated = dataUpdatedAt 
    ? new Date(dataUpdatedAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Overblik over salg denne måned</p>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              <span>Opdateret {lastUpdated}</span>
            </div>
          )}
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
              <p className="text-xs text-muted-foreground">Fra cached KPIs</p>
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
              <p className="text-xs text-muted-foreground">Fra cached KPIs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Salg</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : totalSales}</div>
              <p className="text-xs text-muted-foreground">Fra cached KPIs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Timer</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : totalHours.toLocaleString("da-DK")}</div>
              <p className="text-xs text-muted-foreground">Fra cached KPIs</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
