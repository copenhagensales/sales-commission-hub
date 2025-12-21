import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Users, Package, DollarSign } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

interface SaleItem {
  id: string;
  quantity: number;
  sale_id: string;
  product_id: string | null;
  adversus_product_title: string | null;
  products: {
    id: string;
    name: string;
    commission_dkk: number | null;
    revenue_dkk: number | null;
    counts_as_sale: boolean | null;
  } | null;
  sales: {
    id: string;
    agent_name: string | null;
    sale_datetime: string;
    source: string | null;
  } | null;
}

interface AgentStats {
  name: string;
  salesCount: number;
  revenue: number;
  commission: number;
}

interface ProductStats {
  name: string;
  quantity: number;
  revenue: number;
  commission: number;
}

const TrygDashboard = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { data: saleItems, isLoading } = useQuery({
    queryKey: ['tryg-dashboard-sales', todayISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          id,
          quantity,
          sale_id,
          product_id,
          adversus_product_title,
          products (
            id,
            name,
            commission_dkk,
            revenue_dkk,
            counts_as_sale
          ),
          sales!inner (
            id,
            agent_name,
            sale_datetime,
            source
          )
        `)
        .gte('sales.sale_datetime', todayISO)
        .ilike('sales.source', '%tryg%');

      if (error) throw error;
      return data as unknown as SaleItem[];
    },
  });

  // Filter to only count items where counts_as_sale is true
  const countableSaleItems = saleItems?.filter(item => 
    item.products?.counts_as_sale === true
  ) || [];

  // Calculate totals
  const totalSales = countableSaleItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalRevenue = countableSaleItems.reduce((sum, item) => 
    sum + ((item.products?.revenue_dkk || 0) * (item.quantity || 1)), 0
  );
  const totalCommission = countableSaleItems.reduce((sum, item) => 
    sum + ((item.products?.commission_dkk || 0) * (item.quantity || 1)), 0
  );

  // Group by agent
  const agentStats: Record<string, AgentStats> = {};
  countableSaleItems.forEach(item => {
    const agentName = item.sales?.agent_name || 'Ukendt';
    if (!agentStats[agentName]) {
      agentStats[agentName] = { name: agentName, salesCount: 0, revenue: 0, commission: 0 };
    }
    agentStats[agentName].salesCount += item.quantity || 1;
    agentStats[agentName].revenue += (item.products?.revenue_dkk || 0) * (item.quantity || 1);
    agentStats[agentName].commission += (item.products?.commission_dkk || 0) * (item.quantity || 1);
  });
  const agentList = Object.values(agentStats).sort((a, b) => b.salesCount - a.salesCount);

  // Group by product
  const productStats: Record<string, ProductStats> = {};
  countableSaleItems.forEach(item => {
    const productName = item.products?.name || item.adversus_product_title || 'Ukendt produkt';
    if (!productStats[productName]) {
      productStats[productName] = { name: productName, quantity: 0, revenue: 0, commission: 0 };
    }
    productStats[productName].quantity += item.quantity || 1;
    productStats[productName].revenue += (item.products?.revenue_dkk || 0) * (item.quantity || 1);
    productStats[productName].commission += (item.products?.commission_dkk || 0) * (item.quantity || 1);
  });
  const productList = Object.values(productStats).sort((a, b) => b.quantity - a.quantity);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <DashboardHeader title="Tryg – Dagsoverblik" subtitle="Salgsdata for i dag baseret på produkt mapping" />
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
      <DashboardHeader title="Tryg – Dagsoverblik" subtitle="Salgsdata for i dag baseret på produkt mapping" />
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
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
              <div className="text-2xl font-bold">{agentList.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Omsætning</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Provision</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCommission)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Table */}
          <Card>
            <CardHeader>
              <CardTitle>Salg pr. sælger</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sælger</TableHead>
                    <TableHead className="text-right">Antal</TableHead>
                    <TableHead className="text-right">Omsætning</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Ingen salg i dag
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentList.map((agent) => (
                      <TableRow key={agent.name}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell className="text-right">{agent.salesCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(agent.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(agent.commission)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Product Table */}
          <Card>
            <CardHeader>
              <CardTitle>Solgte produkter</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produkt</TableHead>
                    <TableHead className="text-right">Antal</TableHead>
                    <TableHead className="text-right">Omsætning</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Ingen produkter solgt i dag
                      </TableCell>
                    </TableRow>
                  ) : (
                    productList.map((product) => (
                      <TableRow key={product.name}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right">{product.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(product.commission)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TrygDashboard;
