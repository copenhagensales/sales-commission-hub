import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Merge, AlertTriangle, ChevronLeft, ChevronRight, CalendarIcon, GitMerge, Unlink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PricingRule {
  id: string;
  product_id: string;
  productName: string;
  commission_dkk: number | null;
  revenue_dkk: number | null;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
  priority: number | null;
  rule_name: string | null;
}

type MergeMode = "merge" | "unmerge";
type RuleActionType = "keep" | "end" | "delete";

interface RuleAction {
  action: RuleActionType;
  endDate?: string;
}

interface ProductRow {
  key: string;
  id: string | null;
  name: string;
  internalName: string | null;
  client_campaign_id: string | null;
  is_active: boolean;
  merged_into_product_id: string | null;
  isMergeParent: boolean;
  // Unmapped source: sale_items with needs_mapping=true and product_id IS NULL
  isUnmapped?: boolean;
  unmappedExternalId?: string | null;
  unmappedSalesCount?: number;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProductMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMergeComplete: () => void;
}

export function ProductMergeDialog({
  open,
  onOpenChange,
  onMergeComplete,
}: ProductMergeDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<MergeMode>("merge");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [merging, setMerging] = useState(false);

  // Step 3: Pricing rules
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [ruleActions, setRuleActions] = useState<Map<string, RuleAction>>(new Map());

  // Step 4: Product name
  const [mergedProductName, setMergedProductName] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setMode("merge");
      setSelectedClientId("");
      setProducts([]);
      setSelectedKeys(new Set());
      setPricingRules([]);
      setRuleActions(new Map());
      setMergedProductName("");
      loadClients();
    }
  }, [open]);

  async function loadClients() {
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("client_id, clients(id, name)")
        .order("client_id");
      if (error) throw error;

      const clientMap = new Map<string, string>();
      (data ?? []).forEach((row: any) => {
        const c = row.clients;
        if (c?.id && c?.name && !clientMap.has(c.id)) {
          clientMap.set(c.id, c.name);
        }
      });
      setClients(
        Array.from(clientMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name, "da"))
      );
    } catch (e) {
      console.error("Load clients error:", e);
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadProducts(clientId: string) {
    setLoadingProducts(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_aggregated_product_types");
      if (rpcError) throw rpcError;

      // Fetch all products for this client to get merge status
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      const campaignIds = (campaigns ?? []).map((c) => c.id);

      let allDbProducts: any[] = [];
      if (campaignIds.length > 0) {
        const { data: dbProds } = await supabase
          .from("products")
          .select("id, name, client_campaign_id, is_active, merged_into_product_id")
          .in("client_campaign_id", campaignIds);
        allDbProducts = dbProds ?? [];
      }

      // Collect product IDs from RPC that might not have a campaign_id
      const rpcProductIds = new Set<string>();
      const dbProductIds = new Set(allDbProducts.map((p) => p.id));
      for (const r of (rpcData ?? []) as any[]) {
        if (r.client_id !== clientId) continue;
        if (r.product_id && !dbProductIds.has(r.product_id)) {
          rpcProductIds.add(r.product_id);
        }
      }

      // Fetch merge status for products without campaign_id
      if (rpcProductIds.size > 0) {
        const { data: extraProds } = await supabase
          .from("products")
          .select("id, name, client_campaign_id, is_active, merged_into_product_id")
          .in("id", Array.from(rpcProductIds));
        if (extraProds) {
          allDbProducts = [...allDbProducts, ...extraProds];
        }
      }

      // Also fetch merged children that lost their campaign_id during merge
      const parentIds = allDbProducts.filter(p => !p.merged_into_product_id).map(p => p.id);
      if (parentIds.length > 0) {
        const existingIds = new Set(allDbProducts.map(p => p.id));
        const { data: mergedChildren } = await supabase
          .from("products")
          .select("id, name, client_campaign_id, is_active, merged_into_product_id")
          .in("merged_into_product_id", parentIds)
          .not("id", "in", `(${Array.from(existingIds).join(",")})`);
        if (mergedChildren && mergedChildren.length > 0) {
          allDbProducts = [...allDbProducts, ...mergedChildren];
        }
      }

      // Build lookup maps
      const mergedIntoMap = new Map<string, string | null>();
      const mergeParentIds = new Set<string>();
      for (const p of allDbProducts) {
        mergedIntoMap.set(p.id, p.merged_into_product_id);
        if (p.merged_into_product_id && p.merged_into_product_id !== p.id) {
          mergeParentIds.add(p.merged_into_product_id);
        }
      }

      const seenKeys = new Set<string>();
      const seenProductIds = new Set<string>();
      const result: ProductRow[] = [];

      for (const r of (rpcData ?? []) as any[]) {
        if (r.client_id !== clientId) continue;
        const productKey = `${r.adversus_external_id ?? ""}::${r.adversus_product_title ?? ""}`;
        if (seenKeys.has(productKey)) continue;
        seenKeys.add(productKey);

        const pid = r.product_id ?? null;
        // Skip if we already have a row for this product_id (dedup by internal ID too)
        if (pid && seenProductIds.has(pid)) continue;
        if (pid) seenProductIds.add(pid);

        result.push({
          key: productKey,
          id: pid,
          name: r.adversus_product_title ?? r.product_name ?? "Ukendt",
          internalName: r.product_name ?? null,
          client_campaign_id: r.product_client_campaign_id,
          is_active: pid ? (allDbProducts.find((p) => p.id === pid)?.is_active ?? true) : true,
          merged_into_product_id: pid ? (mergedIntoMap.get(pid) ?? null) : null,
          isMergeParent: pid ? mergeParentIds.has(pid) : false,
        });
      }

      if (campaignIds.length > 0) {
        for (const p of allDbProducts) {
          const manualKey = `manual::${p.id}`;
          if (!seenKeys.has(manualKey)) {
            const alreadyCovered = result.some((r) => r.id === p.id);
            if (!alreadyCovered) {
              seenKeys.add(manualKey);
              result.push({
                key: manualKey,
                id: p.id,
                name: p.name,
                internalName: p.name,
                client_campaign_id: p.client_campaign_id,
                is_active: p.is_active ?? true,
                merged_into_product_id: p.merged_into_product_id ?? null,
                isMergeParent: mergeParentIds.has(p.id),
              });
            }
          }
        }
      }

      setProducts(result.sort((a, b) => a.name.localeCompare(b.name, "da")));
    } catch (e) {
      console.error("Load products error:", e);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadPricingRules() {
    const selected = products.filter((p) => selectedKeys.has(p.key) && p.id);
    const ids = [...new Set(selected.map((p) => p.id!))];
    if (ids.length === 0) return;
    setLoadingRules(true);
    try {
      const { data, error } = await supabase
        .from("product_pricing_rules")
        .select("id, product_id, commission_dkk, revenue_dkk, effective_from, effective_to, is_active, priority")
        .in("product_id", ids)
        .order("priority", { ascending: false });
      if (error) throw error;

      const productNameMap = new Map<string, string>();
      selected.forEach((p) => {
        if (p.id) productNameMap.set(p.id, p.name);
      });

      const rules: PricingRule[] = (data ?? []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        productName: productNameMap.get(r.product_id) ?? "Ukendt",
        commission_dkk: r.commission_dkk,
        revenue_dkk: r.revenue_dkk,
        effective_from: r.effective_from,
        effective_to: r.effective_to,
        is_active: r.is_active,
        priority: r.priority,
        rule_name: null,
      }));

      setPricingRules(rules);

      // Default all rules to "keep"
      const defaultActions = new Map<string, RuleAction>();
      rules.forEach((r) => {
        defaultActions.set(r.id, { action: "keep" });
      });
      setRuleActions(defaultActions);
    } catch (e) {
      console.error("Load pricing rules error:", e);
    } finally {
      setLoadingRules(false);
    }
  }

  const selectedProducts = products.filter((p) => selectedKeys.has(p.key) && p.id);
  
  // Detect "expand existing merge" mode: if exactly one selected product is a merge parent
  const selectedParents = selectedProducts.filter((p) => p.isMergeParent);
  const isExpandMode = selectedParents.length === 1;
  const expandTarget = isExpandMode ? selectedParents[0] : null;
  const minProducts = isExpandMode ? 2 : 2; // always need at least 2 selected, but in expand mode 1 is the parent
  function setRuleAction(ruleId: string, action: RuleActionType) {
    setRuleActions((prev) => {
      const next = new Map(prev);
      next.set(ruleId, { action, endDate: prev.get(ruleId)?.endDate });
      return next;
    });
  }

  function setRuleEndDate(ruleId: string, date: string) {
    setRuleActions((prev) => {
      const next = new Map(prev);
      next.set(ruleId, { action: "end", endDate: date });
      return next;
    });
  }

  // Group rules by product
  const rulesByProduct = new Map<string, PricingRule[]>();
  pricingRules.forEach((r) => {
    const list = rulesByProduct.get(r.product_id) || [];
    list.push(r);
    rulesByProduct.set(r.product_id, list);
  });

  // Stats for step 4
  const rulesKept = [...ruleActions.values()].filter((a) => a.action === "keep").length;
  const rulesEnded = [...ruleActions.values()].filter((a) => a.action === "end").length;
  const rulesDeleted = [...ruleActions.values()].filter((a) => a.action === "delete").length;

  function handleNext() {
    if (step === 1 && selectedClientId) {
      setStep(2);
    } else if (step === 2) {
      // Mode selected, load products and go to step 3
      loadProducts(selectedClientId);
      setStep(3);
    } else if (step === 3) {
      if (mode === "merge" && selectedKeys.size >= 2) {
        loadPricingRules();
        setStep(4);
      } else if (mode === "unmerge" && selectedKeys.size >= 1) {
        setStep(4); // confirm step for unmerge
      }
    } else if (step === 4 && mode === "merge") {
      // Default name: use expand target name if expanding, otherwise first selected
      if (!mergedProductName) {
        setMergedProductName(expandTarget?.name ?? selectedProducts[0]?.name ?? "");
      }
      setStep(5);
    }
  }

  async function handleMerge() {
    if (!mergedProductName.trim() || selectedProducts.length < 2) return;
    setMerging(true);
    try {
      const allIds = selectedProducts.map((p) => p.id!).filter(Boolean);

      // Deduplicate IDs — multiple RPC rows can reference the same product_id
      const uniqueIds = [...new Set(allIds)];

      // In expand mode, use the existing merge parent as target
      const targetId = expandTarget?.id ?? uniqueIds[0];
      const sourceIds = uniqueIds.filter(id => id !== targetId);

      // Rename target product
      const { error: renameErr } = await supabase
        .from("products")
        .update({ name: mergedProductName.trim() })
        .eq("id", targetId);
      if (renameErr) throw renameErr;

      // Move adversus_product_mappings
      let adversusMappingsMoved = 0;
      let saleItemsMoved = 0;
      let pricingRulesMoved = 0;

      if (sourceIds.length > 0) {
        const { error: e1, count: c1 } = await supabase
          .from("adversus_product_mappings")
          .update({ product_id: targetId })
          .in("product_id", sourceIds);
        if (e1) throw e1;
        adversusMappingsMoved = c1 ?? 0;

        // Move sale_items
        const { error: e2, count: c2 } = await supabase
          .from("sale_items")
          .update({ product_id: targetId })
          .in("product_id", sourceIds);
        if (e2) throw e2;
        saleItemsMoved = c2 ?? 0;

        // Move cancellation_product_mappings
        const { error: e4 } = await supabase
          .from("cancellation_product_mappings")
          .update({ product_id: targetId })
          .in("product_id", sourceIds);
        if (e4) throw e4;

        // Move cancellation_product_conditions
        const { error: eCpc } = await supabase
          .from("cancellation_product_conditions")
          .update({ product_id: targetId })
          .in("product_id", sourceIds);
        if (eCpc) throw eCpc;

        // Move product_price_history
        const { error: ePph } = await supabase
          .from("product_price_history" as any)
          .update({ product_id: targetId })
          .in("product_id", sourceIds);
        if (ePph) throw ePph;

        // Move product_campaign_overrides (handle unique constraint on product_id + campaign_mapping_id)
        // First, get existing overrides on the target product
        const { data: targetOverrides } = await supabase
          .from("product_campaign_overrides")
          .select("campaign_mapping_id")
          .eq("product_id", targetId);
        const existingCampaignIds = new Set((targetOverrides || []).map((o: any) => o.campaign_mapping_id));

        // Get source overrides
        const { data: sourceOverrides } = await supabase
          .from("product_campaign_overrides")
          .select("id, campaign_mapping_id")
          .in("product_id", sourceIds);

        if (sourceOverrides && sourceOverrides.length > 0) {
          // Delete source overrides that would conflict with existing target overrides
          const conflictIds = sourceOverrides
            .filter((o: any) => existingCampaignIds.has(o.campaign_mapping_id))
            .map((o: any) => o.id);
          if (conflictIds.length > 0) {
            await supabase.from("product_campaign_overrides").delete().in("id", conflictIds);
          }

          // Move remaining non-conflicting overrides to target
          const moveIds = sourceOverrides
            .filter((o: any) => !existingCampaignIds.has(o.campaign_mapping_id))
            .map((o: any) => o.id);
          if (moveIds.length > 0) {
            const { error: e5 } = await supabase
              .from("product_campaign_overrides")
              .update({ product_id: targetId })
              .in("id", moveIds);
            if (e5) throw e5;
          }
        }
      }

      // Handle pricing rules according to user choices
      for (const [ruleId, action] of ruleActions.entries()) {
        if (action.action === "keep") {
          await supabase
            .from("product_pricing_rules")
            .update({ product_id: targetId })
            .eq("id", ruleId);
          pricingRulesMoved++;
        } else if (action.action === "end") {
          await supabase
            .from("product_pricing_rules")
            .update({
              product_id: targetId,
              effective_to: action.endDate || null,
            })
            .eq("id", ruleId);
          pricingRulesMoved++;
        } else if (action.action === "delete") {
          await supabase
            .from("product_pricing_rules")
            .delete()
            .eq("id", ruleId);
        }
      }

      // Deactivate source products
      if (sourceIds.length > 0) {
        const { error: e6 } = await supabase
          .from("products")
          .update({ merged_into_product_id: targetId, is_active: false } as any)
          .in("id", sourceIds);
        if (e6) throw e6;
      }

      // Log merge history with actual counts
      const { data: userData } = await supabase.auth.getUser();
      const historyRows = sourceIds.map((srcId) => ({
        source_product_id: srcId,
        target_product_id: targetId,
        merged_by: userData?.user?.id ?? null,
        source_product_name: selectedProducts.find((p) => p.id === srcId)?.name ?? "Ukendt",
        adversus_mappings_moved: adversusMappingsMoved,
        sale_items_moved: saleItemsMoved,
        pricing_rules_moved: pricingRulesMoved,
      }));

      if (historyRows.length > 0) {
        const { error: e7 } = await supabase
          .from("product_merge_history" as any)
          .insert(historyRows);
        if (e7) throw e7;
      }

      // Trigger rematch to recalculate mapped_commission/mapped_revenue for all affected sale_items
      toast.info("Genberegner provisioner for mergede salg...");
      try {
        const rematchResponse = await supabase.functions.invoke("rematch-pricing-rules", {
          body: { product_id: targetId, dry_run: false },
        });
        if (rematchResponse.error) {
          console.error("Rematch error:", rematchResponse.error);
          toast.warning("Merge gennemført, men prisgenberegning fejlede. Kør rematch manuelt.");
        } else {
          const stats = rematchResponse.data?.stats;
          if (stats?.updated > 0) {
            toast.success(`${stats.updated} salg genberegnet med nye priser`);
          }
        }
      } catch (rematchErr) {
        console.error("Rematch call error:", rematchErr);
        toast.warning("Merge gennemført, men prisgenberegning fejlede.");
      }

      // Invalidate all relevant caches so dashboards/reports refresh
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale_items"] });
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["sales-aggregates"] });
      queryClient.invalidateQueries({ queryKey: ["kpi"] });
      queryClient.invalidateQueries({ queryKey: ["aggregated-product-types"] });

      toast.success(`${selectedProducts.length} produkter merget til "${mergedProductName.trim()}"`);
      onOpenChange(false);
      onMergeComplete();
    } catch (err: any) {
      console.error("Merge error:", err);
      toast.error(`Merge fejlede: ${err.message || "Ukendt fejl"}`);
    } finally {
      setMerging(false);
    }
  }

  async function handleUnmerge() {
    const toUnmerge = selectedProducts.filter((p) => p.id && p.merged_into_product_id);
    if (toUnmerge.length === 0) return;
    setMerging(true);
    try {
      for (const product of toUnmerge) {
        const { error } = await supabase
          .from("products")
          .update({ merged_into_product_id: null, is_active: true } as any)
          .eq("id", product.id!);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["aggregated-product-types"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale_items"] });

      toast.success(`${toUnmerge.length} produkt(er) frigjort fra merge`);
      onOpenChange(false);
      onMergeComplete();
    } catch (err: any) {
      console.error("Unmerge error:", err);
      toast.error(`Unmerge fejlede: ${err.message || "Ukendt fejl"}`);
    } finally {
      setMerging(false);
    }
  }

  const stepLabels = mode === "merge"
    ? ["Vælg kunde", "Vælg handling", "Vælg produkter", "Prisregler", "Navngiv & bekræft"]
    : ["Vælg kunde", "Vælg handling", "Vælg produkter", "Bekræft"];
  const totalSteps = stepLabels.length;

  const canAdvance = () => {
    if (step === 1) return !!selectedClientId;
    if (step === 2) return true; // mode is always selected
    if (step === 3) {
      if (mode === "merge") return selectedKeys.size >= 2;
      if (mode === "unmerge") return selectedKeys.size >= 1;
    }
    if (step === 4 && mode === "merge") return true; // pricing rules
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            {mode === "merge" ? "Merge produkter" : "Unmerge produkter"}
          </DialogTitle>
          <DialogDescription>
            {stepLabels[step - 1]} (trin {step} af {totalSteps})
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  i + 1 === step
                    ? "bg-primary text-primary-foreground"
                    : i + 1 < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`w-6 h-0.5 ${i + 1 < step ? "bg-primary/40" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select client */}
        {step === 1 && (
          <div className="space-y-3">
            <label className="text-sm font-medium block">Kunde</label>
            {loadingClients ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Henter kunder...
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* Step 2: Select mode (merge or unmerge) */}
        {step === 2 && (
          <div className="space-y-3">
            <label className="text-sm font-medium block">Hvad vil du gøre?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("merge")}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all text-left",
                  mode === "merge"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <GitMerge className={cn("h-8 w-8", mode === "merge" ? "text-primary" : "text-muted-foreground")} />
                <div className="text-center">
                  <p className="font-medium text-sm">Merge</p>
                  <p className="text-xs text-muted-foreground mt-1">Saml flere produkter til ét</p>
                </div>
              </button>
              <button
                onClick={() => setMode("unmerge")}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all text-left",
                  mode === "unmerge"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <Unlink className={cn("h-8 w-8", mode === "unmerge" ? "text-primary" : "text-muted-foreground")} />
                <div className="text-center">
                  <p className="font-medium text-sm">Unmerge</p>
                  <p className="text-xs text-muted-foreground mt-1">Frigør et produkt fra en merge</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select products */}
        {step === 3 && (
          <div className="space-y-3">
            <label className="text-sm font-medium block">
              {mode === "merge" ? "Vælg produkter at merge (min. 2)" : "Vælg produkter at unmerge"}
            </label>
            {mode === "merge" && isExpandMode && expandTarget && (
              <div className="bg-primary/10 border border-primary/20 rounded p-2 text-sm flex items-center gap-2">
                <Merge className="h-4 w-4 text-primary" />
                <span>Tilføjer til eksisterende merge: <strong>{expandTarget.name}</strong></span>
              </div>
            )}
            {loadingProducts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Henter produkter...
              </div>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen aktive produkter fundet for denne kunde.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded p-2">
                {mode === "unmerge" ? (
                  // Group children by parent for unmerge mode
                  (() => {
                    const children = products.filter(
                      (p) => !!p.merged_into_product_id && p.merged_into_product_id !== p.id
                    );
                    const parentLookup = new Map<string, string>();
                    for (const p of products) {
                      if (p.id) parentLookup.set(p.id, p.internalName || p.name);
                    }
                    // Group by parent id
                    const groups = new Map<string, typeof children>();
                    for (const c of children) {
                      const pid = c.merged_into_product_id!;
                      if (!groups.has(pid)) groups.set(pid, []);
                      groups.get(pid)!.push(c);
                    }
                    return Array.from(groups.entries()).map(([parentId, groupChildren]) => (
                      <div key={parentId} className="mb-2 last:mb-0">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border/50 mb-1">
                          <Merge className="h-3 w-3" />
                          <span>Parent: {parentLookup.get(parentId) || "Ukendt"}</span>
                          <Badge variant="outline" className="text-[10px] ml-auto">{groupChildren.length} child(s)</Badge>
                        </div>
                        {groupChildren.map((p) => {
                          const isSelected = selectedKeys.has(p.key);
                          return (
                            <div
                              key={p.key}
                              className={`flex items-center gap-3 px-3 py-2 rounded text-sm ml-3 ${
                                isSelected ? "bg-muted/50" : ""
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  setSelectedKeys((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(p.key);
                                    else next.delete(p.key);
                                    return next;
                                  });
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="block truncate font-medium">{p.name}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()
                ) : (
                  products.map((p) => {
                    const isSelected = selectedKeys.has(p.key);
                    const isUnmapped = !p.id;
                    const isMergedChild = !!p.merged_into_product_id && p.merged_into_product_id !== p.id;
                    const isDisabled = isUnmapped || isMergedChild;
                    return (
                      <div
                        key={p.key}
                        className={`flex items-center gap-3 px-3 py-2 rounded text-sm ${
                          isSelected ? "bg-muted/50" : ""
                        } ${isDisabled ? "opacity-50" : ""}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={isDisabled}
                          onCheckedChange={(checked) => {
                            setSelectedKeys((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(p.key);
                              else next.delete(p.key);
                              return next;
                            });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          {p.internalName && p.internalName !== p.name && (
                            <span className="block truncate text-xs text-muted-foreground">Internt: {p.internalName}</span>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {isMergedChild && <Badge variant="secondary" className="text-[10px]">Allerede merget</Badge>}
                          {p.isMergeParent && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Merge-parent</Badge>}
                          {isUnmapped && <Badge variant="secondary" className="text-[10px]">Ikke mappet</Badge>}
                          {!p.is_active && !isUnmapped && !isMergedChild && <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Pricing rules management (merge only) */}
        {step === 4 && mode === "merge" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vælg hvad der skal ske med prisreglerne for de valgte produkter.
            </p>
            {loadingRules ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Henter prisregler...
              </div>
            ) : pricingRules.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Ingen prisregler fundet for de valgte produkter.</p>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto">
                {[...rulesByProduct.entries()].map(([productId, rules]) => {
                  const productName = rules[0]?.productName ?? "Ukendt";
                  return (
                    <div key={productId} className="border rounded-lg p-3 space-y-2">
                      <p className="text-sm font-semibold">{productName}</p>
                      {rules.map((rule) => {
                        const action = ruleActions.get(rule.id);
                        return (
                          <div key={rule.id} className="bg-muted/30 rounded p-2 space-y-2">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{rule.rule_name || `Regel #${rule.priority ?? "?"}`}</span>
                                <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                                  <span>Provision: {rule.commission_dkk ?? 0} kr</span>
                                  <span>Revenue: {rule.revenue_dkk ?? 0} kr</span>
                                  {rule.effective_from && <span>Fra: {rule.effective_from}</span>}
                                  {rule.effective_to && <span>Til: {rule.effective_to}</span>}
                                  {!rule.is_active && <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Button
                                variant={action?.action === "keep" ? "default" : "outline"}
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() => setRuleAction(rule.id, "keep")}
                              >
                                Behold
                              </Button>
                              <Button
                                variant={action?.action === "end" ? "default" : "outline"}
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() => setRuleAction(rule.id, "end")}
                              >
                                Sæt slutdato
                              </Button>
                              <Button
                                variant={action?.action === "delete" ? "destructive" : "outline"}
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() => setRuleAction(rule.id, "delete")}
                              >
                                Slet
                              </Button>
                              {action?.action === "end" && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-xs h-7 px-2 ml-1 gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      {action.endDate ? format(new Date(action.endDate), "dd/MM/yyyy") : "Vælg dato"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={action.endDate ? new Date(action.endDate) : undefined}
                                      onSelect={(date) => {
                                        if (date) setRuleEndDate(rule.id, format(date, "yyyy-MM-dd"));
                                      }}
                                      className="pointer-events-auto"
                                    />
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Unmerge confirm */}
        {step === 4 && mode === "unmerge" && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
              <p className="font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Bekræft unmerge
              </p>
              <p>{selectedProducts.length} produkt(er) vil blive frigjort fra deres merge-parent:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {selectedProducts.map((p) => (
                  <li key={p.key} className="text-sm">{p.name}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                Produkterne bliver aktiveret igen som selvstændige produkter. Deres salgsdata og mappings forbliver uændrede.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Name product + confirm (merge only) */}
        {step === 5 && mode === "merge" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium block">Produktnavn for det samlede produkt</label>
              <Input
                value={mergedProductName}
                onChange={(e) => setMergedProductName(e.target.value)}
                placeholder="Skriv produktnavn..."
              />
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-xs text-muted-foreground mr-1">Hurtigvalg:</span>
                {selectedProducts.map((p) => (
                  <Button
                    key={p.key}
                    variant={mergedProductName === p.name ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={() => setMergedProductName(p.name)}
                  >
                    {p.name.length > 30 ? p.name.slice(0, 30) + "…" : p.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
              <p className="font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Opsummering
              </p>
              <p>{selectedProducts.length} produkter merges til "{mergedProductName || "..."}"</p>
              {pricingRules.length > 0 && (
                <>
                  <p>{rulesKept} prisregler beholdes</p>
                  <p>{rulesEnded} prisregler får slutdato</p>
                  <p>{rulesDeleted} prisregler slettes</p>
                </>
              )}
              <p className="text-destructive text-xs mt-2">Denne handling kan ikke fortrydes.</p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-2">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={merging}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Tilbage
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
              Annuller
            </Button>
            {step < totalSteps ? (
              <Button onClick={handleNext} disabled={!canAdvance()}>
                Næste <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : mode === "merge" ? (
              <Button
                onClick={handleMerge}
                disabled={merging || !mergedProductName.trim()}
                className="gap-2"
              >
                {merging && <Loader2 className="h-4 w-4 animate-spin" />}
                Merge {selectedProducts.length} produkter
              </Button>
            ) : (
              <Button
                onClick={handleUnmerge}
                disabled={merging || selectedProducts.length === 0}
                className="gap-2"
              >
                {merging && <Loader2 className="h-4 w-4 animate-spin" />}
                Unmerge {selectedProducts.length} produkter
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
