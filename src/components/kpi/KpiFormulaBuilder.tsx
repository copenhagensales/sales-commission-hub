import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Calculator, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  useKpiFormulas,
  useCreateKpiFormula,
  useUpdateKpiFormula,
  useDeleteKpiFormula,
  BASE_METRICS,
  OPERATORS,
  KPI_TYPES,
  KpiFormula,
} from "@/hooks/useKpiFormulas";

interface FormulaFormData {
  name: string;
  description: string;
  leftOperand: string;
  operator: string;
  rightOperand: string;
  kpiType: string;
}

const initialFormData: FormulaFormData = {
  name: "",
  description: "",
  leftOperand: "",
  operator: "/",
  rightOperand: "",
  kpiType: "number",
};

export function KpiFormulaBuilder() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<KpiFormula | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormulaFormData>(initialFormData);

  const { data: formulas, isLoading } = useKpiFormulas();
  const createMutation = useCreateKpiFormula();
  const updateMutation = useUpdateKpiFormula();
  const deleteMutation = useDeleteKpiFormula();

  const handleOpenCreate = () => {
    setEditingFormula(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (formula: KpiFormula) => {
    setEditingFormula(formula);
    const parsed = parseFormula(formula.formula);
    setFormData({
      name: formula.name,
      description: formula.description || "",
      leftOperand: parsed.left,
      operator: parsed.operator,
      rightOperand: parsed.right,
      kpiType: formula.kpi_type,
    });
    setIsDialogOpen(true);
  };

  const parseFormula = (formula: string): { left: string; operator: string; right: string } => {
    const match = formula.match(/\{(\w+)\}\s*([+\-*/])\s*\{(\w+)\}/);
    if (match) {
      return { left: match[1], operator: match[2], right: match[3] };
    }
    return { left: "", operator: "/", right: "" };
  };

  const buildFormula = (): string => {
    return `{${formData.leftOperand}} ${formData.operator} {${formData.rightOperand}}`;
  };

  const getMetricLabel = (key: string): string => {
    return BASE_METRICS.find((m) => m.key === key)?.label || key;
  };

  const getOperatorLabel = (key: string): string => {
    return OPERATORS.find((o) => o.key === key)?.label || key;
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.leftOperand || !formData.rightOperand) {
      return;
    }

    const formula = buildFormula();

    if (editingFormula) {
      updateMutation.mutate(
        {
          id: editingFormula.id,
          name: formData.name,
          description: formData.description,
          formula,
          base_metric: formData.leftOperand,
          kpi_type: formData.kpiType,
        },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
            setEditingFormula(null);
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          name: formData.name,
          description: formData.description,
          formula,
          base_metric: formData.leftOperand,
          kpi_type: formData.kpiType,
        },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const isFormValid = formData.name && formData.leftOperand && formData.rightOperand;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Formelbygger</h2>
          <p className="text-sm text-muted-foreground">
            Sammensæt KPI'er ved at kombinere basis-metriker med matematiske operatorer
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Ny formel
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Tilgængelige basis-metriker</CardTitle>
          <CardDescription>
            Disse metriker kan kombineres til sammensatte KPI'er
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {BASE_METRICS.map((metric) => (
              <Badge key={metric.key} variant="secondary" className="text-xs">
                {metric.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Eksisterende formler</CardTitle>
          <CardDescription>
            {formulas?.length || 0} sammensatte KPI'er
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : formulas?.length === 0 ? (
            <div className="text-center py-8">
              <Calculator className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-sm">
                Ingen formler oprettet endnu. Klik "Ny formel" for at komme i gang.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {formulas?.map((formula) => {
                const parsed = parseFormula(formula.formula);
                return (
                  <Card key={formula.id} className="relative group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-medium">{formula.name}</h3>
                          {formula.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {formula.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEdit(formula)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteId(formula.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-center gap-2 text-sm font-mono">
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                            {getMetricLabel(parsed.left)}
                          </span>
                          <span className="text-lg font-bold">
                            {getOperatorLabel(parsed.operator)}
                          </span>
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                            {getMetricLabel(parsed.right)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {KPI_TYPES.find((t) => t.key === formula.kpi_type)?.label || formula.kpi_type}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingFormula ? "Rediger formel" : "Opret ny formel"}
            </DialogTitle>
            <DialogDescription>
              Sammensæt en KPI ved at vælge to metriker og en operator
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Navn</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="F.eks. Salg per time"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beskrivelse (valgfri)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Beskriv hvad denne KPI måler..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Formel</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={formData.leftOperand}
                  onValueChange={(v) => setFormData({ ...formData, leftOperand: v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Vælg metrik" />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_METRICS.map((metric) => (
                      <SelectItem key={metric.key} value={metric.key}>
                        {metric.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={formData.operator}
                  onValueChange={(v) => setFormData({ ...formData, operator: v })}
                >
                  <SelectTrigger className="w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.key} value={op.key}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={formData.rightOperand}
                  onValueChange={(v) => setFormData({ ...formData, rightOperand: v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Vælg metrik" />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_METRICS.map((metric) => (
                      <SelectItem key={metric.key} value={metric.key}>
                        {metric.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.leftOperand && formData.rightOperand && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Formel preview:</p>
                <div className="flex items-center justify-center gap-2 text-sm font-mono">
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                    {getMetricLabel(formData.leftOperand)}
                  </span>
                  <span className="text-lg font-bold">
                    {getOperatorLabel(formData.operator)}
                  </span>
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                    {getMetricLabel(formData.rightOperand)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Resultattype</Label>
              <Select
                value={formData.kpiType}
                onValueChange={(v) => setFormData({ ...formData, kpiType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KPI_TYPES.map((type) => (
                    <SelectItem key={type.key} value={type.key}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingFormula ? "Gem ændringer" : "Opret formel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet formel?</AlertDialogTitle>
            <AlertDialogDescription>
              Denne handling kan ikke fortrydes. Formlen vil blive permanent slettet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Slet"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
