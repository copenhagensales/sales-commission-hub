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
import { Loader2, Merge, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SelectedProduct {
  id: string;
  name: string;
  clientCampaignId: string | null;
}

interface MergePreview {
  adversusMappings: number;
  saleItems: number;
  pricingRules: number;
}

interface ProductMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: SelectedProduct[];
  onMergeComplete: () => void;
}

export function ProductMergeDialog({
  open,
  onOpenChange,
  selectedProducts,
  onMergeComplete,
}: ProductMergeDialogProps) {
  const [targetProductId, setTargetProductId] = useState<string>("");
  const [preview, setPreview] = useState<Record<string, MergePreview>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [merging, setMerging] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open && selectedProducts.length > 0) {
      setTargetProductId(selectedProducts[0].id);
      loadPreview();
    }
  }, [open, selectedProducts]);

  const sourceProducts = selectedProducts.filter((p) => p.id !== targetProductId);

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      const ids = selectedProducts.map((p) => p.id);

      const [mappingsRes, saleItemsRes, rulesRes] = await Promise.all([
        supabase
          .from("adversus_product_mappings")
          .select("id, product_id")
          .in("product_id", ids),
        supabase
          .from("sale_items")
          .select("id, product_id")
          .in("product_id", ids),
        supabase
          .from("product_pricing_rules")
          .select("id, product_id")
          .in("product_id", ids),
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

  async function handleMerge() {
    if (!targetProductId || sourceProducts.length === 0) return;

    setMerging(true);
    try {
      const sourceIds = sourceProducts.map((p) => p.id);

      // 1. Move adversus_product_mappings
      const { error: e1 } = await supabase
        .from("adversus_product_mappings")
        .update({ product_id: targetProductId })
        .in("product_id", sourceIds);
      if (e1) throw e1;

      // 2. Move sale_items
      const { error: e2 } = await supabase
        .from("sale_items")
        .update({ product_id: targetProductId })
        .in("product_id", sourceIds);
      if (e2) throw e2;

      // 3. Move pricing rules (delete source rules, keep target's)
      const { error: e3 } = await supabase
        .from("product_pricing_rules")
        .delete()
        .in("product_id", sourceIds);
      if (e3) throw e3;

      // 4. Move cancellation_product_mappings
      const { error: e4 } = await supabase
        .from("cancellation_product_mappings")
        .update({ product_id: targetProductId })
        .in("product_id", sourceIds);
      if (e4) throw e4;

      // 5. Move product_campaign_overrides
      const { error: e5 } = await supabase
        .from("product_campaign_overrides")
        .update({ product_id: targetProductId })
        .in("product_id", sourceIds);
      if (e5) throw e5;

      // 6. Mark source products as merged + inactive
      const { error: e6 } = await supabase
        .from("products")
        .update({ merged_into_product_id: targetProductId, is_active: false } as any)
        .in("id", sourceIds);
      if (e6) throw e6;

      // 7. Insert merge history
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

      toast.success(`${sourceProducts.length} produkter merget ind i "${selectedProducts.find((p) => p.id === targetProductId)?.name}"`);
      onOpenChange(false);
      onMergeComplete();
    } catch (err: any) {
      console.error("Merge error:", err);
      toast.error(`Merge fejlede: ${err.message || "Ukendt fejl"}`);
    } finally {
      setMerging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge produkter
          </DialogTitle>
          <DialogDescription>
            Vælg et target-produkt. De øvrige produkter merges ind i det og deaktiveres.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target selection */}
          <div>
            <label className="text-sm font-medium mb-1 block">Target-produkt (beholdes)</label>
            <Select value={targetProductId} onValueChange={setTargetProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg target..." />
              </SelectTrigger>
              <SelectContent>
                {selectedProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
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

          {/* Summary */}
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

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
              Annuller
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || sourceProducts.length === 0}
              className="gap-2"
            >
              {merging && <Loader2 className="h-4 w-4 animate-spin" />}
              Merge {sourceProducts.length} produkt{sourceProducts.length !== 1 ? "er" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
