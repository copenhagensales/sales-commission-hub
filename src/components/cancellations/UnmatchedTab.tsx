import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";

function extractOpp(rawPayload: unknown): string {
  if (!rawPayload || typeof rawPayload !== "object") return "";
  const rp = rawPayload as Record<string, unknown>;
  if (rp["legacy_opp_number"]) return String(rp["legacy_opp_number"]);
  const fields = rp["leadResultFields"] as Record<string, unknown> | undefined;
  if (fields?.["OPP nr"]) return String(fields["OPP nr"]);
  if (fields?.["OPP-nr"]) return String(fields["OPP-nr"]);
  const dataArr = rp["leadResultData"] as Array<{ label?: string; value?: string }> | undefined;
  if (Array.isArray(dataArr)) {
    const found = dataArr.find(d => d.label === "OPP nr" || d.label === "OPP-nr");
    if (found?.value) return String(found.value);
  }
  return "";
}

interface UnmatchedTabProps {
  clientId: string;
}

export function UnmatchedTab({ clientId }: UnmatchedTabProps) {
  // 1. Get campaign IDs for client
  const { data: campaignIds = [] } = useQuery({
    queryKey: ["client-campaigns-ids", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data || []).map(c => c.id);
    },
    enabled: !!clientId,
  });

  // 2. Get all sale_ids in cancellation_queue
  const { data: queueSaleIds = [] } = useQuery({
    queryKey: ["cancellation-queue-all-sale-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_queue")
        .select("sale_id");
      if (error) throw error;
      return (data || []).map(q => q.sale_id);
    },
  });

  const queueSaleIdSet = new Set(queueSaleIds);

  // 3. Get pending sales for this client, excluding those in queue
  const { data: pendingSales = [], isLoading } = useQuery({
    queryKey: ["pending-sales-not-in-queue", clientId, campaignIds, queueSaleIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];

      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, sale_datetime, customer_phone, customer_company, agent_name, raw_payload, client_campaign_id")
        .in("client_campaign_id", campaignIds)
        .eq("validation_status", "pending")
        .order("sale_datetime", { ascending: false })
        .limit(2000);
      if (error) throw error;

      const filtered = (sales || []).filter(s => !queueSaleIdSet.has(s.id));

      // Fetch sale_items for display
      if (filtered.length > 0) {
        const saleIds = filtered.map(s => s.id);
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, quantity, mapped_commission, mapped_revenue, product:products(name)")
          .in("sale_id", saleIds.slice(0, 500));

        const itemsBySale: Record<string, typeof items> = {};
        (items || []).forEach(item => {
          if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
          itemsBySale[item.sale_id].push(item);
        });

        return filtered.map(s => ({ ...s, saleItems: itemsBySale[s.id] || [] }));
      }

      return filtered.map(s => ({ ...s, saleItems: [] as any[] }));
    },
    enabled: !!clientId && campaignIds.length > 0,
  });

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Vælg en kunde i toppen for at se afventende salg.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Afventende salg
          <Badge variant="secondary">{pendingSales.length}</Badge>
        </CardTitle>
        <CardDescription>
          Salg med status "pending" som endnu ikke er i annullerings- eller kurvrettelseskøen
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : pendingSales.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <AlertCircle className="h-4 w-4" />
            <span>Ingen afventende salg for denne kunde.</span>
          </div>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dato</TableHead>
                  <TableHead>Sælger</TableHead>
                  <TableHead>OPP</TableHead>
                  <TableHead>Produkter</TableHead>
                  <TableHead>Omsætning</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Virksomhed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingSales.map(sale => {
                  const products = (sale.saleItems || [])
                    .map((si: any) => si.product?.name || "Ukendt")
                    .filter(Boolean);
                  const revenue = (sale.saleItems || [])
                    .reduce((sum: number, si: any) => sum + (si.mapped_revenue || 0), 0);
                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap">
                        {sale.sale_datetime ? format(new Date(sale.sale_datetime), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>{sale.agent_name || "-"}</TableCell>
                      <TableCell>{extractOpp(sale.raw_payload) || "-"}</TableCell>
                      <TableCell>
                        {products.length > 0
                          ? products.map((p: string, i: number) => (
                              <Badge key={i} variant="outline" className="mr-1 mb-1">{p}</Badge>
                            ))
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="font-mono">
                        {revenue > 0 ? `${Math.round(revenue).toLocaleString("da-DK")} kr` : "-"}
                      </TableCell>
                      <TableCell>{sale.customer_phone || "-"}</TableCell>
                      <TableCell>{sale.customer_company || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
