import { useState, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ChevronDown, CalendarIcon, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMgTestMutationSync } from "@/hooks/useMgTestMutationSync";

// Available condition keys and their possible values
const CONDITION_OPTIONS: Record<string, string[]> = {
  // Adversus betingelser (Relatel etc.)
  Bindingsperiode: ["12", "24", "36"],
  "Tilfredshedsgaranti - Switch": ["Ja", "Nej"],
  "Tilfredshedsgaranti - MBB": ["Ja", "Nej"],
  Tilskud: ["0%", "100%"],
  "Hoved oms trin": ["ATL", "1", "3", "5"],
  "Omstillingsbruger trin": ["ATL", "1", "3", "5"],
  
  // ASE/Enreach betingelser
  "A-kasse type": ["Lønmodtager", "Ung under uddannelse", "Selvstændig"],
  "A-kasse salg": ["Ja", "Nej"],
  "Forening": ["Fagforening med lønsikring", "Ase Lønmodtager"],
  "Lønsikring": ["Lønsikring Udvidet", "Lønsikring Super"],
};

// Keys that use numeric comparison instead of dropdown
const NUMERIC_CONDITION_KEYS = ["Dækningssum"];

// Operators for numeric conditions
const NUMERIC_OPERATORS = [
  { value: "gte", label: "Over eller lig med (≥)" },
  { value: "lte", label: "Under eller lig med (≤)" },
  { value: "gt", label: "Over (>)" },
  { value: "lt", label: "Under (<)" },
  { value: "between", label: "Mellem (interval)" },
  { value: "in", label: "Er en af (multi-valg)" },
];

// Type for numeric condition value
interface NumericConditionValue {
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'between' | 'in';
  value: number;
  value2?: number;
  values?: number[];
}

// Check if a condition value is numeric
function isNumericCondition(value: unknown): value is NumericConditionValue {
  return typeof value === 'object' && value !== null && 'operator' in value && 'value' in value;
}

