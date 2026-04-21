import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay, isBefore, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Pencil, Trash2, AlertCircle, Loader2, History, CheckCircle, XCircle, CalendarIcon, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PricingRuleEditor } from "./PricingRuleEditor";
import { useMgTestMutationSync } from "@/hooks/useMgTestMutationSync";

interface ProductPricingRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  baseCommission: number;
  baseRevenue: number;
  countsAsSale: boolean;
  countsAsCrossSale: boolean;
  clientId?: string;
  onBaseValuesChange?: () => void;
}

interface PricingRule {
  id: string;
  product_id: string;
  campaign_mapping_ids: string[] | null;
  campaign_match_mode?: "include" | "exclude" | null;
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

interface PriceHistoryEntry {
  id: string;
  product_id: string;
  commission_dkk: number | null;
  revenue_dkk: number | null;
  effective_from: string;
  is_retroactive: boolean;
  applied_at: string | null;
  created_at: string;
  counts_as_sale: boolean | null;
  counts_as_cross_sale: boolean | null;
}

export function ProductPricingRulesDialog({
  open,
  onOpenChange,
  productId,
  productName,
  baseCommission,
  baseRevenue,
  countsAsSale,
  countsAsCrossSale,
  clientId,
  onBaseValuesChange,
}: ProductPricingRulesDialogProps) {
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [isRematching, setIsRematching] = useState(false);

  // Centralized post-mutation sync (invalidation + rematch + KPI + realtime)
  const { sync } = useMgTestMutationSync();

  // Local state for editable base values
  const [localCommission, setLocalCommission] = useState(String(baseCommission));
  const [localRevenue, setLocalRevenue] = useState(String(baseRevenue));
  const [localCountsAsSale, setLocalCountsAsSale] = useState(countsAsSale);
  const [localCountsAsCrossSale, setLocalCountsAsCrossSale] = useState(countsAsCrossSale);

  // Update local state when props change
  useEffect(() => {
    setLocalCommission(String(baseCommission));
    setLocalRevenue(String(baseRevenue));
    setLocalCountsAsSale(countsAsSale);
    setLocalCountsAsCrossSale(countsAsCrossSale);
  }, [baseCommission, baseRevenue, countsAsSale, countsAsCrossSale]);

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

  // Fetch price history for this product
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["product-price-history", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_price_history")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PriceHistoryEntry[];
    },
    enabled: open,
  });

  // Fetch product creation date for baseline
  const { data: productInfo } = useQuery({
    queryKey: ["product-info-for-history", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("created_at")
        .eq("id", productId)
        .single();

      if (error) throw error;
      return data;
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

  // Mutation to update counts_as_sale and counts_as_cross_sale
  const updateCountFlags = useMutation({
    mutationFn: async ({ countsAsSale, countsAsCrossSale }: { countsAsSale: boolean; countsAsCrossSale: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ counts_as_sale: countsAsSale, counts_as_cross_sale: countsAsCrossSale })
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indstillinger opdateret");
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

  // Determine if selected date is in the past
  const today = startOfDay(new Date());
  const isRetroactive = isBefore(effectiveDate, today);
  const isToday = isSameDay(effectiveDate, today);

  const handleSaveWithDate = async () => {
    const commission = parseFloat(localCommission.replace(",", ".")) || 0;
    const revenue = parseFloat(localRevenue.replace(",", ".")) || 0;
    
    setIsRematching(true);
    
    try {
      if (isToday || isRetroactive) {
        // Immediate or retroactive change - update products table directly
        await updateBaseValues.mutateAsync({ commission, revenue });
        await updateCountFlags.mutateAsync({ countsAsSale: localCountsAsSale, countsAsCrossSale: localCountsAsCrossSale });
        
        // Insert into history
        await supabase.from("product_price_history").insert({
          product_id: productId,
          commission_dkk: commission,
          revenue_dkk: revenue,
          counts_as_sale: localCountsAsSale,
          counts_as_cross_sale: localCountsAsCrossSale,
          effective_from: format(effectiveDate, "yyyy-MM-dd"),
          is_retroactive: isRetroactive,
          applied_at: new Date().toISOString()
        });
        
        // Fire-and-forget rematch in background
        toast.info("Opdaterer salg i baggrunden...");
        rematchMutation.mutate(
          { productId },
          {
            onSuccess: (result) => {
              if (result.stats.updated > 0) {
                toast.success(`✓ ${result.stats.updated} salg opdateret med nye priser`);
              } else {
                toast.info("Ingen salg blev opdateret");
              }
            },
            onError: () => {
              toast.error("Baggrundsopdatering fejlede — prøv rematch manuelt");
            },
          }
        );
        
        if (isRetroactive) {
          toast.warning("Prisændring gemt med retroaktiv dato");
        }
      } else {
        // Future change - save only in history (pending)
        const { error } = await supabase.from("product_price_history").insert({
          product_id: productId,
          commission_dkk: commission,
          revenue_dkk: revenue,
          counts_as_sale: localCountsAsSale,
          counts_as_cross_sale: localCountsAsCrossSale,
          effective_from: format(effectiveDate, "yyyy-MM-dd"),
          is_retroactive: false,
          applied_at: null
        });
        
        if (error) {
          toast.error("Kunne ikke gemme planlagt ændring: " + error.message);
          return;
        }
        
        toast.success(`Ændring planlagt til ${format(effectiveDate, "d. MMMM yyyy", { locale: da })}`);
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["product-price-history", productId] });
      queryClient.invalidateQueries({ queryKey: ["sale-items"] });
      queryClient.invalidateQueries({ queryKey: ["daily-sales"] });
      
    } finally {
      setIsRematching(false);
      setIsEditingBase(false);
      setEffectiveDate(new Date());
    }
  };

  const handleCancelEdit = () => {
    setLocalCommission(String(baseCommission));
    setLocalRevenue(String(baseRevenue));
    setLocalCountsAsSale(countsAsSale);
    setLocalCountsAsCrossSale(countsAsCrossSale);
    setIsEditingBase(false);
    setEffectiveDate(new Date());
  };

  // Mutual exclusion handlers
  const handleCountsAsSaleChange = (checked: boolean) => {
    setLocalCountsAsSale(checked);
    if (checked) {
      // If sale is selected, deselect cross-sale
      setLocalCountsAsCrossSale(false);
    }
  };

  const handleCountsAsCrossSaleChange = (checked: boolean) => {
    setLocalCountsAsCrossSale(checked);
    if (checked) {
      // If cross-sale is selected, deselect sale
      setLocalCountsAsSale(false);
    }
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
              {!isEditingBase ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm mb-1">Basis-indstillinger</h3>
                      <p className="text-xs text-muted-foreground">
                        Bruges hvis ingen regler matcher
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsEditingBase(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Rediger
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Provision (kr)</Label>
                      <p className="font-medium">{localCommission || "0"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Omsætning (kr)</Label>
                      <p className="font-medium">{localRevenue || "0"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {localCountsAsSale ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-sm">Tæl som salg</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {localCountsAsCrossSale ? (
                        <CheckCircle className="h-5 w-5 text-blue-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-sm">Tæl som bisalg</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-medium text-sm mb-1">Rediger basis-indstillinger</h3>
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
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="counts-as-sale"
                        checked={localCountsAsSale}
                        onCheckedChange={handleCountsAsSaleChange}
                      />
                      <Label htmlFor="counts-as-sale" className="text-sm cursor-pointer">
                        Tæl som salg
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="counts-as-cross-sale"
                        checked={localCountsAsCrossSale}
                        onCheckedChange={handleCountsAsCrossSaleChange}
                      />
                      <Label htmlFor="counts-as-cross-sale" className="text-sm cursor-pointer">
                        Tæl som bisalg
                      </Label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Kun én kan være valgt ad gangen
                  </p>

                  {/* Date picker */}
                  <div className="space-y-2 pt-2">
                    <Label>Ikrafttrædelsesdato</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(effectiveDate, "d. MMMM yyyy", { locale: da })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={effectiveDate}
                          onSelect={(date) => date && setEffectiveDate(date)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Retroactive warning */}
                  {isRetroactive && (
                    <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Advarsel: Retroaktiv ændring</p>
                        <p>Du har valgt en dato i fortiden. Dette overskriver tidligere prishistorik!</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveWithDate}
                      disabled={updateBaseValues.isPending || isRematching}
                    >
                      {(updateBaseValues.isPending || isRematching) && (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      )}
                      {isRematching ? "Opdaterer salg..." : "Gem ændringer"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isRematching}>
                      Annuller
                    </Button>
                  </div>
                </>
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
            <div className="space-y-3">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : history && history.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    // Sort by effective_from ascending to calculate proper validity periods
                    const sortedByEffectiveDate = [...history].sort(
                      (a, b) => new Date(a.effective_from).getTime() - new Date(b.effective_from).getTime()
                    );
                    
                    // Build a map of validity end dates based on effective_from
                    const validityEndMap = new Map<string, Date>();
                    for (let i = 0; i < sortedByEffectiveDate.length; i++) {
                      const current = sortedByEffectiveDate[i];
                      const next = sortedByEffectiveDate[i + 1];
                      if (next) {
                        validityEndMap.set(current.id, new Date(next.effective_from));
                      }
                    }
                    
                    // Get the earliest effective_from date for showing original pricing period
                    const earliestEntry = sortedByEffectiveDate[0];
                    const originalPricingEndDate = earliestEntry ? new Date(earliestEntry.effective_from) : null;
                    const productCreatedAt = productInfo?.created_at ? new Date(productInfo.created_at) : null;
                    
                    // Display in created_at descending order (newest first)
                    return (
                      <>
                        {history.map((entry, index) => {
                          const isPending = !entry.applied_at;
                          const isRetroactive = entry.is_retroactive;
                          
                          // Get validity end from our map
                          const validUntil = validityEndMap.get(entry.id);
                          
                          // Check if this is the currently active entry (most recent applied)
                          const isCurrentlyActive = !isPending && index === history.findIndex(h => h.applied_at);
                          
                          return (
                            <div
                              key={entry.id}
                              className={`border rounded-lg p-3 ${
                                isPending ? "bg-blue-50/50 border-blue-200" : 
                                isRetroactive ? "bg-orange-50/50 border-orange-200" : 
                                isCurrentlyActive ? "bg-green-50/30 border-green-200" :
                                "bg-background"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      Fra: {format(new Date(entry.effective_from), "d. MMMM yyyy", { locale: da })}
                                    </span>
                                  </div>
                                  {validUntil ? (
                                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                      <span className="ml-6">
                                        Til: {format(validUntil, "d. MMMM yyyy", { locale: da })}
                                      </span>
                                    </div>
                                  ) : isCurrentlyActive ? (
                                    <div className="flex items-center gap-2 mt-1 text-sm text-green-600">
                                      <span className="ml-6">Nuværende priser</span>
                                    </div>
                                  ) : null}
                                </div>
                                {isPending ? (
                                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Afventer
                                  </Badge>
                                ) : isRetroactive ? (
                                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Retroaktiv
                                  </Badge>
                                ) : isCurrentlyActive ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Aktiv
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                                    <History className="h-3 w-3 mr-1" />
                                    Tidligere
                                  </Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4 mb-2">
                                <div>
                                  <span className="text-xs text-muted-foreground">Provision</span>
                                  <p className="font-medium text-green-600">{entry.commission_dkk ?? 0} kr</p>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground">Omsætning</span>
                                  <p className="font-medium text-blue-600">{entry.revenue_dkk ?? 0} kr</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-sm">
                                {entry.counts_as_sale && (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-3 w-3" />
                                    <span>Salg</span>
                                  </div>
                                )}
                                {entry.counts_as_cross_sale && (
                                  <div className="flex items-center gap-1 text-blue-600">
                                    <CheckCircle className="h-3 w-3" />
                                    <span>Bisalg</span>
                                  </div>
                                )}
                                {!entry.counts_as_sale && !entry.counts_as_cross_sale && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <XCircle className="h-3 w-3" />
                                    <span>Ingen klassificering</span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                                Oprettet: {format(new Date(entry.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Show original product pricing baseline if we have product creation date */}
                        {productCreatedAt && originalPricingEndDate && (
                          <div className="border rounded-lg p-3 bg-muted/30 border-dashed">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-muted-foreground">
                                    Fra: {format(productCreatedAt, "d. MMMM yyyy", { locale: da })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <span className="ml-6">
                                    Til: {format(originalPricingEndDate, "d. MMMM yyyy", { locale: da })}
                                  </span>
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30">
                                <History className="h-3 w-3 mr-1" />
                                Original
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground italic">
                              Oprindelige priser (før første ændring blev registreret)
                            </div>

                            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                              Produkt oprettet: {format(productCreatedAt, "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">Ingen prishistorik endnu</p>
                  <p className="text-xs mt-1">Historik oprettes når du ændrer basis-indstillinger</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
