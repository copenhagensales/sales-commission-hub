import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  useFieldmarketingSales, 
  useFieldmarketingSalesStats,
  FIELDMARKETING_CLIENTS 
} from "@/hooks/useFieldmarketingSales";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { TrendingUp, Users, Calendar, Package, Trophy } from "lucide-react";

interface ProductCommission {
  name: string;
  commission_dkk: number;
}

const ClientDashboard = ({ clientId, clientName }: { clientId: string; clientName: string }) => {
  const { data: sales, isLoading: salesLoading } = useFieldmarketingSales(clientId);
  const { data: stats, isLoading: statsLoading } = useFieldmarketingSalesStats(clientId);

  // Fetch product commissions from product_campaign_overrides for this client
  const { data: productCommissions } = useQuery({
    queryKey: ["fieldmarketing-product-commissions", clientId],
    queryFn: async () => {
      // First get the campaign mapping for this client's fieldmarketing (e.g. "Eesy gaden")
      const { data: campaignMappings, error: mappingError } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_name, client_campaign:client_campaign_id(client_id)")
        .ilike("adversus_campaign_name", "%gaden%");
      
      if (mappingError) throw mappingError;
      
      // Find the campaign mapping for this client
      const clientCampaignMapping = campaignMappings?.find(
        (m: any) => m.client_campaign?.client_id === clientId
      );
      
      if (!clientCampaignMapping) {
        // Fallback: try to get base commission from products table
        const { data: products, error: productError } = await supabase
          .from("products")
          .select("name, commission_dkk, client_campaign:client_campaign_id(client_id)")
          .not("client_campaign_id", "is", null);
        
        if (productError) throw productError;
        
        const commissionMap: Record<string, number> = {};
        (products || []).forEach((p: any) => {
          if (p.client_campaign?.client_id === clientId) {
            commissionMap[p.name] = p.commission_dkk || 0;
          }
        });
        return commissionMap;
      }
      
      // Get campaign-specific overrides
      const { data: overrides, error: overrideError } = await supabase
        .from("product_campaign_overrides")
        .select("commission_dkk, product:product_id(name)")
        .eq("campaign_mapping_id", clientCampaignMapping.id);
      
      if (overrideError) throw overrideError;
      
      // Create a map of product name -> commission
      const commissionMap: Record<string, number> = {};
      (overrides || []).forEach((o: any) => {
        if (o.product?.name) {
          commissionMap[o.product.name] = o.commission_dkk || 0;
        }
      });
      return commissionMap;
    },
  });

  // Fetch ALL sellers with sales this month and calculate commission
  const { data: topSellers } = useQuery({
    queryKey: ["fieldmarketing-month-sellers", clientId, productCommissions],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data: monthSales, error } = await supabase
        .from("fieldmarketing_sales")
        .select(`
          seller_id,
          product_name,
          seller:employee_master_data!seller_id(first_name, last_name)
        `)
        .eq("client_id", clientId)
        .gte("registered_at", monthStart);
      
      if (error) throw error;

      // Group by seller
      const sellerStats: Record<string, { name: string; count: number; commission: number }> = {};
      (monthSales || []).forEach((sale: any) => {
        const sellerId = sale.seller_id;
        const sellerName = sale.seller ? `${sale.seller.first_name} ${sale.seller.last_name}` : "Ukendt";
        const commission = productCommissions?.[sale.product_name] || 0;
        
        if (!sellerStats[sellerId]) {
          sellerStats[sellerId] = { name: sellerName, count: 0, commission: 0 };
        }
        sellerStats[sellerId].count += 1;
        sellerStats[sellerId].commission += commission;
      });

      // Convert to array and sort by commission
      return Object.values(sellerStats).sort((a, b) => b.commission - a.commission);
    },
    enabled: !!productCommissions,
  });

  // Calculate today's sellers with sales and commission
  const { data: todaySellers } = useQuery({
    queryKey: ["fieldmarketing-today-sellers", clientId, productCommissions],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      const { data: todaySales, error } = await supabase
        .from("fieldmarketing_sales")
        .select(`
          seller_id,
          product_name,
          seller:employee_master_data!seller_id(first_name, last_name)
        `)
        .eq("client_id", clientId)
        .gte("registered_at", todayStart);
      
      if (error) throw error;

      // Group by seller
      const sellerStats: Record<string, { name: string; sales: number; commission: number }> = {};
      (todaySales || []).forEach((sale: any) => {
        const sellerId = sale.seller_id;
        const sellerName = sale.seller ? `${sale.seller.first_name} ${sale.seller.last_name}` : "Ukendt";
        const commission = productCommissions?.[sale.product_name] || 0;
        
        if (!sellerStats[sellerId]) {
          sellerStats[sellerId] = { name: sellerName, sales: 0, commission: 0 };
        }
        sellerStats[sellerId].sales += 1;
        sellerStats[sellerId].commission += commission;
      });

      // Convert to array and sort by commission
      return Object.values(sellerStats).sort((a, b) => b.commission - a.commission);
    },
    enabled: !!productCommissions,
  });

  // Calculate commission for each sale
  const salesWithCommission = sales?.map(sale => ({
    ...sale,
    commission: productCommissions?.[sale.product_name] || 0,
  }));

  if (salesLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I dag</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.salesToday || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne uge</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.salesThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denne måned</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.salesThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">salg registreret</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSales || 0}</div>
            <p className="text-xs text-muted-foreground">salg i alt</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Month Sellers Table */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Månedens sælgere</CardTitle>
          </CardHeader>
          <CardContent>
            {topSellers && topSellers.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Sælger</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSellers.map((seller, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>
                            {index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell className="text-right">{seller.count}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {seller.commission.toLocaleString("da-DK")} kr
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Ingen salg denne måned</p>
            )}
          </CardContent>
        </Card>

        {/* Today's Sellers Table */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Dagens sælgere</CardTitle>
          </CardHeader>
          <CardContent>
            {todaySellers && todaySellers.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Sælger</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaySellers.map((seller, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}>
                            {index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell className="text-right">{seller.sales}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {seller.commission.toLocaleString("da-DK")} kr
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Ingen salg registreret i dag
              </p>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Recent Sales Table with Commission */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seneste salg</CardTitle>
        </CardHeader>
        <CardContent>
          {salesWithCommission && salesWithCommission.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Sælger</TableHead>
                    <TableHead>Lokation</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesWithCommission.slice(0, 10).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {format(new Date(sale.registered_at), "dd/MM/yyyy HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell>
                        {sale.seller ? `${sale.seller.first_name} ${sale.seller.last_name}` : "-"}
                      </TableCell>
                      <TableCell>{sale.location?.name || "-"}</TableCell>
                      <TableCell>{sale.product_name}</TableCell>
                      <TableCell className="font-mono">{sale.phone_number}</TableCell>
                      <TableCell className="text-right font-mono">
                        {sale.commission.toLocaleString("da-DK")} kr
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">
              Ingen salg registreret endnu
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const TAB_TO_CLIENT_ID: Record<string, string> = {
  "eesy-fm": FIELDMARKETING_CLIENTS.EESY_FM,
  "yousee": FIELDMARKETING_CLIENTS.YOUSEE,
};

const FieldmarketingDashboard = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("eesy-fm");

  // Fetch client logos dynamically from the database
  const { data: clients } = useQuery({
    queryKey: ["fieldmarketing-clients", Object.values(FIELDMARKETING_CLIENTS)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", Object.values(FIELDMARKETING_CLIENTS));
      
      if (error) throw error;
      return data || [];
    },
  });

  const activeClientId = TAB_TO_CLIENT_ID[activeTab];
  const activeClient = clients?.find(c => c.id === activeClientId);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Fieldmarketing Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Oversigt over salg fra fieldmarketing events
            </p>
          </div>
          <div className="h-16 w-40 flex items-center justify-end">
            {activeClient?.logo_url ? (
              <img 
                src={activeClient.logo_url} 
                alt={activeClient.name} 
                className="max-h-16 max-w-40 object-contain"
              />
            ) : (
              <div className="h-16 px-6 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold text-muted-foreground">{activeClient?.name || "..."}</span>
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="eesy-fm">Eesy FM</TabsTrigger>
            <TabsTrigger value="yousee">Yousee</TabsTrigger>
          </TabsList>

          <TabsContent value="eesy-fm" className="mt-6">
            <ClientDashboard 
              clientId={FIELDMARKETING_CLIENTS.EESY_FM} 
              clientName="Eesy FM" 
            />
          </TabsContent>

          <TabsContent value="yousee" className="mt-6">
            <ClientDashboard 
              clientId={FIELDMARKETING_CLIENTS.YOUSEE} 
              clientName="Yousee" 
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default FieldmarketingDashboard;
