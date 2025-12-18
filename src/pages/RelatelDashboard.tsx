import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { Users, Package, DollarSign, ShoppingCart, TrendingUp, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ["relatel-today-dashboard", selectedDate.toDateString()],
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

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

      // Fetch today's sales with product mappings
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
        .gte("sale_datetime", dayStart.toISOString())
        .lt("sale_datetime", dayEnd.toISOString())
        .order("sale_datetime", { ascending: false });

      return { sales: sales || [], campaignIds };
    },
    refetchInterval: 30000,
  });

  const { totalSales, totalRevenue, totalCommission, agentStats, productStats } = useMemo(() => {
    if (!data?.sales?.length) {
      return {
        totalSales: 0,
        totalRevenue: 0,
        totalCommission: 0,
        agentStats: [],
        productStats: [],
      };
    }

    let totalSales = 0;
    let totalRevenue = 0;
    let totalCommission = 0;
    const agentMap = new Map<string, AgentStat>();
    const productMap = new Map<string, ProductStat>();

    data.sales.forEach((sale: any) => {
      const agentName = sale.agent_name?.trim() || "Ukendt";
      
      (sale.sale_items || []).forEach((item: any) => {
        const product = item.products;
        
        // Skip items without a mapped product or with counts_as_sale = false
        if (!product || product.counts_as_sale === false) return;

        const qty = Number(item.quantity) || 1;
        const itemCommission = qty * (Number(product?.commission_dkk) || Number(item.mapped_commission) || 0);
        const itemRevenue = qty * (Number(product?.revenue_dkk) || Number(item.mapped_revenue) || 0);
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

    const agentStats = Array.from(agentMap.values()).sort((a, b) => b.commission - a.commission);
    const productStats = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity);

    return { totalSales, totalRevenue, totalCommission, agentStats, productStats };
  }, [data]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatel – Dagsoverblik</h1>
            <p className="text-muted-foreground">
              Baseret på produkt-mapping fra MG Test
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "EEEE d. MMMM yyyy", { locale: da })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="pointer-events-auto"
                locale={da}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <CardTitle className="text-sm font-medium">Omsætning</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Fra mappede produkter</p>
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
                <p className="text-center text-muted-foreground py-8">Ingen salg registreret denne dag</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sælger</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Omsætning</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentStats.map((agent) => (
                      <TableRow key={agent.name}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{agent.salesCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(agent.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(agent.commission)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">{totalSales}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(totalRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(totalCommission)}</TableCell>
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
                Solgte produkter
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Indlæser...</p>
              ) : productStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen produkter solgt denne dag</p>
              ) : (
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
                    {productStats.map((product) => (
                      <TableRow key={product.name}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{product.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(product.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(product.commission)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">{totalSales}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(totalRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(totalCommission)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
