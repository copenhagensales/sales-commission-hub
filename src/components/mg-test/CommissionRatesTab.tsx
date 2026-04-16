import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";

export function CommissionRatesTab() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["commission-rates-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products for selected client
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["commission-rates-products", selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk, is_hidden, client_campaign_id, client_campaigns!inner(client_id)")
        .eq("client_campaigns.client_id", selectedClientId)
        .eq("is_hidden", false)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch active pricing rules for all products of this client
  const productIds = useMemo(() => products.map((p) => p.id), [products]);

  const { data: pricingRules = [] } = useQuery({
    queryKey: ["commission-rates-rules", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_pricing_rules")
        .select("id, product_id, name, commission_dkk, revenue_dkk, priority, campaign_mapping_ids, is_active, effective_from, effective_to")
        .in("product_id", productIds)
        .eq("is_active", true)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group rules by product_id
  const rulesByProduct = useMemo(() => {
    const map = new Map<string, typeof pricingRules>();
    for (const rule of pricingRules) {
      if (!rule.product_id) continue;
      const arr = map.get(rule.product_id) || [];
      arr.push(rule);
      map.set(rule.product_id, arr);
    }
    return map;
  }, [pricingRules]);

  const toggleProduct = (id: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fmt = (v: number | null) => (v != null ? `${v.toLocaleString("da-DK")} kr` : "–");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provisionssatser</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Vælg kunde..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClientId && productsLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Henter produkter...
          </div>
        )}

        {selectedClientId && !productsLoading && products.length === 0 && (
          <p className="text-muted-foreground text-sm py-4">Ingen produkter fundet for denne kunde.</p>
        )}

        {products.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead className="text-right">Base provision</TableHead>
                <TableHead className="text-right">Base omsætning</TableHead>
                <TableHead className="text-right">Aktive regler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const rules = rulesByProduct.get(product.id) || [];
                const isExpanded = expandedProducts.has(product.id);
                const hasRules = rules.length > 0;

                return (
                  <Collapsible key={product.id} open={isExpanded} onOpenChange={() => hasRules && toggleProduct(product.id)} asChild>
                    <>
                      <CollapsibleTrigger asChild disabled={!hasRules}>
                        <TableRow className={hasRules ? "cursor-pointer hover:bg-muted/50" : ""}>
                          <TableCell className="w-8 px-2">
                            {hasRules && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-right">{fmt(product.commission_dkk)}</TableCell>
                          <TableCell className="text-right">{fmt(product.revenue_dkk)}</TableCell>
                          <TableCell className="text-right">
                            {hasRules ? <Badge variant="secondary">{rules.length}</Badge> : <span className="text-muted-foreground">0</span>}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <>
                          {rules.map((rule) => (
                            <TableRow key={rule.id} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell className="pl-8 text-sm text-muted-foreground">
                                {rule.name || "Unavngivet regel"}
                                {rule.campaign_mapping_ids && rule.campaign_mapping_ids.length > 0 && (
                                  <Badge variant="outline" className="ml-2 text-xs">Kampagne-bundet</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm">{fmt(rule.commission_dkk)}</TableCell>
                              <TableCell className="text-right text-sm">{fmt(rule.revenue_dkk)}</TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">p:{rule.priority ?? 0}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
