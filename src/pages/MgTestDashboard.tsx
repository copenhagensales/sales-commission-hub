import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";

export default function MgTestDashboard() {
  // Fetch sales summary
  const { data: salesSummary, isLoading } = useQuery({
    queryKey: ["mg-test-dashboard-summary"],
    queryFn: async () => {
      const { data: saleItems, error } = await supabase
        .from("sale_items")
        .select(`
          id,
          quantity,
          mapped_commission,
          mapped_revenue,
          sales!inner(sale_datetime)
        `);

      if (error) throw error;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let totalSales = 0;
      let totalCommission = 0;
      let totalRevenue = 0;
      let salesToday = 0;
      let salesThisMonth = 0;

      saleItems?.forEach((item: any) => {
        const qty = item.quantity || 1;
        const commission = (item.mapped_commission || 0) * qty;
        const revenue = (item.mapped_revenue || 0) * qty;
        const saleDate = new Date(item.sales.sale_datetime);

        totalSales += qty;
        totalCommission += commission;
        totalRevenue += revenue;

        if (saleDate >= startOfToday) {
          salesToday += qty;
        }
        if (saleDate >= startOfMonth) {
          salesThisMonth += qty;
        }
      });

      return {
        totalSales,
        totalCommission,
        totalRevenue,
        salesToday,
        salesThisMonth,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Test Dashboard</h1>
          <p className="text-muted-foreground">Overblik over salgsdata</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : salesSummary?.salesToday ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg denne måned</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : salesSummary?.salesThisMonth ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total provision</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : formatCurrency(salesSummary?.totalCommission ?? 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total omsætning</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : formatCurrency(salesSummary?.totalRevenue ?? 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
