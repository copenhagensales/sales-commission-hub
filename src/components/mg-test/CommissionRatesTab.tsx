import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Loader2, Search, ChevronsUpDown } from "lucide-react";

interface GroupedProduct {
  name: string;
  baseCommission: number | null;
  baseRevenue: number | null;
  productIds: string[];
  rules: ResolvedRule[];
}

interface ResolvedRule {
  id: string;
  name: string | null;
  commission_dkk: number | null;
  revenue_dkk: number | null;
  priority: number | null;
  campaignNames: string[];
}

export function CommissionRatesTab() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

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
        .select("id, name, commission_dkk, revenue_dkk, is_hidden, client_campaign_id, client_campaigns(client_id)")
        .eq("is_hidden", false)
        .order("name");
      if (error) throw error;
      // Filter client-side: include products whose campaign belongs to selected client
      return data.filter((p: any) => {
        const cc = p.client_campaigns;
        if (!cc) return false;
        // cc can be an object or array depending on the join
        if (Array.isArray(cc)) return cc.some((c: any) => c.client_id === selectedClientId);
        return cc.client_id === selectedClientId;
      });
    },
  });

  // Fetch campaign mappings for resolving names
  const { data: campaignMappings = [] } = useQuery({
    queryKey: ["commission-rates-campaign-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_name");
      if (error) throw error;
      return data;
    },
  });

  const campaignNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cm of campaignMappings) {
      map.set(cm.id, cm.adversus_campaign_name || "Ukendt kampagne");
    }
    return map;
  }, [campaignMappings]);

  // Fetch active pricing rules
  const productIds = useMemo(() => products.map((p) => p.id), [products]);

  const { data: pricingRules = [] } = useQuery({
    queryKey: ["commission-rates-rules", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_pricing_rules")
        .select("id, product_id, name, commission_dkk, revenue_dkk, priority, campaign_mapping_ids, is_active")
        .in("product_id", productIds)
        .eq("is_active", true)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group products by name and resolve rules
  const groupedProducts = useMemo(() => {
    const map = new Map<string, GroupedProduct>();

    for (const product of products) {
      const existing = map.get(product.name);
      if (existing) {
        existing.productIds.push(product.id);
      } else {
        map.set(product.name, {
          name: product.name,
          baseCommission: product.commission_dkk,
          baseRevenue: product.revenue_dkk,
          productIds: [product.id],
          rules: [],
        });
      }
    }

    // Attach resolved rules
    for (const rule of pricingRules) {
      if (!rule.product_id) continue;
      // Find which group this rule belongs to
      for (const group of map.values()) {
        if (group.productIds.includes(rule.product_id)) {
          const campaignIds = (rule.campaign_mapping_ids as string[] | null) || [];
          const campaignNames = campaignIds
            .map((id) => campaignNameMap.get(id))
            .filter(Boolean) as string[];

          // Deduplicate: don't add if identical rule already exists (same commission + revenue + campaigns)
          const isDuplicate = group.rules.some(
            (r) =>
              r.commission_dkk === rule.commission_dkk &&
              r.revenue_dkk === rule.revenue_dkk &&
              r.campaignNames.join(",") === campaignNames.join(",")
          );

          if (!isDuplicate) {
            group.rules.push({
              id: rule.id,
              name: rule.name,
              commission_dkk: rule.commission_dkk,
              revenue_dkk: rule.revenue_dkk,
              priority: rule.priority,
              campaignNames,
            });
          }
          break;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "da"));
  }, [products, pricingRules, campaignNameMap]);

  // Filter by search
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return groupedProducts;
    const term = searchTerm.toLowerCase();
    return groupedProducts.filter((g) => g.name.toLowerCase().includes(term));
  }, [groupedProducts, searchTerm]);

  const toggleProduct = (name: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    const expandable = filteredProducts.filter((g) => g.rules.length > 0);
    const allExpanded = expandable.every((g) => expandedProducts.has(g.name));
    if (allExpanded) {
      setExpandedProducts(new Set());
    } else {
      setExpandedProducts(new Set(expandable.map((g) => g.name)));
    }
  };

  const fmt = (v: number | null) => (v != null ? `${v.toLocaleString("da-DK")} kr` : "–");

  const diffLabel = (ruleVal: number | null, baseVal: number | null) => {
    if (ruleVal == null || baseVal == null) return null;
    const diff = ruleVal - baseVal;
    if (diff === 0) return null;
    return diff > 0
      ? { text: `▲${diff.toLocaleString("da-DK")}`, className: "text-green-600" }
      : { text: `▼${Math.abs(diff).toLocaleString("da-DK")}`, className: "text-red-500" };
  };

  const totalRules = filteredProducts.reduce((sum, g) => sum + g.rules.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provisionssatser</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setSearchTerm(""); setExpandedProducts(new Set()); }}>
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

          {filteredProducts.length > 0 && (
            <>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg produkter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {totalRules > 0 && (
                <Button variant="outline" size="sm" onClick={toggleAll} className="gap-1.5">
                  <ChevronsUpDown className="h-4 w-4" />
                  {filteredProducts.filter((g) => g.rules.length > 0).every((g) => expandedProducts.has(g.name))
                    ? "Luk alle"
                    : "Udvid alle"}
                </Button>
              )}
              <span className="text-sm text-muted-foreground ml-auto">
                {filteredProducts.length} produkter · {totalRules} regler
              </span>
            </>
          )}
        </div>

        {selectedClientId && productsLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Henter produkter...
          </div>
        )}

        {selectedClientId && !productsLoading && products.length === 0 && (
          <p className="text-muted-foreground text-sm py-4">Ingen produkter fundet for denne kunde.</p>
        )}

        {filteredProducts.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead className="text-right w-32">Provision</TableHead>
                  <TableHead className="text-right w-32">Omsætning</TableHead>
                  <TableHead className="text-right w-24">Regler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((group) => {
                  const hasRules = group.rules.length > 0;
                  const isExpanded = expandedProducts.has(group.name);

                  return (
                    <>{/* Fragment for product row + expanded rules */}
                      <TableRow
                        key={group.name}
                        className={hasRules ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => hasRules && toggleProduct(group.name)}
                      >
                        <TableCell className="w-8 px-2">
                          {hasRules && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                        </TableCell>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell className="text-right">{fmt(group.baseCommission)}</TableCell>
                        <TableCell className="text-right">{fmt(group.baseRevenue)}</TableCell>
                        <TableCell className="text-right">
                          {hasRules ? (
                            <Badge variant="secondary">{group.rules.length}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {isExpanded && group.rules.map((rule) => {
                        const commDiff = diffLabel(rule.commission_dkk, group.baseCommission);
                        const revDiff = diffLabel(rule.revenue_dkk, group.baseRevenue);
                        const label = rule.campaignNames.length > 0
                          ? rule.campaignNames.join(", ")
                          : rule.name || "Prisregel";

                        return (
                          <TableRow key={rule.id} className="bg-muted/20 hover:bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell className="pl-8">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">├</span>
                                <span className="text-sm">{label}</span>
                                {rule.campaignNames.map((cn) => (
                                  <Badge key={cn} variant="outline" className="text-xs font-normal">
                                    {cn}
                                  </Badge>
                                ))}
                                {rule.priority != null && rule.priority > 0 && (
                                  <span className="text-xs text-muted-foreground">p:{rule.priority}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <div className="flex items-center justify-end gap-1.5">
                                {fmt(rule.commission_dkk)}
                                {commDiff && (
                                  <span className={`text-xs font-medium ${commDiff.className}`}>
                                    {commDiff.text}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <div className="flex items-center justify-end gap-1.5">
                                {fmt(rule.revenue_dkk)}
                                {revDiff && (
                                  <span className={`text-xs font-medium ${revDiff.className}`}>
                                    {revDiff.text}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        );
                      })}
                    </>
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
