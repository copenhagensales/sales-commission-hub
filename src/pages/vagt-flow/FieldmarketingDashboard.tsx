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
import { TrendingUp, Users, Calendar, Package } from "lucide-react";

const ClientDashboard = ({ clientId, clientName }: { clientId: string; clientName: string }) => {
  const { data: sales, isLoading: salesLoading } = useFieldmarketingSales(clientId);
  const { data: stats, isLoading: statsLoading } = useFieldmarketingSalesStats(clientId);

  // Fetch seller names for top sellers
  const { data: topSellers } = useQuery({
    queryKey: ["fieldmarketing-top-sellers", clientId, stats?.topSellerIds],
    queryFn: async () => {
      if (!stats?.topSellerIds?.length) return [];
      
      const sellerIds = stats.topSellerIds.map(s => s.sellerId);
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", sellerIds);
      
      if (error) throw error;
      
      return stats.topSellerIds.map(ts => {
        const seller = data?.find(s => s.id === ts.sellerId);
        return {
          name: seller ? `${seller.first_name} ${seller.last_name}` : "Ukendt",
          count: ts.count,
        };
      });
    },
    enabled: !!stats?.topSellerIds?.length,
  });

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
        {/* Top Sellers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top sælgere (måned)</CardTitle>
          </CardHeader>
          <CardContent>
            {topSellers && topSellers.length > 0 ? (
              <div className="space-y-3">
                {topSellers.map((seller, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        #{index + 1}
                      </Badge>
                      <span className="font-medium">{seller.name}</span>
                    </div>
                    <span className="text-muted-foreground">{seller.count} salg</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Ingen salg denne måned</p>
            )}
          </CardContent>
        </Card>

        {/* Product Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produktfordeling (måned)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.productDistribution && stats.productDistribution.length > 0 ? (
              <div className="space-y-3">
                {stats.productDistribution.slice(0, 5).map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="font-medium truncate max-w-[200px]">{product.productName}</span>
                    <Badge variant="outline">{product.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Ingen produkter denne måned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seneste salg</CardTitle>
        </CardHeader>
        <CardContent>
          {sales && sales.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Sælger</TableHead>
                    <TableHead>Lokation</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Telefon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.slice(0, 10).map((sale) => (
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

const FieldmarketingDashboard = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("eesy-fm");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Fieldmarketing Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Oversigt over salg fra fieldmarketing events
          </p>
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
