import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Pencil, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SalaryType {
  id: string;
  name: string;
  description: string | null;
  amount: number | null;
  amount_type: "fixed" | "percentage";
  calculation_basis: "sales" | "hours" | "commission" | "fixed" | "custom";
  calculation_formula: string | null;
  activation_condition: string | null;
  group_restriction_type: "all" | "teams" | "positions" | "clients";
  group_restriction_ids: string[] | null;
  payout_frequency: "per_sale" | "daily" | "weekly" | "monthly" | "period";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type AmountType = "fixed" | "percentage";
type CalculationBasis = "sales" | "hours" | "commission" | "fixed" | "custom";
type GroupRestrictionType = "all" | "teams" | "positions" | "clients";
type PayoutFrequency = "per_sale" | "daily" | "weekly" | "monthly" | "period";

const CALCULATION_BASIS_LABELS: Record<CalculationBasis, string> = {
  sales: "Salg",
  hours: "Timer",
  commission: "Provision",
  fixed: "Fast",
  custom: "Tilpasset",
};

const GROUP_RESTRICTION_LABELS: Record<GroupRestrictionType, string> = {
  all: "Alle",
  teams: "Teams",
  positions: "Stillinger",
  clients: "Kunder",
};

const PAYOUT_FREQUENCY_LABELS: Record<PayoutFrequency, string> = {
  per_sale: "Per salg",
  daily: "Dagligt",
  weekly: "Ugentligt",
  monthly: "Månedligt",
  period: "Per periode",
};

export function SalaryTypesTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<SalaryType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    amount: "",
    amount_type: "fixed" as AmountType,
    calculation_basis: "fixed" as CalculationBasis,
    calculation_formula: "",
    activation_condition: "",
    group_restriction_type: "all" as GroupRestrictionType,
    payout_frequency: "monthly" as PayoutFrequency,
  });

  const { data: salaryTypes = [], isLoading } = useQuery({
    queryKey: ["salary-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SalaryType[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("salary_types").insert({
        name: data.name,
        description: data.description || null,
        amount: data.amount ? parseFloat(data.amount) : null,
        amount_type: data.amount_type,
        calculation_basis: data.calculation_basis,
        calculation_formula: data.calculation_formula || null,
        activation_condition: data.activation_condition || null,
        group_restriction_type: data.group_restriction_type,
        payout_frequency: data.payout_frequency,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-types"] });
      toast.success("Lønart oprettet");
      resetForm();
    },
    onError: () => {
      toast.error("Kunne ikke oprette lønart");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("salary_types")
        .update({
          name: data.name,
          description: data.description || null,
          amount: data.amount ? parseFloat(data.amount) : null,
          amount_type: data.amount_type,
          calculation_basis: data.calculation_basis,
          calculation_formula: data.calculation_formula || null,
          activation_condition: data.activation_condition || null,
          group_restriction_type: data.group_restriction_type,
          payout_frequency: data.payout_frequency,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-types"] });
      toast.success("Lønart opdateret");
      resetForm();
    },
    onError: () => {
      toast.error("Kunne ikke opdatere lønart");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("salary_types")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-types"] });
      toast.success("Status opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere status");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      amount: "",
      amount_type: "fixed",
      calculation_basis: "fixed",
      calculation_formula: "",
      activation_condition: "",
      group_restriction_type: "all",
      payout_frequency: "monthly",
    });
    setEditingType(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (type: SalaryType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description || "",
      amount: type.amount?.toString() || "",
      amount_type: type.amount_type || "fixed",
      calculation_basis: type.calculation_basis || "fixed",
      calculation_formula: type.calculation_formula || "",
      activation_condition: type.activation_condition || "",
      group_restriction_type: type.group_restriction_type || "all",
      payout_frequency: type.payout_frequency || "monthly",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Navn er påkrævet");
      return;
    }

    if (editingType) {
      updateMutation.mutate({
        id: editingType.id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatAmount = (type: SalaryType) => {
    if (type.amount === null) return "-";
    const value = type.amount;
    return type.amount_type === "percentage" ? `${value}%` : `${value} kr`;
  };

  const formatDefinition = (type: SalaryType) => {
    const parts: string[] = [];
    parts.push(CALCULATION_BASIS_LABELS[type.calculation_basis] || "Fast");
    parts.push(GROUP_RESTRICTION_LABELS[type.group_restriction_type] || "Alle");
    parts.push(PAYOUT_FREQUENCY_LABELS[type.payout_frequency] || "Månedligt");
    return parts.join(" · ");
  };

  const filteredTypes = salaryTypes.filter(
    (type) =>
      type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ny lønart
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingType ? "Rediger lønart" : "Opret ny lønart"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Grundlæggende sektion */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Grundlæggende</h3>
                <div className="space-y-2">
                  <Label htmlFor="name">Navn *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="F.eks. Grundløn, Overarbejde..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beskrivelse</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Hvad dækker denne lønart?"
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Beløb sektion */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Beløb</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Værdi</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="F.eks. 300 eller 12.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount_type">Type</Label>
                    <Select
                      value={formData.amount_type}
                      onValueChange={(value: AmountType) => setFormData({ ...formData, amount_type: value })}
                    >
                      <SelectTrigger id="amount_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fast beløb (kr)</SelectItem>
                        <SelectItem value="percentage">Procent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Definition sektion */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Definition</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="calculation_basis">Beregningsgrundlag</Label>
                  <Select
                    value={formData.calculation_basis}
                    onValueChange={(value: CalculationBasis) => setFormData({ ...formData, calculation_basis: value })}
                  >
                    <SelectTrigger id="calculation_basis">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fast</SelectItem>
                      <SelectItem value="sales">Salg</SelectItem>
                      <SelectItem value="hours">Timer</SelectItem>
                      <SelectItem value="commission">Provision</SelectItem>
                      <SelectItem value="custom">Tilpasset</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.calculation_basis === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="calculation_formula">Beregningsformel</Label>
                    <Textarea
                      id="calculation_formula"
                      value={formData.calculation_formula}
                      onChange={(e) => setFormData({ ...formData, calculation_formula: e.target.value })}
                      placeholder="Beskriv hvordan beløbet beregnes..."
                      rows={2}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="activation_condition">Aktiveringsbetingelse</Label>
                  <Textarea
                    id="activation_condition"
                    value={formData.activation_condition}
                    onChange={(e) => setFormData({ ...formData, activation_condition: e.target.value })}
                    placeholder="Hvornår aktiveres denne lønart? F.eks. 'Ved mindst 10 salg per dag'"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group_restriction_type">Begrænsning til grupper</Label>
                  <Select
                    value={formData.group_restriction_type}
                    onValueChange={(value: GroupRestrictionType) => setFormData({ ...formData, group_restriction_type: value })}
                  >
                    <SelectTrigger id="group_restriction_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle medarbejdere</SelectItem>
                      <SelectItem value="teams">Bestemte teams</SelectItem>
                      <SelectItem value="positions">Bestemte stillinger</SelectItem>
                      <SelectItem value="clients">Bestemte kunder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payout_frequency">Udbetalingsfrekvens</Label>
                  <Select
                    value={formData.payout_frequency}
                    onValueChange={(value: PayoutFrequency) => setFormData({ ...formData, payout_frequency: value })}
                  >
                    <SelectTrigger id="payout_frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_sale">Per salg</SelectItem>
                      <SelectItem value="daily">Dagligt</SelectItem>
                      <SelectItem value="weekly">Ugentligt</SelectItem>
                      <SelectItem value="monthly">Månedligt</SelectItem>
                      <SelectItem value="period">Per lønperiode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Annuller
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingType ? "Gem ændringer" : "Opret"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter lønart..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{filteredTypes.length} lønarter</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Indlæser...</div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Ingen lønarter matcher din søgning" : "Ingen lønarter oprettet endnu"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead>Beløb</TableHead>
                  <TableHead>Definition</TableHead>
                  <TableHead className="text-center">Aktiv</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {type.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatAmount(type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDefinition(type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={type.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: type.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(type)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
