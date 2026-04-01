import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Merge, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface MergePreview {
  adversusMappings: number;
  saleItems: number;
  pricingRules: number;
}

interface ProductRow {
  key: string; // unique display key matching main table: clientId::externalId::title
  id: string | null; // product_id (null for unmapped)
  name: string; // display name (adversus_product_title)
  internalName: string | null; // product_name
  client_campaign_id: string | null;
  is_active: boolean;
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
  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [targetProductId, setTargetProductId] = useState("");
  const [preview, setPreview] = useState<Record<string, MergePreview>>({});
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [merging, setMerging] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedClientId("");
      setProducts([]);
      setSelectedProductIds(new Set());
      setTargetProductId("");
      setPreview({});
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
      // Use the same RPC as the main table to find all products for this client
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_aggregated_product_types");
      if (rpcError) throw rpcError;

      // Filter by selected client, deduplicate by product_id
      const seen = new Map<string, ProductRow>();
      for (const r of (rpcData ?? []) as any[]) {
        if (r.client_id === clientId && r.product_id && !seen.has(r.product_id)) {
          seen.set(r.product_id, {
            id: r.product_id,
            name: r.adversus_product_title ?? r.product_name ?? "Ukendt",
            internalName: r.product_name ?? null,
            client_campaign_id: r.product_client_campaign_id,
            is_active: true,
          });
        }
      }

      // Also include directly campaign-assigned products (including inactive ones)
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      const campaignIds = (campaigns ?? []).map((c) => c.id);
      if (campaignIds.length > 0) {
        const { data: directProducts } = await supabase
          .from("products")
          .select("id, name, client_campaign_id, is_active")
          .in("client_campaign_id", campaignIds);
        for (const p of directProducts ?? []) {
          if (!seen.has(p.id)) {
            seen.set(p.id, {
              id: p.id,
              name: p.name,
              internalName: p.name,
              client_campaign_id: p.client_campaign_id,
              is_active: p.is_active ?? true,
            });
          }
        }
      }

