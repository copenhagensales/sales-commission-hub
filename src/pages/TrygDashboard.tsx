import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Users, Package } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardDateRangePicker } from "@/components/dashboard/DashboardDateRangePicker";
import { DateRange } from "react-day-picker";

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

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value) + ' DKK';

const TrygDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: new Date()
  });

  const { data: saleItems, isLoading } = useQuery({
    queryKey: ['tryg-dashboard-sales', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!dateRange?.from) return [];
      
      const rangeStart = startOfDay(dateRange.from);
      const rangeEnd = dateRange.to ? new Date(startOfDay(dateRange.to)) : new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 1);

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
        .gte('sales.sale_datetime', rangeStart.toISOString())
        .lt('sales.sale_datetime', rangeEnd.toISOString())
        .ilike('sales.source', '%tryg%');

      if (error) throw error;
      return data as unknown as SaleItem[];
    },
    enabled: !!dateRange?.from
  });

  // Filter to only count items where counts_as_sale is true
  const countableSaleItems = saleItems?.filter(item => 
    item.products?.counts_as_sale === true
  ) || [];

  // Calculate totals and stats
  const { totalSales, totalCommission, agentList, productList } = useMemo(() => {
    const totalSales = countableSaleItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const totalCommission = countableSaleItems.reduce((sum, item) => 
      sum + ((item.products?.commission_dkk || 0) * (item.quantity || 1)), 0
    );

    // Group by agent
    const agentMap = new Map<string, AgentStats>();
    countableSaleItems.forEach(item => {
      const agentName = item.sales?.agent_name || 'Ukendt';
      const existing = agentMap.get(agentName) || { name: agentName, salesCount: 0, revenue: 0, commission: 0 };
      const qty = item.quantity || 1;
      existing.salesCount += qty;
      existing.commission += (item.products?.commission_dkk || 0) * qty;
      agentMap.set(agentName, existing);
    });

    // Group by product
    const productMap = new Map<string, ProductStats>();
    countableSaleItems.forEach(item => {
      const productName = item.products?.name || 'Ukendt produkt';
      const existing = productMap.get(productName) || { name: productName, quantity: 0, revenue: 0, commission: 0 };
      const qty = item.quantity || 1;
      existing.quantity += qty;
      existing.commission += (item.products?.commission_dkk || 0) * qty;
      productMap.set(productName, existing);
    });

    return {
      totalSales,
      totalCommission,
      agentList: Array.from(agentMap.values()).sort((a, b) => b.commission - a.commission),
      productList: Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity)
    };
  }, [countableSaleItems]);

  const getSubtitle = () => {
    if (!dateRange?.from) return "Salgsdata baseret på produkt mapping";
    const isSingleDay = !dateRange.to || startOfDay(dateRange.from).getTime() === startOfDay(dateRange.to).getTime();
    if (isSingleDay) {
      const isToday = startOfDay(dateRange.from).getTime() === startOfDay(new Date()).getTime();
      return `Salg for ${isToday ? "i dag" : format(dateRange.from, "d. MMMM yyyy", { locale: da })} • Baseret på produkt mapping`;
    }
    return `Salg fra ${format(dateRange.from, "d. MMM", { locale: da })} til ${format(dateRange.to!, "d. MMM yyyy", { locale: da })} • Baseret på produkt mapping`;
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
        <DashboardHeader title="Tryg – Overblik" subtitle="Salgsdata baseret på produkt mapping" />
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="text-2xl font-bold">{agentList.length}</div>
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
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Ingen salg registreret i perioden
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {agentList.map((agent) => (
                        <TableRow key={agent.name}>
                          <TableCell className="font-medium">{agent.name}</TableCell>
                          <TableCell className="text-right">{agent.salesCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(agent.commission)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{totalSales}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalCommission)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Product Table */}
          <Card>
            <CardHeader>
              <CardTitle>Produkter solgt</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produkt</TableHead>
                    <TableHead className="text-right">Antal</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Ingen produkter solgt i perioden
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {productList.map((product) => (
                        <TableRow key={product.name}>
                          <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                          <TableCell className="text-right">{product.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.commission)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
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
    </div>
  );
};

export default TrygDashboard;
