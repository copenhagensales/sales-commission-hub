import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, startOfDay, startOfMonth } from "date-fns";
import { Shield, TrendingUp, DollarSign, ShoppingCart } from "lucide-react";

interface CodanSaleItem {
  mapped_commission: number | null;
  mapped_revenue: number | null;
  products?: {
    name: string | null;
  } | null;
}

interface CodanSale {
  id: string;
  sale_datetime: string;
  agent_name: string | null;
  customer_company: string | null;
  client_campaigns?: {
    name: string | null;
  } | null;
  sale_items: CodanSaleItem[];
}

interface CodanStats {
  salesToday: number;
  revenueToday: number;
  commissionToday: number;
  salesThisMonth: number;
  revenueThisMonth: number;
  commissionThisMonth: number;
  avgCommissionPerSale: number;
}

interface CodanDashboardData {
  stats: CodanStats;
  recentSales: CodanSale[];
}

const initialStats: CodanStats = {
  salesToday: 0,
  revenueToday: 0,
  commissionToday: 0,
  salesThisMonth: 0,
  revenueThisMonth: 0,
  commissionThisMonth: 0,
  avgCommissionPerSale: 0,
};

const formatCurrency = (value: number) => `${value.toLocaleString("da-DK")} DKK`;

export default function Codan() {
  const { data, isLoading } = useQuery<CodanDashboardData>({
    queryKey: ["codan-dashboard"],
    queryFn: async () => {
      const today = new Date();
      const monthStart = startOfMonth(today).toISOString();
      const todayStart = startOfDay(today).toISOString();

      // Find Codan-klienten
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id")
        .eq("name", "Codan")
        .limit(1);

      if (clientsError) throw clientsError;

      const codanClientId = clients?.[0]?.id as string | undefined;

      if (!codanClientId) {
        return { stats: initialStats, recentSales: [] };
      }

      // Find alle kampagner for Codan
      const { data: campaigns, error: campaignsError } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", codanClientId);

      if (campaignsError) throw campaignsError;

      const campaignIds = (campaigns || []).map((c) => c.id as string);

      if (campaignIds.length === 0) {
        return { stats: initialStats, recentSales: [] };
      }

      // Hent alle Codan-salg fra starten af måneden
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(
          `id, sale_datetime, agent_name, customer_company,
           client_campaigns ( name ),
           sale_items ( mapped_commission, mapped_revenue, products ( name ) )`
        )
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", monthStart)
        .order("sale_datetime", { ascending: false });

      if (salesError) throw salesError;

      const codanSales = (sales || []) as unknown as CodanSale[];

      let salesThisMonth = codanSales.length;
      let revenueThisMonth = 0;
      let commissionThisMonth = 0;

      codanSales.forEach((sale) => {
        sale.sale_items?.forEach((item) => {
          revenueThisMonth += Number(item.mapped_revenue) || 0;
          commissionThisMonth += Number(item.mapped_commission) || 0;
        });
      });

      const todaysSales = codanSales.filter(
        (sale) => sale.sale_datetime && new Date(sale.sale_datetime) >= new Date(todayStart)
      );

      let revenueToday = 0;
      let commissionToday = 0;

      todaysSales.forEach((sale) => {
        sale.sale_items?.forEach((item) => {
          revenueToday += Number(item.mapped_revenue) || 0;
          commissionToday += Number(item.mapped_commission) || 0;
        });
      });

      const stats: CodanStats = {
        salesToday: todaysSales.length,
        revenueToday,
        commissionToday,
        salesThisMonth,
        revenueThisMonth,
        commissionThisMonth,
        avgCommissionPerSale: salesThisMonth > 0 ? commissionThisMonth / salesThisMonth : 0,
      };

      const recentSales = codanSales.slice(0, 25);

      return { stats, recentSales };
    },
  });

  const stats = data?.stats ?? initialStats;
  const recentSales = data?.recentSales ?? [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">Codan – salgsdashboard</h1>
            <p className="text-muted-foreground">
              Live overblik over salg, omsætning og provision for kunden Codan.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Kunde: Codan</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salg i dag</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.salesToday}</div>
              <p className="text-xs text-muted-foreground mt-1">Antal registrerede Codan-salg i dag</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Omsætning i dag</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.revenueToday)}</div>
              <p className="text-xs text-muted-foreground mt-1">Baseret på mappede produkter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Omsætning denne måned</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.revenueThisMonth)}</div>
              <p className="text-xs text-muted-foreground mt-1">Alle Codan-salg fra månedens start</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gns. provision pr. salg</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.avgCommissionPerSale)}</div>
              <p className="text-xs text-muted-foreground mt-1">Beregnet på månedens Codan-salg</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seneste Codan-salg</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Indlæser Codan-data...</div>
            ) : recentSales.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Ingen registrerede Codan-salg endnu. Sørg for at kampagner for Codan er korrekt mappet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Kampagne</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Produkter</TableHead>
                    <TableHead className="text-right">Omsætning</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale) => {
                    let saleRevenue = 0;
                    let saleCommission = 0;

                    sale.sale_items?.forEach((item) => {
                      saleRevenue += Number(item.mapped_revenue) || 0;
                      saleCommission += Number(item.mapped_commission) || 0;
                    });

                    return (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.sale_datetime), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>{sale.client_campaigns?.name || "—"}</TableCell>
                        <TableCell>{sale.customer_company || "—"}</TableCell>
                        <TableCell>{sale.agent_name || "—"}</TableCell>
                        <TableCell>
                          {sale.sale_items?.map((item, index) => (
                            <Badge key={index} variant="secondary" className="mr-1 text-xs">
                              {item.products?.name || "Ukendt produkt"}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(saleRevenue)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(saleCommission)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
