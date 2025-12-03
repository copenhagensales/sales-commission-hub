import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Package, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { data: salesData } = useQuery({
    queryKey: ['dashboard-sales'],
    queryFn: async () => {
      const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select('mapped_commission, mapped_revenue, needs_mapping');
      if (error) throw error;
      const totalCommission = saleItems?.reduce((sum, item) => sum + (Number(item.mapped_commission) || 0), 0) || 0;
      const totalRevenue = saleItems?.reduce((sum, item) => sum + (Number(item.mapped_revenue) || 0), 0) || 0;
      const unmappedCount = saleItems?.filter(item => item.needs_mapping).length || 0;
      return { totalCommission, totalRevenue, unmappedCount, totalItems: saleItems?.length || 0 };
    }
  });

  const { data: salesCount } = useQuery({
    queryKey: ['dashboard-sales-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('sales').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: productsCount } = useQuery({
    queryKey: ['dashboard-products-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your commission system</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(salesData?.totalCommission || 0).toLocaleString('da-DK')} DKK</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(salesData?.totalRevenue || 0).toLocaleString('da-DK')} DKK</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{productsCount || 0}</div>
            </CardContent>
          </Card>
        </div>
        {(salesData?.unmappedCount || 0) > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-amber-500">Attention Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                You have <span className="font-bold text-amber-500">{salesData?.unmappedCount}</span> items needing mapping.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
