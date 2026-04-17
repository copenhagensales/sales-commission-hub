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

interface ResolvedRule {
  id: string;
  name: string | null;
  commission_dkk: number | null;
  revenue_dkk: number | null;
  priority: number | null;
  effective_from: string | null;
  effective_to: string | null;
  conditions: any;
  campaignNames: string[];
  productName: string; // which (parent or variant) product this rule belongs to
  isFromVariant: boolean;
}

interface ProductRow {
  id: string; // parent product id
  name: string;
  baseCommission: number | null;
  baseRevenue: number | null;
  variantNames: string[]; // names of merged children
  variantIds: string[];
  rules: ResolvedRule[];
}

const fmtDate = (s: string | null) => {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return s;
  }
};

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

  // Fetch products belonging to selected client (children of merge groups too)
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["commission-rates-products", selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      // 1. All non-hidden products with their client info
      const { data: allRaw, error } = await supabase
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk, is_hidden, merged_into_product_id, client_campaign_id, client_campaigns(client_id)")
        .eq("is_hidden", false)
        .order("name");
      if (error) throw error;

      const belongsToClient = (p: any) => {
        const cc = p.client_campaigns;
        if (!cc) return false;
        if (Array.isArray(cc)) return cc.some((c: any) => c.client_id === selectedClientId);
        return cc.client_id === selectedClientId;
      };

      // 2. Products directly tied to client
      const directlyOwned = (allRaw || []).filter(belongsToClient);

      // 3. Parent products of any merged children that belong to client
      //    (parents may have no client_campaign themselves — they're cross-client merge targets)
      const parentIdsNeeded = new Set<string>();
      for (const p of directlyOwned) {
        if (p.merged_into_product_id) parentIdsNeeded.add(p.merged_into_product_id);
      }
      const ownedIds = new Set(directlyOwned.map((p: any) => p.id));
      const extraParents = (allRaw || []).filter(
        (p: any) => parentIdsNeeded.has(p.id) && !ownedIds.has(p.id)
      );

      return [...directlyOwned, ...extraParents];
    },
  });

  // Split parents vs children
  const { parents, childrenByParent } = useMemo(() => {
    const parents = allProducts.filter((p: any) => !p.merged_into_product_id);
    const childrenByParent = new Map<string, any[]>();
    for (const p of allProducts) {
      if (p.merged_into_product_id) {
        const arr = childrenByParent.get(p.merged_into_product_id) || [];
        arr.push(p);
        childrenByParent.set(p.merged_into_product_id, arr);
      }
    }
    return { parents, childrenByParent };
  }, [allProducts]);

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

  // Fetch active pricing rules for ALL products (parents + children)
  const allProductIds = useMemo(() => allProducts.map((p: any) => p.id), [allProducts]);

  const { data: pricingRules = [] } = useQuery({
    queryKey: ["commission-rates-rules", allProductIds],
    enabled: allProductIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_pricing_rules")
        .select("id, product_id, name, commission_dkk, revenue_dkk, priority, campaign_mapping_ids, effective_from, effective_to, conditions, is_active")
        .in("product_id", allProductIds)
        .eq("is_active", true)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Build product rows with rules attached (parent + variants' rules combined under parent)
  const productRows = useMemo<ProductRow[]>(() => {
    const rulesByProduct = new Map<string, any[]>();
    for (const r of pricingRules) {
      if (!r.product_id) continue;
      const arr = rulesByProduct.get(r.product_id) || [];
      arr.push(r);
      rulesByProduct.set(r.product_id, arr);
    }

    const rows: ProductRow[] = parents.map((parent: any) => {
      const children = childrenByParent.get(parent.id) || [];
      const variantNames = children.map((c) => c.name);
      const variantIds = children.map((c) => c.id);

      const collectedRules: ResolvedRule[] = [];

      const pushRules = (productId: string, productName: string, isVariant: boolean) => {
        const rs = rulesByProduct.get(productId) || [];
        for (const rule of rs) {
          const campaignIds = (rule.campaign_mapping_ids as string[] | null) || [];
          const campaignNames = campaignIds
            .map((id) => campaignNameMap.get(id))
            .filter(Boolean) as string[];
          collectedRules.push({
            id: rule.id,
            name: rule.name,
            commission_dkk: rule.commission_dkk,
            revenue_dkk: rule.revenue_dkk,
            priority: rule.priority,
            effective_from: rule.effective_from,
            effective_to: rule.effective_to,
            conditions: rule.conditions,
            campaignNames,
            productName,
            isFromVariant: isVariant,
          });
        }
      };

      pushRules(parent.id, parent.name, false);
      for (const child of children) pushRules(child.id, child.name, true);

      // Sort: priority desc, then by effective_from desc
      collectedRules.sort((a, b) => {
        const pa = a.priority ?? 0;
        const pb = b.priority ?? 0;
        if (pa !== pb) return pb - pa;
        const fa = a.effective_from || "";
        const fb = b.effective_from || "";
        return fb.localeCompare(fa);
      });

      return {
        id: parent.id,
        name: parent.name,
        baseCommission: parent.commission_dkk,
        baseRevenue: parent.revenue_dkk,
        variantNames,
        variantIds,
        rules: collectedRules,
      };
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name, "da"));
  }, [parents, childrenByParent, pricingRules, campaignNameMap]);

  // Filter by search
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return productRows;
    const term = searchTerm.toLowerCase();
    return productRows.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        g.variantNames.some((n) => n.toLowerCase().includes(term))
    );
  }, [productRows, searchTerm]);

  const toggleProduct = (id: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const expandable = filteredProducts.filter((g) => g.rules.length > 0 || g.variantNames.length > 0);
    const allExpanded = expandable.every((g) => expandedProducts.has(g.id));
    if (allExpanded) {
      setExpandedProducts(new Set());
    } else {
      setExpandedProducts(new Set(expandable.map((g) => g.id)));
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
                  {filteredProducts.filter((g) => g.rules.length > 0 || g.variantNames.length > 0).every((g) => expandedProducts.has(g.id))
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

        {selectedClientId && !productsLoading && parents.length === 0 && (
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
                  <TableHead className="text-right w-32">Regler / varianter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((group) => {
                  const hasRules = group.rules.length > 0;
                  const hasVariants = group.variantNames.length > 0;
                  const expandable = hasRules || hasVariants;
                  const isExpanded = expandedProducts.has(group.id);

                  return (
                    <>
                      <TableRow
                        key={group.id}
                        className={expandable ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => expandable && toggleProduct(group.id)}
                      >
                        <TableCell className="w-8 px-2">
                          {expandable && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{group.name}</span>
                            {hasVariants && (
                              <Badge variant="outline" className="text-xs font-normal">
                                {group.variantNames.length} variant{group.variantNames.length > 1 ? "er" : ""}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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

                      {isExpanded && hasVariants && (
                        <TableRow key={`${group.id}-variants`} className="bg-muted/10">
                          <TableCell></TableCell>
                          <TableCell colSpan={4} className="text-xs text-muted-foreground py-2">
                            <span className="font-medium">Sammenlagte varianter:</span>{" "}
                            {group.variantNames.join(" · ")}
                          </TableCell>
                        </TableRow>
                      )}

                      {isExpanded && group.rules.map((rule) => {
                        const commDiff = diffLabel(rule.commission_dkk, group.baseCommission);
                        const revDiff = diffLabel(rule.revenue_dkk, group.baseRevenue);
                        const hasCampaigns = rule.campaignNames.length > 0;
                        const label = rule.name || (hasCampaigns ? "Kampagneregel" : "Prisregel");
                        const fromStr = fmtDate(rule.effective_from);
                        const toStr = fmtDate(rule.effective_to);
                        const hasConditions = rule.conditions && typeof rule.conditions === "object" && Object.keys(rule.conditions).length > 0;

                        return (
                          <TableRow key={rule.id} className="bg-muted/20 hover:bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell className="pl-8">
                              <div className="flex items-start gap-2 flex-wrap">
                                <span className="text-muted-foreground">├</span>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium">{label}</span>
                                    {rule.isFromVariant && (
                                      <Badge variant="outline" className="text-[10px] font-normal">
                                        fra variant: {rule.productName}
                                      </Badge>
                                    )}
                                    {rule.priority != null && rule.priority !== 0 && (
                                      <Badge variant="outline" className="text-[10px] font-normal">
                                        p:{rule.priority}
                                      </Badge>
                                    )}
                                    {hasConditions && (
                                      <Badge variant="outline" className="text-[10px] font-normal">
                                        betingelse
                                      </Badge>
                                    )}
                                  </div>
                                  {hasCampaigns && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {rule.campaignNames.map((cn) => (
                                        <Badge key={cn} variant="secondary" className="text-[10px] font-normal">
                                          {cn}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {(fromStr || toStr) && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {fromStr ? `fra ${fromStr}` : "uden startdato"}
                                      {toStr ? ` → ${toStr}` : " → ingen slut"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm align-top">
                              <div className="flex items-center justify-end gap-1.5">
                                {fmt(rule.commission_dkk)}
                                {commDiff && (
                                  <span className={`text-xs font-medium ${commDiff.className}`}>
                                    {commDiff.text}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm align-top">
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
