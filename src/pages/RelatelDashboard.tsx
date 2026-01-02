import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { Users, Package, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardDateRangePicker } from "@/components/dashboard/DashboardDateRangePicker";
import { DateRange } from "react-day-picker";

interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
  commission: number;
}

interface AgentStat {
  name: string;
  salesCount: number;
  revenue: number;
  commission: number;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('da-DK', { style: 'decimal', maximumFractionDigits: 0 }).format(value) + ' DKK';

export default function RelatelDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: new Date()
  });

  const { data, isLoading } = useQuery({
    queryKey: ["relatel-dashboard", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!dateRange?.from) return { sales: [], campaignIds: [] };
      
      const rangeStart = startOfDay(dateRange.from);
      const rangeEnd = dateRange.to ? new Date(startOfDay(dateRange.to)) : new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 1);

      // Find Relatel client
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", "%relatel%")
        .limit(1);

      const clientId = clients?.[0]?.id;
      if (!clientId) return { sales: [], campaignIds: [] };

      // Get campaigns
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);

      const campaignIds = (campaigns || []).map(c => c.id);
      if (campaignIds.length === 0) return { sales: [], campaignIds: [] };

      // Fetch sales for date range with product mappings
      const { data: sales } = await supabase
        .from("sales")
        .select(`
          id, 
          sale_datetime, 
          agent_name,
          sale_items (
            id,
            quantity,
            mapped_commission,
            mapped_revenue,
            product_id,
            products (
              id,
              name,
              commission_dkk,
              revenue_dkk,
              counts_as_sale
            )
          )
        `)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", rangeStart.toISOString())
        .lt("sale_datetime", rangeEnd.toISOString())
        .order("sale_datetime", { ascending: false });

      return { sales: sales || [], campaignIds };
    },
    enabled: !!dateRange?.from
  });

  // Process stats
  const { agentStats, productStats, totalSales, totalRevenue, totalCommission } = useMemo(() => {
    const agentMap = new Map<string, AgentStat>();
    const productMap = new Map<string, ProductStat>();
    let totalSales = 0;
    let totalRevenue = 0;
    let totalCommission = 0;

    (data?.sales || []).forEach((sale: any) => {
      const agentName = sale.agent_name?.trim() || "Ukendt";

      (sale.sale_items || []).forEach((item: any) => {
        const product = item.products;
        
        // Skip items without a mapped product or with counts_as_sale = false
        if (!product || product.counts_as_sale === false) return;

        const qty = Number(item.quantity) || 1;
        // Use products table values (base) × qty, or mapped values directly (already includes qty)
        const itemCommission = product?.commission_dkk 
          ? qty * Number(product.commission_dkk) 
          : (Number(item.mapped_commission) || 0);
        const itemRevenue = product?.revenue_dkk 
          ? qty * Number(product.revenue_dkk) 
          : (Number(item.mapped_revenue) || 0);
        const productName = product?.name || "Ukendt produkt";

        totalSales += qty;
        totalCommission += itemCommission;
        totalRevenue += itemRevenue;

        const existing = agentMap.get(agentName) || { name: agentName, salesCount: 0, revenue: 0, commission: 0 };
        existing.salesCount += qty;
        existing.revenue += itemRevenue;
        existing.commission += itemCommission;
        agentMap.set(agentName, existing);

        const productStat = productMap.get(productName) || { name: productName, quantity: 0, revenue: 0, commission: 0 };
        productStat.quantity += qty;
        productStat.revenue += itemRevenue;
        productStat.commission += itemCommission;
        productMap.set(productName, productStat);
      });
    });

    return {
      agentStats: Array.from(agentMap.values()).sort((a, b) => b.commission - a.commission),
      productStats: Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity),
      totalSales,
      totalRevenue,
      totalCommission
    };
  }, [data?.sales]);

  const getSubtitle = () => {
    if (!dateRange?.from) return "Baseret på produkt-mapping fra MG Test";
    const isSingleDay = !dateRange.to || startOfDay(dateRange.from).getTime() === startOfDay(dateRange.to).getTime();
    if (isSingleDay) {
      return `Salg for ${format(dateRange.from, "d. MMMM yyyy", { locale: da })} • Baseret på produkt-mapping fra MG Test`;
    }
    return `Salg fra ${format(dateRange.from, "d. MMM", { locale: da })} til ${format(dateRange.to!, "d. MMM yyyy", { locale: da })} • Baseret på produkt-mapping fra MG Test`;
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Antal salg</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{totalSales}</div>
              <p className="text-xs text-muted-foreground mt-1">Kun produkter markeret som salg</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Provision</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totalCommission)}</div>
              <p className="text-xs text-muted-foreground mt-1">Fra mappede produkter</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
              ) : agentStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen salg registreret i perioden</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sælger</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentStats.map(agent => (
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
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Produkter solgt
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : productStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen produkter solgt i perioden</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produkt</TableHead>
                      <TableHead className="text-right">Antal</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productStats.map(product => (
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
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