      setProducts(Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "da")));
    } catch (e) {
      console.error("Load products error:", e);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadPreview() {
    const ids = Array.from(selectedProductIds);
    if (ids.length === 0) return;
    setLoadingPreview(true);
    try {
      const [mappingsRes, saleItemsRes, rulesRes] = await Promise.all([
        supabase.from("adversus_product_mappings").select("id, product_id").in("product_id", ids),
        supabase.from("sale_items").select("id, product_id").in("product_id", ids),
        supabase.from("product_pricing_rules").select("id, product_id").in("product_id", ids),
      ]);
      const counts: Record<string, MergePreview> = {};
      for (const id of ids) {
        counts[id] = {
          adversusMappings: (mappingsRes.data ?? []).filter((r) => r.product_id === id).length,
          saleItems: (saleItemsRes.data ?? []).filter((r) => r.product_id === id).length,
          pricingRules: (rulesRes.data ?? []).filter((r) => r.product_id === id).length,
        };
      }
      setPreview(counts);
    } catch (e) {
      console.error("Preview error:", e);
    } finally {
      setLoadingPreview(false);
    }
  }

  const selectedProducts = products.filter((p) => selectedProductIds.has(p.id));
  const sourceProducts = selectedProducts.filter((p) => p.id !== targetProductId);

  const totalMoved = sourceProducts.reduce(
    (acc, p) => {
      const c = preview[p.id];
      if (!c) return acc;
      return {
        mappings: acc.mappings + c.adversusMappings,
        sales: acc.sales + c.saleItems,
        rules: acc.rules + c.pricingRules,
      };
    },
    { mappings: 0, sales: 0, rules: 0 }
  );

  function handleNext() {
    if (step === 1 && selectedClientId) {
      loadProducts(selectedClientId);
      setStep(2);
    } else if (step === 2 && selectedProductIds.size >= 2 && targetProductId) {
      loadPreview();
      setStep(3);
    }
  }

  async function handleMerge() {
    if (!targetProductId || sourceProducts.length === 0) return;
    setMerging(true);
    try {
      const sourceIds = sourceProducts.map((p) => p.id);

      const { error: e1 } = await supabase
        .from("adversus_product_mappings")
        .update({ product_id: targetProductId })
        .in("product_id", sourceIds);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("sale_items")
        .update({ product_id: targetProductId })
        .in("product_id", sourceIds);
      if (e2) throw e2;

      const { error: e3 } = await supabase
        .from("product_pricing_rules")
        .delete()
        .in("product_id", sourceIds);
      if (e3) throw e3;

      const { error: e4 } = await supabase
        .from("cancellation_product_mappings")
        .update({ product_id: targetProductId })
        .in("product_id", sourceIds);
      if (e4) throw e4;

      const { error: e5 } = await supabase
        .from("product_campaign_overrides")
        .update({ product_id: targetProductId })
        .in("product_id", sourceIds);
      if (e5) throw e5;

      const { error: e6 } = await supabase
        .from("products")
        .update({ merged_into_product_id: targetProductId, is_active: false } as any)
        .in("id", sourceIds);
      if (e6) throw e6;

      const { data: userData } = await supabase.auth.getUser();
      const historyRows = sourceProducts.map((p) => ({
        source_product_id: p.id,
        target_product_id: targetProductId,
        merged_by: userData?.user?.id ?? null,
        source_product_name: p.name,
        adversus_mappings_moved: preview[p.id]?.adversusMappings ?? 0,
        sale_items_moved: preview[p.id]?.saleItems ?? 0,
        pricing_rules_moved: preview[p.id]?.pricingRules ?? 0,
      }));

      const { error: e7 } = await supabase
        .from("product_merge_history" as any)
        .insert(historyRows);
      if (e7) throw e7;

      const targetName = products.find((p) => p.id === targetProductId)?.name;
      toast.success(`${sourceProducts.length} produkter merget ind i "${targetName}"`);
      onOpenChange(false);
      onMergeComplete();
    } catch (err: any) {
      console.error("Merge error:", err);
      toast.error(`Merge fejlede: ${err.message || "Ukendt fejl"}`);
    } finally {
      setMerging(false);
    }
  }

  const stepLabels = ["Vælg kunde", "Vælg produkter", "Bekræft"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge produkter
          </DialogTitle>
          <DialogDescription>
            {stepLabels[step - 1]} (trin {step} af 3)
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
                <div className={`w-8 h-0.5 ${i + 1 < step ? "bg-primary/40" : "bg-muted"}`} />
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

        {/* Step 2: Select products + target */}
        {step === 2 && (
          <div className="space-y-3">
            <label className="text-sm font-medium block">
              Vælg produkter at merge (min. 2) og marker target
            </label>
            {loadingProducts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Henter produkter...
              </div>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen aktive produkter fundet for denne kunde.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded p-2">
                {products.map((p) => {
                  const isSelected = selectedProductIds.has(p.id);
                  const isTarget = targetProductId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded text-sm ${
                        isTarget ? "bg-primary/10 border border-primary/30" : isSelected ? "bg-muted/50" : ""
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setSelectedProductIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(p.id);
                            else {
                              next.delete(p.id);
                              if (targetProductId === p.id) setTargetProductId("");
                            }
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
                      {!p.is_active && <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>}
                      {isSelected && (
                        <Button
                          variant={isTarget ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => setTargetProductId(p.id)}
                        >
                          {isTarget ? "Target ✓" : "Vælg som target"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedProductIds.size >= 2 && !targetProductId && (
              <p className="text-xs text-destructive">Vælg et target-produkt der skal beholdes.</p>
            )}
          </div>
        )}

        {/* Step 3: Preview + confirm */}
        {step === 3 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">
                Target: <span className="text-primary">{products.find((p) => p.id === targetProductId)?.name}</span>
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Produkter der merges ind:</p>
              {loadingPreview ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Henter data...
                </div>
              ) : (
                <div className="space-y-1">
                  {sourceProducts.map((p) => {
                    const c = preview[p.id];
                    return (
                      <div key={p.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                        <span className="font-medium truncate max-w-[200px]">{p.name}</span>
                        <div className="flex gap-1">
                          {c && (
                            <>
                              <Badge variant="outline" className="text-[10px]">{c.adversusMappings} mappings</Badge>
                              <Badge variant="outline" className="text-[10px]">{c.saleItems} sales</Badge>
                              <Badge variant="outline" className="text-[10px]">{c.pricingRules} regler</Badge>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
              <p className="font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Opsummering
              </p>
              <p>{totalMoved.mappings} adversus-mappings flyttes</p>
              <p>{totalMoved.sales} sale_items flyttes</p>
              <p>{totalMoved.rules} prisregler slettes (target beholder sine)</p>
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
            {step < 3 ? (
              <Button
                onClick={handleNext}
                disabled={
                  (step === 1 && !selectedClientId) ||
                  (step === 2 && (selectedProductIds.size < 2 || !targetProductId))
                }
              >
                Næste <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleMerge}
                disabled={merging || sourceProducts.length === 0}
                className="gap-2"
              >
                {merging && <Loader2 className="h-4 w-4 animate-spin" />}
                Merge {sourceProducts.length} produkt{sourceProducts.length !== 1 ? "er" : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
