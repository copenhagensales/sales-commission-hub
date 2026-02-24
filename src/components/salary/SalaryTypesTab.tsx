import { useState, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Search, ChevronsUpDown, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<SalaryType | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, string | null>>({});
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);
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

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-salary-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Load assigned employees when editing
  useEffect(() => {
    if (editingType) {
      supabase
        .from("salary_type_employees")
        .select("employee_id, effective_from")
        .eq("salary_type_id", editingType.id)
        .then(({ data }) => {
          const record: Record<string, string | null> = {};
          data?.forEach((d: any) => { record[d.employee_id] = d.effective_from || null; });
          setSelectedEmployees(record);
        });
    } else {
      setSelectedEmployees({});
    }
  }, [editingType]);

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

  const saveEmployeeAssignments = async (salaryTypeId: string, emps: Record<string, string | null>) => {
    // Delete existing
    await supabase.from("salary_type_employees").delete().eq("salary_type_id", salaryTypeId);
    // Insert new
    const entries = Object.entries(emps);
    if (entries.length > 0) {
      const rows = entries.map(([eid, effectiveFrom]) => ({
        salary_type_id: salaryTypeId,
        employee_id: eid,
        effective_from: effectiveFrom || null,
      }));
      await supabase.from("salary_type_employees").insert(rows as any);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: inserted, error } = await supabase.from("salary_types").insert({
        name: data.name,
        description: data.description || null,
        amount: data.amount ? parseFloat(data.amount) : null,
        amount_type: data.amount_type,
        calculation_basis: data.calculation_basis,
        calculation_formula: data.calculation_formula || null,
        activation_condition: data.activation_condition || null,
        group_restriction_type: data.group_restriction_type,
        payout_frequency: data.payout_frequency,
      }).select("id").single();
      if (error) throw error;
      if (inserted && Object.keys(selectedEmployees).length > 0) {
        await saveEmployeeAssignments(inserted.id, selectedEmployees);
      }
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
      await saveEmployeeAssignments(id, selectedEmployees);
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
    setSelectedEmployees({});
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

              {/* Medarbejdere sektion */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Medarbejdere</h3>
                <div className="space-y-2">
                  <Label>Tilknyttede medarbejdere</Label>
                  <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                        type="button"
                      >
                        {Object.keys(selectedEmployees).length === 0
                          ? "Vælg medarbejdere..."
                          : `${Object.keys(selectedEmployees).length} medarbejder${Object.keys(selectedEmployees).length > 1 ? "e" : ""} valgt`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-background border z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Søg medarbejder..." />
                        <CommandList>
                          <CommandEmpty>Ingen medarbejdere fundet</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-y-auto">
                            {employees.map((emp) => (
                              <CommandItem
                                key={emp.id}
                                value={`${emp.first_name} ${emp.last_name}`}
                                onSelect={() => {
                                  setSelectedEmployees((prev) => {
                                    const next = { ...prev };
                                    if (emp.id in next) {
                                      delete next[emp.id];
                                    } else {
                                      next[emp.id] = null;
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <Checkbox
                                  checked={emp.id in selectedEmployees}
                                  className="mr-2"
                                />
                                {emp.first_name} {emp.last_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {Object.keys(selectedEmployees).length > 0 && (
                    <div className="space-y-2 mt-2">
                      {Object.entries(selectedEmployees).map(([eid, effectiveFrom]) => {
                        const emp = employees.find((e) => e.id === eid);
                        if (!emp) return null;
                        return (
                          <div key={eid} className="flex items-center gap-2 rounded-md border p-2">
                            <span className="text-sm font-medium flex-shrink-0">
                              {emp.first_name} {emp.last_name}
                            </span>
                            <div className="flex items-center gap-1 ml-auto">
                              <Label className="text-xs text-muted-foreground flex-shrink-0">Fra:</Label>
                              <Input
                                type="date"
                                value={effectiveFrom || ""}
                                onChange={(e) =>
                                  setSelectedEmployees((prev) => ({
                                    ...prev,
                                    [eid]: e.target.value || null,
                                  }))
                                }
                                className="h-8 w-[150px] text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedEmployees((prev) => {
                                  const next = { ...prev };
                                  delete next[eid];
                                  return next;
                                })
                              }
                              className="hover:text-destructive flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredTypes.map((type) => (
                <div key={type.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{type.name}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={type.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: type.id, isActive: checked })
                        }
                      />
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {type.description && (
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{formatAmount(type)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDefinition(type)}</span>
                  </div>
                </div>
              ))}
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
