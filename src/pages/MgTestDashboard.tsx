import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Users, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Client brand colors for visual distinction
const clientColors: Record<string, { bg: string; accent: string; text: string }> = {
  "TDC Erhverv": { bg: "from-violet-600/20 to-violet-900/40", accent: "bg-violet-500", text: "text-violet-300" },
  "CODAN": { bg: "from-emerald-600/20 to-emerald-900/40", accent: "bg-emerald-500", text: "text-emerald-300" },
  "Finansforbundet": { bg: "from-blue-600/20 to-blue-900/40", accent: "bg-blue-500", text: "text-blue-300" },
  "Business DK": { bg: "from-amber-600/20 to-amber-900/40", accent: "bg-amber-500", text: "text-amber-300" },
  "Tryg": { bg: "from-rose-600/20 to-rose-900/40", accent: "bg-rose-500", text: "text-rose-300" },
  "Yousee": { bg: "from-cyan-600/20 to-cyan-900/40", accent: "bg-cyan-500", text: "text-cyan-300" },
  "Relatel": { bg: "from-orange-600/20 to-orange-900/40", accent: "bg-orange-500", text: "text-orange-300" },
  "Ase": { bg: "from-pink-600/20 to-pink-900/40", accent: "bg-pink-500", text: "text-pink-300" },
  "AKA": { bg: "from-indigo-600/20 to-indigo-900/40", accent: "bg-indigo-500", text: "text-indigo-300" },
  "A&Til": { bg: "from-teal-600/20 to-teal-900/40", accent: "bg-teal-500", text: "text-teal-300" },
  "eesy FM Gaden": { bg: "from-lime-600/20 to-lime-900/40", accent: "bg-lime-500", text: "text-lime-300" },
  "Eesy FM Marked": { bg: "from-lime-600/20 to-lime-900/40", accent: "bg-lime-500", text: "text-lime-300" },
  "Eesy TM": { bg: "from-lime-600/20 to-lime-900/40", accent: "bg-lime-500", text: "text-lime-300" },
};

const defaultColors = { bg: "from-slate-600/20 to-slate-900/40", accent: "bg-slate-500", text: "text-slate-300" };

interface ClientStats {
  id: string;
  name: string;
  salesToday: number;
  salesThisMonth: number;
  totalCommission: number;
  totalRevenue: number;
  topSellers: { name: string; sales: number }[];
}

