import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronUp, Save } from "lucide-react";
import { toast } from "sonner";

interface CampaignMapping {
  id: string;
  adversus_campaign_id: string;
  adversus_campaign_name: string | null;
}

interface Override {
  id?: string;
  campaign_mapping_id: string;
  commission_dkk: number;
  revenue_dkk: number;
}

interface ProductCampaignOverridesProps {
  productId: string;
  productName: string;
  baseCommission: number;
  baseRevenue: number;
}

export function ProductCampaignOverrides({
  productId,
  productName,
  baseCommission,
  baseRevenue,
}: ProductCampaignOverridesProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedOverrides, setEditedOverrides] = useState<Record<string, { commission: string; revenue: string }>>({});

  // Fetch all campaign mappings
  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["campaign-mappings-for-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_id, adversus_campaign_name")
        .order("adversus_campaign_name");
      if (error) throw error;
      return data as CampaignMapping[];
    },
    enabled: isExpanded,
  });

  // Fetch existing overrides for this product
  const { data: existingOverrides, isLoading: loadingOverrides } = useQuery({
    queryKey: ["product-campaign-overrides", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_campaign_overrides")
        .select("id, campaign_mapping_id, commission_dkk, revenue_dkk")
        .eq("product_id", productId);
      if (error) throw error;
      return data as Override[];
    },
    enabled: isExpanded && !!productId,
  });

  // Initialize edited values when overrides load
  useEffect(() => {
    if (existingOverrides && campaigns) {
      const initial: Record<string, { commission: string; revenue: string }> = {};
      existingOverrides.forEach((override) => {
        initial[override.campaign_mapping_id] = {
          commission: String(override.commission_dkk ?? 0),
          revenue: String(override.revenue_dkk ?? 0),
        };
      });
      setEditedOverrides(initial);
    }
  }, [existingOverrides, campaigns]);

  // Upsert override mutation
  const upsertOverride = useMutation({
    mutationFn: async ({
      campaignMappingId,
      commission,
      revenue,
    }: {
      campaignMappingId: string;
      commission: number;
      revenue: number;
    }) => {
      const { error } = await supabase
        .from("product_campaign_overrides")
        .upsert(
          {
            product_id: productId,
            campaign_mapping_id: campaignMappingId,
            commission_dkk: commission,
            revenue_dkk: revenue,
          },
          { onConflict: "product_id,campaign_mapping_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kampagne-specifik provision gemt");
      queryClient.invalidateQueries({ queryKey: ["product-campaign-overrides", productId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke gemme");
    },
  });

  // Delete override mutation
  const deleteOverride = useMutation({
    mutationFn: async (campaignMappingId: string) => {
      const { error } = await supabase
        .from("product_campaign_overrides")
        .delete()
        .eq("product_id", productId)
        .eq("campaign_mapping_id", campaignMappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kampagne-override fjernet");
      queryClient.invalidateQueries({ queryKey: ["product-campaign-overrides", productId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke fjerne override");
    },
  });

  const handleSave = (campaignId: string) => {
    const edited = editedOverrides[campaignId];
    if (!edited) return;

    const commission = parseFloat(edited.commission.replace(",", ".")) || 0;
    const revenue = parseFloat(edited.revenue.replace(",", ".")) || 0;

    // If both are 0, remove the override
    if (commission === 0 && revenue === 0) {
      const hasExisting = existingOverrides?.some((o) => o.campaign_mapping_id === campaignId);
      if (hasExisting) {
        deleteOverride.mutate(campaignId);
      }
      return;
    }

    upsertOverride.mutate({ campaignMappingId: campaignId, commission, revenue });
  };

  const handleInputChange = (campaignId: string, field: "commission" | "revenue", value: string) => {
    setEditedOverrides((prev) => ({
      ...prev,
      [campaignId]: {
        ...prev[campaignId],
        [field]: value,
      },
    }));
  };

  const getOverrideForCampaign = (campaignId: string) => {
    return existingOverrides?.find((o) => o.campaign_mapping_id === campaignId);
  };

  const hasOverride = (campaignId: string) => {
    return existingOverrides?.some((o) => o.campaign_mapping_id === campaignId);
  };

  const overrideCount = existingOverrides?.length ?? 0;

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Kampagne-overrides
        {overrideCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
            {overrideCount}
          </Badge>
        )}
      </Button>

      {isExpanded && (
        <div className="mt-2 p-3 bg-muted/50 rounded-md border">
          <p className="text-xs text-muted-foreground mb-3">
            Sæt forskellige provision/omsætning alt efter hvilken kampagne produktet "{productName}" kommer fra.
            Standard: {baseCommission} kr provision, {baseRevenue} kr omsætning.
          </p>

          {(loadingCampaigns || loadingOverrides) ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Indlæser kampagner...
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen kampagner fundet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {campaigns.map((campaign) => {
                const override = getOverrideForCampaign(campaign.id);
                const edited = editedOverrides[campaign.id] ?? {
                  commission: override ? String(override.commission_dkk) : "",
                  revenue: override ? String(override.revenue_dkk) : "",
                };
                const hasChanged =
                  edited.commission !== (override ? String(override.commission_dkk) : "") ||
                  edited.revenue !== (override ? String(override.revenue_dkk) : "");

                return (
                  <div
                    key={campaign.id}
                    className={`flex items-center gap-2 p-2 rounded ${
                      hasOverride(campaign.id) ? "bg-primary/5 border border-primary/20" : "bg-background"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium truncate block">
                        {campaign.adversus_campaign_name || campaign.adversus_campaign_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Prov:</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-7 w-16 text-xs"
                          placeholder={String(baseCommission)}
                          value={edited.commission}
                          onChange={(e) => handleInputChange(campaign.id, "commission", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Oms:</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-7 w-16 text-xs"
                          placeholder={String(baseRevenue)}
                          value={edited.revenue}
                          onChange={(e) => handleInputChange(campaign.id, "revenue", e.target.value)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSave(campaign.id)}
                        disabled={!hasChanged && !edited.commission && !edited.revenue}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
