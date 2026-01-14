import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, AlertCircle, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { PricingRuleEditor } from "./PricingRuleEditor";

interface ProductPricingRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  baseCommission: number;
  baseRevenue: number;
  countsAsSale: boolean;
  clientId?: string;
  onBaseValuesChange?: () => void;
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
  countsAsSale,
  clientId,
  onBaseValuesChange,
}: ProductPricingRulesDialogProps) {
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Local state for editable base values
  const [localCommission, setLocalCommission] = useState(String(baseCommission));
  const [localRevenue, setLocalRevenue] = useState(String(baseRevenue));
  const [localCountsAsSale, setLocalCountsAsSale] = useState(countsAsSale);

  // Update local state when props change
  useEffect(() => {
    setLocalCommission(String(baseCommission));
    setLocalRevenue(String(baseRevenue));
    setLocalCountsAsSale(countsAsSale);
  }, [baseCommission, baseRevenue, countsAsSale]);

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

  // Mutation to update base values (commission + revenue)
  const updateBaseValues = useMutation({
    mutationFn: async ({ commission, revenue }: { commission: number; revenue: number }) => {
      const { error } = await supabase
        .from("products")
        .update({ commission_dkk: commission, revenue_dkk: revenue })
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Basis-priser opdateret");
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-manual-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onBaseValuesChange?.();
    },
    onError: (error) => {
      toast.error("Kunne ikke opdatere priser: " + error.message);
    },
  });

  // Mutation to update counts_as_sale
  const updateCountsAsSale = useMutation({
    mutationFn: async (countsAsSale: boolean) => {
      const { error } = await supabase
        .from("products")
        .update({ counts_as_sale: countsAsSale })
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tæl som salg opdateret");
      queryClient.invalidateQueries({ queryKey: ["mg-aggregated-products"] });
      queryClient.invalidateQueries({ queryKey: ["mg-manual-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onBaseValuesChange?.();
    },
    onError: (error) => {
      toast.error("Kunne ikke opdatere: " + error.message);
    },
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

  const handleSaveBaseValues = () => {
    const commission = parseFloat(localCommission.replace(",", ".")) || 0;
    const revenue = parseFloat(localRevenue.replace(",", ".")) || 0;
    updateBaseValues.mutate({ commission, revenue });
  };

  const handleCountsAsSaleChange = (checked: boolean) => {
    setLocalCountsAsSale(checked);
    updateCountsAsSale.mutate(checked);
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

  // Check if base values have changed
  const hasBaseValueChanges = () => {
    const currentCommission = parseFloat(localCommission.replace(",", ".")) || 0;
    const currentRevenue = parseFloat(localRevenue.replace(",", ".")) || 0;
    return currentCommission !== baseCommission || currentRevenue !== baseRevenue;
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
            baseCommission={parseFloat(localCommission.replace(",", ".")) || 0}
            baseRevenue={parseFloat(localRevenue.replace(",", ".")) || 0}
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

        <Tabs defaultValue="hovedside" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hovedside">Hovedside</TabsTrigger>
            <TabsTrigger value="regler">Regler</TabsTrigger>
            <TabsTrigger value="historik">Historik</TabsTrigger>
          </TabsList>

          {/* Hovedside Tab */}
          <TabsContent value="hovedside" className="mt-4">
            <div className="border rounded-lg p-4 space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-1">Basis-indstillinger</h3>
                <p className="text-xs text-muted-foreground">
                  Bruges hvis ingen regler matcher
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base-commission">Provision (kr)</Label>
                  <Input
                    id="base-commission"
                    type="text"
                    inputMode="decimal"
                    value={localCommission}
                    onChange={(e) => setLocalCommission(e.target.value)}
                    onBlur={handleSaveBaseValues}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-revenue">Omsætning (kr)</Label>
                  <Input
                    id="base-revenue"
                    type="text"
                    inputMode="decimal"
                    value={localRevenue}
                    onChange={(e) => setLocalRevenue(e.target.value)}
                    onBlur={handleSaveBaseValues}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="counts-as-sale"
                  checked={localCountsAsSale}
                  onCheckedChange={handleCountsAsSaleChange}
                  disabled={updateCountsAsSale.isPending}
                />
                <Label htmlFor="counts-as-sale" className="text-sm cursor-pointer">
                  Tæl som salg
                </Label>
                {updateCountsAsSale.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>

              {hasBaseValueChanges() && (
                <Button
                  size="sm"
                  onClick={handleSaveBaseValues}
                  disabled={updateBaseValues.isPending}
                >
                  {updateBaseValues.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  )}
                  Gem ændringer
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Regler Tab */}
          <TabsContent value="regler" className="mt-4">
            <div className="space-y-3">
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
          </TabsContent>

          {/* Historik Tab */}
          <TabsContent value="historik" className="mt-4">
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">Historik kommer snart</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