interface PricingRule {
  id: string;
  product_id: string;
  campaign_mapping_ids: string[] | null;
  conditions: Record<string, string | NumericConditionValue>;
  commission_dkk: number;
  revenue_dkk: number;
  priority: number;
  name: string | null;
  is_active: boolean;
  allows_immediate_payment?: boolean;
  immediate_payment_commission_dkk?: number | null;
  immediate_payment_revenue_dkk?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  use_rule_name_as_display?: boolean;
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

// Inline multi-value input for "in" operator
function InMultiValueInput({ values, onAdd, onRemove }: { values: number[]; onAdd: (v: number) => void; onRemove: (v: number) => void }) {
  const [inputVal, setInputVal] = useState("");
  const handleAdd = () => {
    const num = parseFloat(inputVal);
    if (!isNaN(num) && !values.includes(num)) {
      onAdd(num);
      setInputVal("");
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <Input
          type="number"
          className="w-28"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Beløb"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="h-10 px-2">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 cursor-pointer" onClick={() => onRemove(v)}>
              {v.toLocaleString("da-DK")}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
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
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>(
    existingRule?.campaign_mapping_ids || []
  );
  const [campaignsOpen, setCampaignsOpen] = useState(false);
  const [conditions, setConditions] = useState<Record<string, string | NumericConditionValue>>(
    existingRule?.conditions || {}
  );
  const [commission, setCommission] = useState(
    existingRule?.commission_dkk?.toString() || baseCommission.toString()
  );
  const [revenue, setRevenue] = useState(
    existingRule?.revenue_dkk?.toString() || baseRevenue.toString()
  );
  const [isActive, setIsActive] = useState(existingRule?.is_active ?? true);
  const [allowsImmediatePayment, setAllowsImmediatePayment] = useState(
    existingRule?.allows_immediate_payment ?? false
  );
  const [immediatePaymentCommission, setImmediatePaymentCommission] = useState(
    existingRule?.immediate_payment_commission_dkk?.toString() || ""
  );
  const [immediatePaymentRevenue, setImmediatePaymentRevenue] = useState(
    existingRule?.immediate_payment_revenue_dkk?.toString() || ""
  );
  
  // Date validity fields
  const [effectiveFrom, setEffectiveFrom] = useState<Date>(
    existingRule?.effective_from ? new Date(existingRule.effective_from) : new Date()
  );
  const [effectiveTo, setEffectiveTo] = useState<Date | undefined>(
    existingRule?.effective_to ? new Date(existingRule.effective_to) : undefined
  );
  const [hasEndDate, setHasEndDate] = useState(!!existingRule?.effective_to);
  const [useRuleNameAsDisplay, setUseRuleNameAsDisplay] = useState(
    existingRule?.use_rule_name_as_display ?? false
  );
  const [isRematching, setIsRematching] = useState(false);
  
  // Rematch hook
  const rematchMutation = useRematchPricingRules();

  // Get available condition keys (not already used) - include numeric keys
  const usedKeys = Object.keys(conditions);
  const allAvailableKeys = [...Object.keys(CONDITION_OPTIONS), ...NUMERIC_CONDITION_KEYS];
  const availableKeys = allAvailableKeys.filter(
    (key) => !usedKeys.includes(key)
  );

  const toggleCampaign = (campaignId: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(campaignId)
        ? prev.filter((id) => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const selectAllCampaigns = () => {
    setSelectedCampaignIds(campaigns.map((c) => c.id));
  };

  const clearAllCampaigns = () => {
    setSelectedCampaignIds([]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Convert conditions to JSON-compatible format for Supabase
      const conditionsJson = JSON.parse(JSON.stringify(conditions));
      
      const ruleData = {
        product_id: productId,
        campaign_mapping_ids: selectedCampaignIds.length > 0 ? selectedCampaignIds : null,
        conditions: conditionsJson,
        commission_dkk: parseFloat(commission) || 0,
        revenue_dkk: parseFloat(revenue) || 0,
        priority,
        name: name || null,
        is_active: isActive,
        allows_immediate_payment: allowsImmediatePayment,
        immediate_payment_commission_dkk: allowsImmediatePayment && immediatePaymentCommission 
          ? parseFloat(immediatePaymentCommission) 
          : null,
        immediate_payment_revenue_dkk: allowsImmediatePayment && immediatePaymentRevenue 
          ? parseFloat(immediatePaymentRevenue) 
          : null,
        effective_from: format(effectiveFrom, "yyyy-MM-dd"),
        effective_to: hasEndDate && effectiveTo ? format(effectiveTo, "yyyy-MM-dd") : null,
        use_rule_name_as_display: useRuleNameAsDisplay,
      };

      if (existingRule) {
        // Update existing rule
        const { error } = await supabase
          .from("product_pricing_rules")
          .update(ruleData)
          .eq("id", existingRule.id);

        if (error) throw error;
        
        // Log to history
        await supabase.from("pricing_rule_history").insert({
          pricing_rule_id: existingRule.id,
          name: ruleData.name,
          commission_dkk: ruleData.commission_dkk,
          revenue_dkk: ruleData.revenue_dkk,
          conditions: ruleData.conditions,
          campaign_mapping_ids: ruleData.campaign_mapping_ids,
          effective_from: ruleData.effective_from,
          effective_to: ruleData.effective_to,
          priority: ruleData.priority,
          is_active: ruleData.is_active,
          allows_immediate_payment: ruleData.allows_immediate_payment,
          immediate_payment_commission_dkk: ruleData.immediate_payment_commission_dkk,
          immediate_payment_revenue_dkk: ruleData.immediate_payment_revenue_dkk,
          use_rule_name_as_display: ruleData.use_rule_name_as_display,
          change_type: 'update'
        });
      } else {
        // Create new rule
        const { data, error } = await supabase
          .from("product_pricing_rules")
          .insert(ruleData)
          .select("id")
          .single();

        if (error) throw error;
        
        // Log to history
        await supabase.from("pricing_rule_history").insert({
          pricing_rule_id: data.id,
          name: ruleData.name,
          commission_dkk: ruleData.commission_dkk,
          revenue_dkk: ruleData.revenue_dkk,
          conditions: ruleData.conditions,
          campaign_mapping_ids: ruleData.campaign_mapping_ids,
          effective_from: ruleData.effective_from,
          effective_to: ruleData.effective_to,
          priority: ruleData.priority,
          is_active: ruleData.is_active,
          allows_immediate_payment: ruleData.allows_immediate_payment,
          immediate_payment_commission_dkk: ruleData.immediate_payment_commission_dkk,
          immediate_payment_revenue_dkk: ruleData.immediate_payment_revenue_dkk,
          use_rule_name_as_display: ruleData.use_rule_name_as_display,
          change_type: 'create'
        });
      }
    },
    onSuccess: () => {
      toast.success(existingRule ? "Regel opdateret" : "Regel oprettet");
      onSave();
      
      // Fire-and-forget rematch in background
      toast.info("Opdaterer salg i baggrunden...");
      rematchMutation.mutate(
        { productId },
        {
          onSuccess: (result) => {
            if (result.stats.updated > 0) {
              toast.success(`✓ ${result.stats.updated} salg opdateret med nye prisregler`);
            } else {
              toast.info("Ingen salg blev opdateret");
            }
          },
          onError: () => {
            toast.error("Baggrundsopdatering fejlede — prøv rematch manuelt");
          },
        }
      );
    },
    onError: (error) => {
      toast.error("Kunne ikke gemme regel: " + error.message);
    },
  });

  const addCondition = (key: string) => {
    if (NUMERIC_CONDITION_KEYS.includes(key)) {
      // Add numeric condition with default values
      setConditions((prev) => ({ 
        ...prev, 
        [key]: { operator: 'gte' as const, value: 0 } 
      }));
    } else {
      const defaultValue = CONDITION_OPTIONS[key]?.[0] || "";
      setConditions((prev) => ({ ...prev, [key]: defaultValue }));
    }
  };

  const updateCondition = (key: string, value: string | NumericConditionValue) => {
    setConditions((prev) => ({ ...prev, [key]: value }));
  };

  const updateNumericCondition = (key: string, field: 'operator' | 'value' | 'value2', newValue: string | number) => {
    setConditions((prev) => {
      const currentValue = prev[key];
      if (isNumericCondition(currentValue)) {
        const updated = {
          ...currentValue,
          [field]: (field === 'value' || field === 'value2') ? Number(newValue) : newValue
        };
        // When switching to 'between', ensure value2 exists
        if (field === 'operator' && newValue === 'between' && updated.value2 === undefined) {
          updated.value2 = 0;
        }
        // When switching to 'in', initialize values array
        if (field === 'operator' && newValue === 'in' && !updated.values) {
          updated.values = [];
        }
        return { ...prev, [key]: updated };
      }
      return prev;
    });
  };

  const addNumericValue = (key: string, newVal: number) => {
    setConditions((prev) => {
      const currentValue = prev[key];
      if (isNumericCondition(currentValue)) {
        const existing = currentValue.values ?? [];
        if (!existing.includes(newVal)) {
          return { ...prev, [key]: { ...currentValue, values: [...existing, newVal].sort((a, b) => a - b) } };
        }
      }
      return prev;
    });
  };

  const removeNumericValue = (key: string, valToRemove: number) => {
    setConditions((prev) => {
      const currentValue = prev[key];
      if (isNumericCondition(currentValue)) {
        return { ...prev, [key]: { ...currentValue, values: (currentValue.values ?? []).filter(v => v !== valToRemove) } };
      }
      return prev;
    });
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
          {name && (
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="use-rule-name"
                checked={useRuleNameAsDisplay}
                onCheckedChange={(checked) => setUseRuleNameAsDisplay(!!checked)}
              />
              <Label htmlFor="use-rule-name" className="text-sm cursor-pointer">
                Brug dette navn i dashboards
              </Label>
            </div>
          )}
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

      {/* Campaign selection - Multi-select */}
      <div className="space-y-2">
        <Label>Kampagner (valgfri)</Label>
        <Collapsible open={campaignsOpen} onOpenChange={setCampaignsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-normal"
            >
              <span>
                {selectedCampaignIds.length === 0
                  ? "Alle kampagner"
                  : selectedCampaignIds.length === 1
                    ? campaigns.find((c) => c.id === selectedCampaignIds[0])
                        ?.adversus_campaign_name || "1 kampagne valgt"
                    : `${selectedCampaignIds.length} kampagner valgt`}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${campaignsOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              <div className="flex gap-2 pb-2 border-b">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllCampaigns}
                  className="text-xs"
                >
                  Vælg alle
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllCampaigns}
                  className="text-xs"
                >
                  Ryd valg
                </Button>
              </div>
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center gap-2 hover:bg-muted/50 p-1 rounded cursor-pointer"
                  onClick={() => toggleCampaign(campaign.id)}
                >
                  <Checkbox
                    checked={selectedCampaignIds.includes(campaign.id)}
                    onCheckedChange={() => toggleCampaign(campaign.id)}
                  />
                  <span className="text-sm">
                    {campaign.adversus_campaign_name || "Unavngivet"}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
        <p className="text-xs text-muted-foreground">
          Vælg ingen for at reglen gælder alle kampagner
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
                <span className="flex-shrink-0 font-medium text-sm">{key}</span>
                
                {isNumericCondition(value) ? (
                  // Numeric condition UI: operator dropdown + number input
                  <>
                    <Select
                      value={value.operator}
                      onValueChange={(op) => updateNumericCondition(key, 'operator', op)}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NUMERIC_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {value.operator !== 'in' && (
                      <Input
                        type="number"
                        className="w-28"
                        value={value.value}
                        onChange={(e) => updateNumericCondition(key, 'value', e.target.value)}
                        placeholder={value.operator === 'between' ? 'Fra' : 'Beløb'}
                      />
                    )}
                    {value.operator === 'between' && (
                      <>
                        <span className="text-muted-foreground text-sm">og</span>
                        <Input
                          type="number"
                          className="w-28"
                          value={value.value2 ?? 0}
                          onChange={(e) => updateNumericCondition(key, 'value2', e.target.value)}
                          placeholder="Til"
                        />
                      </>
                    )}
                    {value.operator === 'in' && (
                      <InMultiValueInput
                        values={value.values ?? []}
                        onAdd={(v) => addNumericValue(key, v)}
                        onRemove={(v) => removeNumericValue(key, v)}
                      />
                    )}
                  </>
                ) : (
                  // String condition UI: equals + dropdown
                  <>
                    <span className="text-muted-foreground">=</span>
                    <Select
                      value={value as string}
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
                  </>
                )}
                
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

      {/* Immediate payment toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="rule-immediate-payment">💳 Mulighed for straksbetaling</Label>
            <p className="text-xs text-muted-foreground">
              Tillad straksbetaling for salg med denne regel
            </p>
          </div>
          <Switch
            id="rule-immediate-payment"
            checked={allowsImmediatePayment}
            onCheckedChange={setAllowsImmediatePayment}
          />
        </div>

        {/* Immediate payment pricing fields */}
        {allowsImmediatePayment && (
          <div className="bg-muted/30 p-4 rounded-md space-y-3 ml-4 border-l-2 border-primary/20">
            <Label>💰 Prissætning ved straksbetaling</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="immediate-commission">Provision (kr)</Label>
                <Input
                  id="immediate-commission"
                  type="number"
                  step="0.01"
                  value={immediatePaymentCommission}
                  onChange={(e) => setImmediatePaymentCommission(e.target.value)}
                  placeholder="f.eks. 500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="immediate-revenue">Omsætning (kr)</Label>
                <Input
                  id="immediate-revenue"
                  type="number"
                  step="0.01"
                  value={immediatePaymentRevenue}
                  onChange={(e) => setImmediatePaymentRevenue(e.target.value)}
                  placeholder="f.eks. 1000"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Date validity */}
      <div className="space-y-3">
        <Label>📅 Gyldighedsperiode</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Gyldig fra</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(effectiveFrom, "d. MMM yyyy", { locale: da })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={effectiveFrom}
                  onSelect={(date) => date && setEffectiveFrom(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="has-end-date"
                checked={hasEndDate}
                onCheckedChange={(checked) => {
                  setHasEndDate(!!checked);
                  if (!checked) setEffectiveTo(undefined);
                }}
              />
              <Label htmlFor="has-end-date" className="text-sm cursor-pointer">Gyldig til</Label>
            </div>
            {hasEndDate && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {effectiveTo ? format(effectiveTo, "d. MMM yyyy", { locale: da }) : "Vælg dato"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={effectiveTo}
                    onSelect={(date) => date && setEffectiveTo(date)}
                    initialFocus
                    className="pointer-events-auto"
                    disabled={(date) => date <= effectiveFrom}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Reglen gælder fra "Gyldig fra" datoen. Hvis "Gyldig til" er sat, stopper reglen med at matche salg fra denne dato.
        </p>
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
        <Button variant="outline" onClick={onCancel} disabled={saveMutation.isPending || isRematching}>
          Annuller
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isRematching}
        >
          {(saveMutation.isPending || isRematching) && (
            <Loader2 className="h-3 w-3 animate-spin mr-2" />
          )}
          {isRematching ? "Opdaterer salg..." : saveMutation.isPending ? "Gemmer..." : "Gem regel"}
        </Button>
      </div>
    </div>
  );
}
