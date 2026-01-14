import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PricingRuleEditor } from "./PricingRuleEditor";

interface ProductPricingRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  baseCommission: number;
  baseRevenue: number;
  clientId?: string;
}

interface PricingRule {
  id: string;
  product_id: string;
  campaign_mapping_ids: string[] | null;
  conditions: Record<string, string>;
  commission_dkk: number;
  revenue_dkk: number;
  priority: number;
  name: string | null;
  is_active: boolean;
}

interface CampaignMapping {
  id: string;
  adversus_campaign_name: string | null;
}

export function ProductPricingRulesDialog({
  open,
  onOpenChange,
  productId,
  productName,
  baseCommission,
  baseRevenue,
  clientId,
}: ProductPricingRulesDialogProps) {
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch existing rules for this product
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["product-pricing-rules", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_pricing_rules")
        .select("*")
        .eq("product_id", productId)
        .order("priority", { ascending: false });

      if (error) throw error;
      return data as PricingRule[];
    },
    enabled: open,
  });

  // Fetch campaign mappings for dropdown
  const { data: campaigns } = useQuery({
    queryKey: ["campaign-mappings-for-rules", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_name")
        .order("adversus_campaign_name");

      if (error) throw error;
      return data as CampaignMapping[];
    },
    enabled: open,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from("product_pricing_rules")
        .delete()
        .eq("id", ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-pricing-rules", productId] });
      toast.success("Regel slettet");
    },
    onError: (error) => {
      toast.error("Kunne ikke slette regel: " + error.message);
    },
  });

  const handleDelete = (ruleId: string) => {
    if (confirm("Er du sikker på at du vil slette denne regel?")) {
      deleteMutation.mutate(ruleId);
    }
  };

  const handleSaveComplete = () => {
    setEditingRule(null);
    setIsCreating(false);
    queryClient.invalidateQueries({ queryKey: ["product-pricing-rules", productId] });
  };

  const formatConditions = (conditions: Record<string, string>) => {
    return Object.entries(conditions)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
  };

  const getCampaignNames = (campaignMappingIds: string[] | null) => {
    if (!campaignMappingIds || campaignMappingIds.length === 0) return "Alle kampagner";
    if (campaignMappingIds.length === 1) {
      const campaign = campaigns?.find((c) => c.id === campaignMappingIds[0]);
      return campaign?.adversus_campaign_name || "1 kampagne";
    }
    return `${campaignMappingIds.length} kampagner`;
  };

  // Show editor if creating or editing
  if (isCreating || editingRule) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Rediger prissætningsregel" : "Opret prissætningsregel"}
            </DialogTitle>
          </DialogHeader>
          <PricingRuleEditor
            productId={productId}
            productName={productName}
            baseCommission={baseCommission}
            baseRevenue={baseRevenue}
            campaigns={campaigns || []}
            existingRule={editingRule}
            onSave={handleSaveComplete}
            onCancel={() => {
              setEditingRule(null);
              setIsCreating(false);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ⚙️ Prissætningsregler for "{productName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Base pricing info */}
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Base:</strong> {baseCommission} kr provision, {baseRevenue} kr omsætning
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Hvis ingen regel matcher, bruges base-prisen eller kampagne-override.
            </p>
          </div>

          {/* Rules list */}
          {rulesLoading ? (
            <p className="text-sm text-muted-foreground">Indlæser regler...</p>
          ) : rules && rules.length > 0 ? (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`border rounded-lg p-3 ${
                    rule.is_active ? "bg-background" : "bg-muted/30 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {rule.name || "Unavngivet regel"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Prioritet: {rule.priority}
                        </Badge>
                        {!rule.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inaktiv
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground mb-1">
                        Kampagner: {getCampaignNames(rule.campaign_mapping_ids)}
                      </div>

                      <div className="bg-muted/50 rounded p-2 text-sm mb-2">
                        <span className="text-muted-foreground">Betingelser: </span>
                        {Object.keys(rule.conditions).length > 0 ? (
                          formatConditions(rule.conditions)
                        ) : (
                          <span className="italic">Ingen betingelser (matcher altid)</span>
                        )}
                      </div>

                      <div className="text-sm">
                        <span className="text-green-600 font-medium">
                          → {rule.commission_dkk} kr prov
                        </span>
                        <span className="text-muted-foreground mx-2">/</span>
                        <span className="text-blue-600 font-medium">
                          {rule.revenue_dkk} kr oms
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingRule(rule)}
                        title="Rediger"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(rule.id)}
                        title="Slet"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>Ingen prissætningsregler oprettet endnu</span>
            </div>
          )}

          {/* Add rule button */}
          <Button
            onClick={() => setIsCreating(true)}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Opret ny regel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
