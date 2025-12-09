import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Package, AlertTriangle, TrendingDown } from "lucide-react";

export default function Dashboard() {
  const { data: salesData } = useQuery({
    queryKey: ['dashboard-sales'],
    queryFn: async () => {
      // Get sale items with their parent sale's validation_status
      const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select('mapped_commission, mapped_revenue, needs_mapping, quantity, sale_id, sales!inner(validation_status)');
      if (error) throw error;

      // Filter to only include valid sales (not cancelled or rejected)
      const validItems = saleItems?.filter((item: any) => {
        const status = item.sales?.validation_status;
        return status !== 'cancelled' && status !== 'rejected';
      }) || [];

      const totalCommission = validItems.reduce((sum: number, item: any) => {
        const qty = Number(item.quantity ?? 1) || 1;
        const commissionPerUnit = Number(item.mapped_commission) || 0;
        return sum + qty * commissionPerUnit;
      }, 0);

      const totalRevenue = validItems.reduce((sum: number, item: any) => {
        const qty = Number(item.quantity ?? 1) || 1;
        const revenuePerUnit = Number(item.mapped_revenue) || 0;
        return sum + qty * revenuePerUnit;
      }, 0);

      const unmappedCount = saleItems?.filter((item: any) => item.needs_mapping).length || 0;
      
      // Count cancelled/rejected sales for info
      const invalidItems = saleItems?.filter((item: any) => {
        const status = item.sales?.validation_status;
        return status === 'cancelled' || status === 'rejected';
      }) || [];

      return { 
        totalCommission, 
        totalRevenue, 
        unmappedCount, 
        totalItems: saleItems?.length || 0,
        cancelledCount: invalidItems.length
      };
    }
  });

  const { data: salesCount } = useQuery({
    queryKey: ['dashboard-sales-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_items')
        .select('quantity, sales!inner(validation_status)');
      if (error) throw error;
      
      // Only count valid sales
      const validItems = data?.filter((item: any) => {
        const status = item.sales?.validation_status;
        return status !== 'cancelled' && status !== 'rejected';
      }) || [];
      
      const totalUnits = validItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
      return totalUnits;
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
              <p className="text-xs text-muted-foreground">Kun godkendte salg</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(salesData?.totalRevenue || 0).toLocaleString('da-DK')} DKK</div>
              <p className="text-xs text-muted-foreground">Kun godkendte salg</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesCount || 0}</div>
              <p className="text-xs text-muted-foreground">Kun godkendte salg</p>
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
        
        {(salesData?.cancelledCount || 0) > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="flex flex-row items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Annullerede/Afviste salg</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                <span className="font-bold text-destructive">{salesData?.cancelledCount}</span> salg er annulleret eller afvist af CRM-validering.
              </p>
            </CardContent>
          </Card>
        )}

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
