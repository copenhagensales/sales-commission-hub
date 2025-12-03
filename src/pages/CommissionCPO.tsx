import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignMapping {
  id: string;
  adversus_campaign_id: string;
  adversus_campaign_name: string;
  adversus_outcome: string | null;
  product_id: string | null;
  liquidity_customer_id: string | null;
  created_at: string;
  products?: {
    name: string;
    commission_value: number | null;
    commission_type: string | null;
    revenue_amount: number | null;
  } | null;
  liquidity_customers?: {
    name: string;
  } | null;
}

export default function CommissionCPO() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaign-mappings-with-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_product_mappings")
        .select(`
          *,
          products (
            name,
            commission_value,
            commission_type,
            revenue_amount
          ),
          liquidity_customers (
            name
          )
        `)
        .order("adversus_campaign_name");

      if (error) throw error;
      return data as CampaignMapping[];
    },
  });

  // Group campaigns by campaign name
  const groupedCampaigns = campaigns?.reduce((acc, campaign) => {
    const key = campaign.adversus_campaign_name;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(campaign);
    return acc;
  }, {} as Record<string, CampaignMapping[]>);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provision og CPO</h1>
          <p className="text-muted-foreground">
            Oversigt over alle kampagner og deres provisions- og CPO-indstillinger
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedCampaigns && Object.entries(groupedCampaigns).map(([campaignName, mappings]) => (
              <Card key={campaignName}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {campaignName}
                    <Badge variant="secondary" className="ml-2">
                      {mappings.length} {mappings.length === 1 ? "mapping" : "mappings"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Outcome / Produkt</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Provision</TableHead>
                        <TableHead>CPO (Omsætning)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((mapping) => (
                        <TableRow key={mapping.id}>
                          <TableCell>
                            <div className="space-y-1">
                              {mapping.adversus_outcome && (
                                <span className="text-sm text-muted-foreground block">
                                  {mapping.adversus_outcome}
                                </span>
                              )}
                              <span className="font-medium">
                                {mapping.products?.name || "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {mapping.liquidity_customers?.name || "-"}
                          </TableCell>
                          <TableCell>
                            {mapping.products?.commission_type === "percentage" 
                              ? `${mapping.products.commission_value}%`
                              : formatCurrency(mapping.products?.commission_value)
                            }
                          </TableCell>
                          <TableCell>
                            {formatCurrency(mapping.products?.revenue_amount)}
                          </TableCell>
                          <TableCell>
                            {mapping.product_id ? (
                              <Badge variant="default" className="bg-green-600">
                                Konfigureret
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                Mangler produkt
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}

            {(!groupedCampaigns || Object.keys(groupedCampaigns).length === 0) && (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Ingen kampagner fundet. Kør en synkronisering fra Indstillinger for at hente kampagner.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
