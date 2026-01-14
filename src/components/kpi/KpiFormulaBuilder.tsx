import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { Plus, Calculator, Pencil, Trash2, Loader2, X, Parentheses, BookOpen, BarChart3 } from "lucide-react";
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
import { useKpiDefinitions, KpiDefinition } from "@/hooks/useKpiDefinitions";

// Formula token types
type TokenType = "metric" | "kpi" | "operator" | "number" | "parenthesis";

interface FormulaToken {
  id: string;
  type: TokenType;
  value: string;
  label: string;
}

interface FormulaFormData {
  name: string;
  description: string;
  tokens: FormulaToken[];
  kpiType: string;
}

const initialFormData: FormulaFormData = {
  name: "",
  description: "",
  tokens: [],
  kpiType: "number",
};

// Generate unique ID for tokens
const generateTokenId = () => Math.random().toString(36).substring(2, 9);

export function KpiFormulaBuilder() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<KpiFormula | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormulaFormData>(initialFormData);

  const { data: formulas, isLoading } = useKpiFormulas();
  const { data: kpiDefinitions } = useKpiDefinitions();
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
    const tokens = parseFormulaToTokens(formula.formula);
    setFormData({
      name: formula.name,
      description: formula.description || "",
      tokens,
      kpiType: formula.kpi_type,
    });
    setIsDialogOpen(true);
  };

  // Parse formula string to tokens
  const parseFormulaToTokens = (formula: string): FormulaToken[] => {
    const tokens: FormulaToken[] = [];
    // Match {metric}, operators, numbers, and parentheses
    const regex = /\{([^}]+)\}|([+\-*/])|(\d+\.?\d*)|([()])/g;
    let match;

    while ((match = regex.exec(formula)) !== null) {
      if (match[1]) {
        // Metric or KPI reference
        const value = match[1];
        const kpiDef = kpiDefinitions?.find((k) => k.slug === value);
        const baseMetric = BASE_METRICS.find((m) => m.key === value);

        if (kpiDef) {
          tokens.push({
            id: generateTokenId(),
            type: "kpi",
            value: kpiDef.slug,
            label: kpiDef.name,
          });
        } else if (baseMetric) {
          tokens.push({
            id: generateTokenId(),
            type: "metric",
            value: baseMetric.key,
            label: baseMetric.label,
          });
        } else {
          tokens.push({
            id: generateTokenId(),
            type: "metric",
            value,
            label: value,
          });
        }
      } else if (match[2]) {
        // Operator
        const op = OPERATORS.find((o) => o.key === match[2]);
        tokens.push({
          id: generateTokenId(),
          type: "operator",
          value: match[2],
          label: op?.label || match[2],
        });
      } else if (match[3]) {
        // Number
        tokens.push({
          id: generateTokenId(),
          type: "number",
          value: match[3],
          label: match[3],
        });
      } else if (match[4]) {
        // Parenthesis
        tokens.push({
          id: generateTokenId(),
          type: "parenthesis",
          value: match[4],
          label: match[4],
        });
      }
    }

    return tokens;
  };

  // Build formula string from tokens
  const buildFormulaFromTokens = (tokens: FormulaToken[]): string => {
    return tokens
      .map((token) => {
        if (token.type === "metric" || token.type === "kpi") {
          return `{${token.value}}`;
        } else if (token.type === "number") {
          return token.value;
        } else {
          return ` ${token.value} `;
        }
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Add token to formula
  const addToken = (token: Omit<FormulaToken, "id">) => {
    setFormData({
      ...formData,
      tokens: [...formData.tokens, { ...token, id: generateTokenId() }],
    });
  };

  // Remove token from formula
  const removeToken = (tokenId: string) => {
    setFormData({
      ...formData,
      tokens: formData.tokens.filter((t) => t.id !== tokenId),
    });
  };

  // Clear all tokens
  const clearTokens = () => {
    setFormData({ ...formData, tokens: [] });
  };

  const getMetricLabel = (key: string): string => {
    const kpiDef = kpiDefinitions?.find((k) => k.slug === key);
    if (kpiDef) return kpiDef.name;
    return BASE_METRICS.find((m) => m.key === key)?.label || key;
  };

  const getOperatorLabel = (key: string): string => {
    return OPERATORS.find((o) => o.key === key)?.label || key;
  };

  // Render formula preview from tokens
  const renderFormulaPreview = (tokens: FormulaToken[]) => {
    if (tokens.length === 0) {
      return (
        <span className="text-muted-foreground italic">
          Byg din formel ved at klikke på metriker og operatorer nedenfor
        </span>
      );
    }

    return tokens.map((token) => {
      if (token.type === "metric") {
        return (
          <span
            key={token.id}
            className="inline-flex items-center px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-sm mx-0.5"
          >
            {token.label}
          </span>
        );
      } else if (token.type === "kpi") {
        return (
          <span
            key={token.id}
            className="inline-flex items-center px-2 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded text-sm mx-0.5"
          >
            <BookOpen className="h-3 w-3 mr-1" />
            {token.label}
          </span>
        );
      } else if (token.type === "operator") {
        return (
          <span key={token.id} className="mx-1 text-lg font-bold">
            {token.label}
          </span>
        );
      } else if (token.type === "number") {
        return (
          <span
            key={token.id}
            className="inline-flex items-center px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-sm mx-0.5"
          >
            {token.label}
          </span>
        );
      } else if (token.type === "parenthesis") {
        return (
          <span key={token.id} className="text-lg font-bold mx-0.5">
            {token.value}
          </span>
        );
      }
      return null;
    });
  };

  const handleSubmit = () => {
    if (!formData.name || formData.tokens.length === 0) {
      return;
    }

    const formula = buildFormulaFromTokens(formData.tokens);
    const firstMetric = formData.tokens.find((t) => t.type === "metric" || t.type === "kpi");

    if (editingFormula) {
      updateMutation.mutate(
        {
          id: editingFormula.id,
          name: formData.name,
          description: formData.description,
          formula,
          base_metric: firstMetric?.value,
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
          base_metric: firstMetric?.value,
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

  const isFormValid = formData.name && formData.tokens.length > 0;

  // Group KPI definitions by category
  const kpisByCategory = kpiDefinitions?.reduce(
    (acc, kpi) => {
      if (!acc[kpi.category]) {
        acc[kpi.category] = [];
      }
      acc[kpi.category].push(kpi);
      return acc;
    },
    {} as Record<string, KpiDefinition[]>
  );

  const categoryLabels: Record<string, string> = {
    sales: "Salg",
    hours: "Timer",
    calls: "Opkald",
    employees: "Medarbejdere",
    other: "Andet",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Formelbygger</h2>
          <p className="text-sm text-muted-foreground">
            Sammensæt avancerede KPI'er ved at kombinere metriker og KPI-definitioner
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Ny formel
        </Button>
      </div>

      {/* Available metrics and KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Basis-metriker</CardTitle>
            <CardDescription>Rå datapunkter fra systemet</CardDescription>
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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              KPI Definitioner
            </CardTitle>
            <CardDescription>
              {kpiDefinitions?.length || 0} dokumenterede KPI'er fra Definitioner-fanen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(kpisByCategory || {}).map(([category, kpis]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {categoryLabels[category] || category}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {kpis.length}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Existing formulas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Eksisterende formler</CardTitle>
          <CardDescription>{formulas?.length || 0} sammensatte KPI'er</CardDescription>
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
                const tokens = parseFormulaToTokens(formula.formula);
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
                      {/* Visual formula display */}
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-center flex-wrap gap-1">
                          {renderFormulaPreview(tokens)}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {KPI_TYPES.find((t) => t.key === formula.kpi_type)?.label ||
                            formula.kpi_type}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingFormula ? "Rediger formel" : "Opret ny formel"}</DialogTitle>
            <DialogDescription>
              Byg en avanceret KPI ved at kombinere metriker, KPI'er og operatorer
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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

            {/* Formula builder area */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Formel</Label>
                {formData.tokens.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearTokens} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Ryd
                  </Button>
                )}
              </div>

              {/* Formula preview/display */}
              <div className="min-h-[60px] p-4 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/20">
                <div className="flex items-center flex-wrap gap-1">
                  {formData.tokens.map((token, index) => (
                    <div key={token.id} className="relative group/token">
                      {token.type === "metric" && (
                        <span className="inline-flex items-center px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-sm">
                          {token.label}
                          <button
                            onClick={() => removeToken(token.id)}
                            className="ml-1 opacity-0 group-hover/token:opacity-100 hover:text-red-500 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {token.type === "kpi" && (
                        <span className="inline-flex items-center px-2 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded text-sm">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {token.label}
                          <button
                            onClick={() => removeToken(token.id)}
                            className="ml-1 opacity-0 group-hover/token:opacity-100 hover:text-red-500 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {token.type === "operator" && (
                        <span className="inline-flex items-center px-2 py-1 text-lg font-bold">
                          {token.label}
                          <button
                            onClick={() => removeToken(token.id)}
                            className="ml-1 opacity-0 group-hover/token:opacity-100 hover:text-red-500 transition-opacity text-sm"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {token.type === "number" && (
                        <span className="inline-flex items-center px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-sm">
                          {token.label}
                          <button
                            onClick={() => removeToken(token.id)}
                            className="ml-1 opacity-0 group-hover/token:opacity-100 hover:text-red-500 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {token.type === "parenthesis" && (
                        <span className="inline-flex items-center px-1 py-1 text-lg font-bold">
                          {token.value}
                          <button
                            onClick={() => removeToken(token.id)}
                            className="opacity-0 group-hover/token:opacity-100 hover:text-red-500 transition-opacity text-sm"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                  {formData.tokens.length === 0 && (
                    <span className="text-muted-foreground text-sm italic">
                      Klik på elementer nedenfor for at bygge din formel...
                    </span>
                  )}
                </div>
              </div>

              {/* Token buttons */}
              <div className="space-y-3">
                {/* Operators and parentheses */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">Operatorer:</span>
                  <div className="flex gap-1">
                    {OPERATORS.map((op) => (
                      <Button
                        key={op.key}
                        variant="outline"
                        size="sm"
                        className="w-10 h-8 text-lg font-bold"
                        onClick={() =>
                          addToken({ type: "operator", value: op.key, label: op.label })
                        }
                      >
                        {op.label}
                      </Button>
                    ))}
                    <Separator orientation="vertical" className="h-8 mx-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-8 h-8 text-lg font-bold"
                      onClick={() =>
                        addToken({ type: "parenthesis", value: "(", label: "(" })
                      }
                    >
                      (
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-8 h-8 text-lg font-bold"
                      onClick={() =>
                        addToken({ type: "parenthesis", value: ")", label: ")" })
                      }
                    >
                      )
                    </Button>
                  </div>
                </div>

                {/* Number input */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">Tal:</span>
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number"
                      placeholder="100"
                      className="w-24 h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value = (e.target as HTMLInputElement).value;
                          if (value) {
                            addToken({ type: "number", value, label: value });
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Tryk Enter for at tilføje</span>
                  </div>
                </div>

                {/* Tabs for KPI Definitions and Base Metrics */}
                <Tabs defaultValue="kpis" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="kpis" className="text-xs">
                      <BookOpen className="h-3 w-3 mr-1.5" />
                      KPI Definitioner ({kpiDefinitions?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="metrics" className="text-xs">
                      <BarChart3 className="h-3 w-3 mr-1.5" />
                      Basis-metriker ({BASE_METRICS.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="kpis" className="mt-0">
                    {kpiDefinitions && kpiDefinitions.length > 0 ? (
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-4 pr-3">
                          {Object.entries(kpisByCategory || {}).map(([category, kpis]) => (
                            <div key={category} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase text-muted-foreground">
                                  {categoryLabels[category] || category}
                                </span>
                                <Badge variant="outline" className="text-xs h-5">
                                  {kpis.length}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {kpis.map((kpi) => (
                                  <Button
                                    key={kpi.id}
                                    variant="outline"
                                    size="sm"
                                    className="h-auto py-1.5 px-2.5 flex-col items-start text-left bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/20"
                                    onClick={() =>
                                      addToken({ type: "kpi", value: kpi.slug, label: kpi.name })
                                    }
                                  >
                                    <span className="font-medium text-xs">{kpi.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {kpi.slug}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        Ingen KPI-definitioner fundet. Opret dem i Definitioner-fanen.
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="metrics" className="mt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {BASE_METRICS.map((metric) => (
                        <Button
                          key={metric.key}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20"
                          onClick={() =>
                            addToken({ type: "metric", value: metric.key, label: metric.label })
                          }
                        >
                          {metric.label}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
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

      {/* Delete confirmation */}
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