export default function MgTestDashboard() {
  const { data: clientStats, isLoading } = useQuery({
    queryKey: ["mg-test-dashboard-clients"],
    queryFn: async () => {
      // Fetch all clients
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");

      if (clientsError) throw clientsError;

      // Fetch all sale items with sales and campaign info
      // Use left join for products since some items may not have mapped products yet
      const { data: saleItems, error: saleItemsError } = await supabase
        .from("sale_items")
        .select(`
          id,
          quantity,
          mapped_commission,
          mapped_revenue,
          product_id,
          products(
            id,
            counts_as_sale
          ),
          sales!inner(
            id,
            sale_datetime,
            agent_name,
            client_campaign_id
          )
        `);

      if (saleItemsError) throw saleItemsError;

      // Filter: only include items where product is mapped AND counts_as_sale is true
      const filteredSaleItems = saleItems?.filter((item: any) => {
        if (!item.products) return false; // No product mapped = exclude
        return item.products.counts_as_sale === true;
      }) || [];

      // Fetch campaign to client mapping
      const { data: campaigns, error: campaignsError } = await supabase
        .from("client_campaigns")
        .select("id, client_id");

      if (campaignsError) throw campaignsError;

      const campaignToClient = new Map(campaigns?.map(c => [c.id, c.client_id]) || []);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Process stats for each client
      const stats: ClientStats[] = clients?.map(client => {
        const clientSaleItems = filteredSaleItems.filter((item: any) => {
          const campaignId = item.sales?.client_campaign_id;
          return campaignToClient.get(campaignId) === client.id;
        });

        let salesToday = 0;
        let salesThisMonth = 0;
        let totalCommission = 0;
        let totalRevenue = 0;
        const sellerMap = new Map<string, number>();

        clientSaleItems.forEach((item: any) => {
          const qty = item.quantity || 1;
          const commission = (item.mapped_commission || 0) * qty;
          const revenue = (item.mapped_revenue || 0) * qty;
          const saleDate = new Date(item.sales.sale_datetime);
          const agentName = item.sales.agent_name || "Ukendt";

          totalCommission += commission;
          totalRevenue += revenue;

          if (saleDate >= startOfToday) {
            salesToday += qty;
          }
          if (saleDate >= startOfMonth) {
            salesThisMonth += qty;
            sellerMap.set(agentName, (sellerMap.get(agentName) || 0) + qty);
          }
        });

        // Get top 3 sellers
        const topSellers = Array.from(sellerMap.entries())
          .map(([name, sales]) => ({ name, sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 3);

        return {
          id: client.id,
          name: client.name,
          salesToday,
          salesThisMonth,
          totalCommission,
          totalRevenue,
          topSellers,
        };
      }) || [];

      // Sort by sales this month, descending
      return stats.sort((a, b) => b.salesThisMonth - a.salesThisMonth);
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

  // Show all clients (sorted by sales this month)
  const allClients = clientStats || [];
  const totalSalesToday = allClients.reduce((sum, c) => sum + c.salesToday, 0);
  const totalSalesMonth = allClients.reduce((sum, c) => sum + c.salesThisMonth, 0);

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header with totals */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Test Dashboard</h1>
              <p className="text-muted-foreground mt-1">Kundeoversigt med salgsperformance</p>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Salg i dag</p>
                <p className="text-3xl font-bold text-primary">{isLoading ? "..." : totalSalesToday}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Salg denne måned</p>
                <p className="text-3xl font-bold">{isLoading ? "..." : totalSalesMonth}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Client cards grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-8 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-6 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {allClients.map((client, index) => {
              const colors = clientColors[client.name] || defaultColors;
              const medals = ["🥇", "🥈", "🥉"];
              
              return (
                <Card 
                  key={client.id} 
                  className={`relative overflow-hidden border-0 bg-gradient-to-br ${colors.bg} backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}
                >
                  {/* Decorative accent bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${colors.accent}`} />
                  
                  {/* Rank badge for top 3 */}
                  {index < 3 && (
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="text-lg px-3 py-1 font-bold bg-background/80 backdrop-blur">
                        #{index + 1}
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${colors.accent} flex items-center justify-center shadow-lg`}>
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{client.name}</CardTitle>
                        <p className={`text-sm ${colors.text}`}>
                          {formatCurrency(client.totalRevenue)} omsætning
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Sales stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-background/30 backdrop-blur rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">I dag</p>
                        <p className="text-2xl font-bold">{client.salesToday}</p>
                      </div>
                      <div className="bg-background/30 backdrop-blur rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Denne måned</p>
                        <p className="text-2xl font-bold">{client.salesThisMonth}</p>
                      </div>
                    </div>
                    
                    {/* Top 3 sellers */}
                    {client.topSellers.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Trophy className="w-4 h-4" />
                          <span>Top sælgere denne måned</span>
                        </div>
                        <div className="space-y-1.5">
                          {client.topSellers.map((seller, i) => (
                            <div 
                              key={seller.name} 
                              className="flex items-center justify-between bg-background/20 backdrop-blur rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{medals[i]}</span>
                                <span className="font-medium truncate max-w-[140px]">{seller.name}</span>
                              </div>
                              <Badge variant="secondary" className="font-bold">
                                {seller.sales} salg
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allClients.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Ingen salgsdata fundet</h3>
            <p className="text-muted-foreground">Der er ingen kunder med salg denne måned.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
