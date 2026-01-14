import { useState, useMemo } from "react";
import { useKpiDefinitions, KpiDefinition, useUpdateKpiDefinitionStatus } from "@/hooks/useKpiDefinitions";
import { useKpiFormulas, KpiFormula, useUpdateKpiFormulaStatus } from "@/hooks/useKpiFormulas";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, BookOpen, Calculator, Loader2, LayoutGrid, Check, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

// Unified KPI item type
interface UnifiedKpi {
  id: string;
  originalId: string;
  name: string;
  type: "definition" | "formula";
  category: string | null;
  description: string | null;
  is_active: boolean;
  source: KpiDefinition | KpiFormula;
}

export function KpiOverview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "definition" | "formula">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: definitions, isLoading: loadingDefs } = useKpiDefinitions();
  const { data: formulas, isLoading: loadingFormulas } = useKpiFormulas();
  
  const updateDefinitionStatus = useUpdateKpiDefinitionStatus();
  const updateFormulaStatus = useUpdateKpiFormulaStatus();

  const isLoading = loadingDefs || loadingFormulas;

  // Combine both sources into unified list
  const unifiedKpis = useMemo<UnifiedKpi[]>(() => {
    const items: UnifiedKpi[] = [];

    // Add definitions
    (definitions || []).forEach((def) => {
      items.push({
        id: `def-${def.id}`,
        originalId: def.id,
        name: def.name,
        type: "definition",
        category: def.category,
        description: def.description,
        is_active: def.is_active ?? true,
        source: def,
      });
    });

    // Add formulas
    (formulas || []).forEach((formula) => {
      items.push({
        id: `formula-${formula.id}`,
        originalId: formula.id,
        name: formula.name,
        type: "formula",
        category: formula.kpi_type,
        description: formula.description,
        is_active: (formula as any).is_active ?? true,
        source: formula,
      });
    });

    return items;
  }, [definitions, formulas]);

  // Handle toggle status
  const handleToggleStatus = async (kpi: UnifiedKpi, checked: boolean) => {
    setUpdatingId(kpi.id);
    try {
      if (kpi.type === "definition") {
        await updateDefinitionStatus.mutateAsync({ id: kpi.originalId, is_active: checked });
      } else {
        await updateFormulaStatus.mutateAsync({ id: kpi.originalId, is_active: checked });
      }
      toast.success(checked ? "KPI tilføjet til dashboard-liste" : "KPI fjernet fra dashboard-liste");
    } catch (error) {
      toast.error("Kunne ikke opdatere status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter logic
  const filteredKpis = useMemo(() => {
    return unifiedKpis.filter((kpi) => {
      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        if (
          !kpi.name.toLowerCase().includes(search) &&
          !kpi.description?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== "all" && kpi.type !== typeFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== "all" && kpi.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "active" && !kpi.is_active) return false;
      if (statusFilter === "inactive" && kpi.is_active) return false;

      return true;
    });
  }, [unifiedKpis, searchQuery, typeFilter, categoryFilter, statusFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    unifiedKpis.forEach((kpi) => {
      if (kpi.category) cats.add(kpi.category);
    });
    return Array.from(cats).sort();
  }, [unifiedKpis]);

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case "sales":
        return "Salg";
      case "hours":
        return "Timer";
      case "calls":
        return "Opkald";
      case "employees":
        return "Medarbejdere";
      case "number":
        return "Tal";
      case "percentage":
        return "Procent";
      case "currency":
        return "Valuta";
      case "decimal":
        return "Decimal";
      default:
        return category || "-";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{unifiedKpis.length}</div>
                <div className="text-xs text-muted-foreground">Total KPI'er</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">
                  {unifiedKpis.filter((k) => k.type === "definition").length}
                </div>
                <div className="text-xs text-muted-foreground">Definitioner</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calculator className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">
                  {unifiedKpis.filter((k) => k.type === "formula").length}
                </div>
                <div className="text-xs text-muted-foreground">Formler</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Check className="h-8 w-8 text-emerald-500" />
              <div>
                <div className="text-2xl font-bold">
                  {unifiedKpis.filter((k) => k.is_active).length}
                </div>
                <div className="text-xs text-muted-foreground">Valgt til dashboard</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg i KPI'er..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            <SelectItem value="definition">Definitioner</SelectItem>
            <SelectItem value="formula">Formler</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kategorier</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {getCategoryLabel(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="active">Valgte</SelectItem>
            <SelectItem value="inactive">Ikke valgte</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredKpis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Ingen KPI'er matcher dine filtre
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredKpis.map((kpi) => (
                <div
                  key={kpi.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  {/* Status indicator */}
                  <div className="flex-shrink-0">
                    {kpi.is_active ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Name and description */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{kpi.name}</div>
                    {kpi.description && (
                      <div className="text-sm text-muted-foreground truncate">
                        {kpi.description}
                      </div>
                    )}
                  </div>

                  {/* Type badge */}
                  <Badge 
                    variant={kpi.type === "definition" ? "default" : "secondary"}
                    className="flex-shrink-0"
                  >
                    {kpi.type === "definition" ? "Def." : "Formel"}
                  </Badge>

                  {/* Category */}
                  <div className="w-24 text-sm text-muted-foreground flex-shrink-0">
                    {getCategoryLabel(kpi.category)}
                  </div>

                  {/* Active switch */}
                  <Switch
                    checked={kpi.is_active}
                    onCheckedChange={(checked) => handleToggleStatus(kpi, checked)}
                    disabled={updatingId === kpi.id}
                    className="flex-shrink-0"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info text */}
      <p className="text-sm text-muted-foreground text-center">
        Marker hvilke KPI'er og formler der skal være tilgængelige når du designer dashboards og statistik.
      </p>
    </div>
  );
}
