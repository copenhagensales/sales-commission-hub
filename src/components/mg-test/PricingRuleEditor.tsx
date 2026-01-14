import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

// Available condition keys and their possible values
const CONDITION_OPTIONS: Record<string, string[]> = {
  Bindingsperiode: ["12", "24", "36"],
  "Tilfredshedsgaranti - Switch": ["Ja", "Nej"],
  "Tilfredshedsgaranti - MBB": ["Ja", "Nej"],
  Tilskud: ["0%", "100%"],
  "Hoved oms trin": ["ATL", "1", "3", "5"],
  "Omstillingsbruger trin": ["ATL", "1", "3", "5"],
};

interface PricingRule {
  id: string;
  product_id: string;
  campaign_mapping_id: string | null;
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

interface PricingRuleEditorProps {
  productId: string;
  productName: string;
  baseCommission: number;
  baseRevenue: number;
  campaigns: CampaignMapping[];
  existingRule?: PricingRule | null;
  onSave: () => void;
  onCancel: () => void;
}

export function PricingRuleEditor({
  productId,
  productName,
  baseCommission,
  baseRevenue,
  campaigns,
  existingRule,
  onSave,
  onCancel,
}: PricingRuleEditorProps) {
  const [name, setName] = useState(existingRule?.name || "");
  const [priority, setPriority] = useState(existingRule?.priority || 0);
  const [campaignMappingId, setCampaignMappingId] = useState<string | null>(
    existingRule?.campaign_mapping_id || null
  );
  const [conditions, setConditions] = useState<Record<string, string>>(
    existingRule?.conditions || {}
  );
  const [commission, setCommission] = useState(
    existingRule?.commission_dkk?.toString() || baseCommission.toString()
  );
  const [revenue, setRevenue] = useState(
    existingRule?.revenue_dkk?.toString() || baseRevenue.toString()
  );
  const [isActive, setIsActive] = useState(existingRule?.is_active ?? true);

  // Get available condition keys (not already used)
  const usedKeys = Object.keys(conditions);
  const availableKeys = Object.keys(CONDITION_OPTIONS).filter(
    (key) => !usedKeys.includes(key)
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ruleData = {
        product_id: productId,
        campaign_mapping_id: campaignMappingId,
        conditions,
        commission_dkk: parseFloat(commission) || 0,
        revenue_dkk: parseFloat(revenue) || 0,
        priority,
        name: name || null,
        is_active: isActive,
      };

      if (existingRule) {
        // Update existing rule
        const { error } = await supabase
          .from("product_pricing_rules")
          .update(ruleData)
          .eq("id", existingRule.id);

        if (error) throw error;
      } else {
        // Create new rule
        const { error } = await supabase
          .from("product_pricing_rules")
          .insert(ruleData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(existingRule ? "Regel opdateret" : "Regel oprettet");
      onSave();
    },
    onError: (error) => {
      toast.error("Kunne ikke gemme regel: " + error.message);
    },
  });

  const addCondition = (key: string) => {
    const defaultValue = CONDITION_OPTIONS[key]?.[0] || "";
    setConditions((prev) => ({ ...prev, [key]: defaultValue }));
  };

  const updateCondition = (key: string, value: string) => {
    setConditions((prev) => ({ ...prev, [key]: value }));
  };

  const removeCondition = (key: string) => {
    setConditions((prev) => {
      const newConditions = { ...prev };
      delete newConditions[key];
      return newConditions;
    });
  };

  return (
    <div className="space-y-6">
      {/* Base info */}
      <div className="bg-muted/50 p-3 rounded-md text-sm">
        <strong>Produkt:</strong> {productName}
        <br />
        <span className="text-muted-foreground">
          Base: {baseCommission} kr prov / {baseRevenue} kr oms
        </span>
      </div>

      {/* Name and priority */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rule-name">Navn (valgfri)</Label>
          <Input
            id="rule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="f.eks. ATL Fuld Tilskud"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rule-priority">Prioritet</Label>
          <Input
            id="rule-priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Højere = matcher først
          </p>
        </div>
      </div>

      {/* Campaign selection */}
      <div className="space-y-2">
        <Label>Kampagne (valgfri)</Label>
        <Select
          value={campaignMappingId || "all"}
          onValueChange={(value) =>
            setCampaignMappingId(value === "all" ? null : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Vælg kampagne" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kampagner</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.adversus_campaign_name || "Unavngivet"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Lad stå på "Alle kampagner" hvis reglen skal gælde uanset kampagne
        </p>
      </div>

      {/* Conditions */}
      <div className="space-y-3">
        <Label>📋 Betingelser (alle skal matche)</Label>

        {Object.entries(conditions).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(conditions).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 bg-muted/30 p-2 rounded"
              >
                <span className="flex-1 font-medium text-sm">{key}</span>
                <span className="text-muted-foreground">=</span>
                <Select
                  value={value}
                  onValueChange={(newValue) => updateCondition(key, newValue)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS[key]?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(key)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Ingen betingelser tilføjet - reglen matcher alle salg
          </p>
        )}

        {availableKeys.length > 0 && (
          <Select onValueChange={(key) => addCondition(key)}>
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Tilføj betingelse</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Pricing */}
      <div className="space-y-3">
        <Label>💰 Prissætning</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rule-commission">Provision (kr)</Label>
            <Input
              id="rule-commission"
              type="number"
              step="0.01"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-revenue">Omsætning (kr)</Label>
            <Input
              id="rule-revenue"
              type="number"
              step="0.01"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="rule-active">Aktiv</Label>
        <Switch
          id="rule-active"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Annuller
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Gemmer..." : "Gem regel"}
        </Button>
      </div>
    </div>
  );
}
