import { useState, useMemo } from "react";
import { useKpiDefinitions, useUpdateKpiDefinition, KpiDefinition } from "@/hooks/useKpiDefinitions";
import { useKpiFormulas, KpiFormula } from "@/hooks/useKpiFormulas";
import { DASHBOARD_LIST } from "@/config/dashboards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, ChevronDown, BookOpen, Calculator, Loader2, LayoutGrid, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Unified KPI item type
interface UnifiedKpi {
  id: string;
  name: string;
  type: "definition" | "formula";
  category: string | null;
  description: string | null;
  is_active: boolean;
  dashboard_slugs: string[];
  source: KpiDefinition | KpiFormula;
}

export function KpiOverview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "definition" | "formula">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dashboardFilter, setDashboardFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { data: definitions, isLoading: loadingDefs } = useKpiDefinitions();
  const { data: formulas, isLoading: loadingFormulas } = useKpiFormulas();
  const updateDefinition = useUpdateKpiDefinition();

  const isLoading = loadingDefs || loadingFormulas;

  // Combine both sources into unified list
  const unifiedKpis = useMemo<UnifiedKpi[]>(() => {
    const items: UnifiedKpi[] = [];

    // Add definitions
    (definitions || []).forEach((def) => {
      items.push({
        id: `def-${def.id}`,
        name: def.name,
        type: "definition",
        category: def.category,
        description: def.description,
        is_active: (def as any).is_active ?? true,
        dashboard_slugs: (def as any).dashboard_slugs ?? [],
        source: def,
      });
    });

    // Add formulas
    (formulas || []).forEach((formula) => {
      items.push({
        id: `formula-${formula.id}`,
        name: formula.name,
        type: "formula",
        category: formula.kpi_type,
        description: formula.description,
        is_active: true, // Formulas from dashboard_kpis - already have is_active if needed
        dashboard_slugs: [], // Will be fetched separately if needed
        source: formula,
      });
    });

    return items;
  }, [definitions, formulas]);

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

      // Dashboard filter
      if (dashboardFilter !== "all" && !kpi.dashboard_slugs.includes(dashboardFilter)) {
        return false;
      }

      // Status filter
      if (statusFilter === "active" && !kpi.is_active) return false;
      if (statusFilter === "inactive" && kpi.is_active) return false;

      return true;
    });
  }, [unifiedKpis, searchQuery, typeFilter, categoryFilter, dashboardFilter, statusFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    unifiedKpis.forEach((kpi) => {
      if (kpi.category) cats.add(kpi.category);
    });
    return Array.from(cats).sort();
  }, [unifiedKpis]);

  // Handle toggle selection
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredKpis.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredKpis.map((k) => k.id)));
    }
  };

  // Handle status toggle
  const handleStatusToggle = async (kpi: UnifiedKpi, newStatus: boolean) => {
    if (kpi.type === "definition") {
      const def = kpi.source as KpiDefinition;
      updateDefinition.mutate({
        id: def.id,
        data: { is_active: newStatus } as any,
      });
    } else {
      // For formulas, update dashboard_kpis table directly
      const formula = kpi.source as KpiFormula;
      const { error } = await supabase
        .from("dashboard_kpis")
        .update({ is_active: newStatus })
        .eq("id", formula.id);
      
      if (error) {
        toast.error("Kunne ikke opdatere status");
      } else {
        toast.success("Status opdateret");
        queryClient.invalidateQueries({ queryKey: ["kpi-formulas"] });
      }
    }
  };

  // Handle dashboard assignment
  const handleDashboardToggle = async (kpi: UnifiedKpi, dashboardSlug: string, enabled: boolean) => {
    let newSlugs: string[];
    if (enabled) {
      newSlugs = [...kpi.dashboard_slugs, dashboardSlug];
    } else {
      newSlugs = kpi.dashboard_slugs.filter((s) => s !== dashboardSlug);
    }

    if (kpi.type === "definition") {
      const def = kpi.source as KpiDefinition;
      updateDefinition.mutate({
        id: def.id,
        data: { dashboard_slugs: newSlugs } as any,
      });
    } else {
      const formula = kpi.source as KpiFormula;
      const { error } = await supabase
        .from("dashboard_kpis")
        .update({ dashboard_slugs: newSlugs })
        .eq("id", formula.id);
      
      if (error) {
        toast.error("Kunne ikke opdatere dashboards");
      } else {
        toast.success("Dashboards opdateret");
        queryClient.invalidateQueries({ queryKey: ["kpi-formulas"] });
      }
    }
  };

  // Bulk actions
  const handleBulkAddDashboard = async (dashboardSlug: string) => {
    const selected = filteredKpis.filter((k) => selectedIds.has(k.id));
    for (const kpi of selected) {
      if (!kpi.dashboard_slugs.includes(dashboardSlug)) {
        await handleDashboardToggle(kpi, dashboardSlug, true);
      }
    }
    setSelectedIds(new Set());
  };

  const handleBulkRemoveDashboard = async (dashboardSlug: string) => {
    const selected = filteredKpis.filter((k) => selectedIds.has(k.id));
    for (const kpi of selected) {
      if (kpi.dashboard_slugs.includes(dashboardSlug)) {
        await handleDashboardToggle(kpi, dashboardSlug, false);
      }
    }
    setSelectedIds(new Set());
  };

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
                <div className="text-xs text-muted-foreground">Aktive</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filtre</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
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

            <Select value={dashboardFilter} onValueChange={setDashboardFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Dashboard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle dashboards</SelectItem>
                {DASHBOARD_LIST.map((dash) => (
                  <SelectItem key={dash.slug} value={dash.slug}>
                    {dash.name}
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
                <SelectItem value="active">Aktive</SelectItem>
                <SelectItem value="inactive">Inaktive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{selectedIds.size} valgt</span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Tilføj til dashboard <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {DASHBOARD_LIST.map((dash) => (
                    <DropdownMenuCheckboxItem
                      key={dash.slug}
                      onClick={() => handleBulkAddDashboard(dash.slug)}
                    >
                      {dash.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Fjern fra dashboard <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {DASHBOARD_LIST.map((dash) => (
                    <DropdownMenuCheckboxItem
                      key={dash.slug}
                      onClick={() => handleBulkRemoveDashboard(dash.slug)}
                    >
                      {dash.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Ryd valg
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.size === filteredKpis.length && filteredKpis.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Navn</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[120px]">Kategori</TableHead>
                  <TableHead>Dashboards</TableHead>
                  <TableHead className="w-[80px] text-center">Aktiv</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKpis.map((kpi) => (
                  <TableRow key={kpi.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(kpi.id)}
                        onCheckedChange={() => toggleSelect(kpi.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{kpi.name}</div>
                        {kpi.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {kpi.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={kpi.type === "definition" ? "default" : "secondary"}>
                        {kpi.type === "definition" ? "Def." : "Formel"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getCategoryLabel(kpi.category)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto py-1 px-2">
                            {kpi.dashboard_slugs.length === 0 ? (
                              <span className="text-muted-foreground text-xs">Ingen valgt</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {kpi.dashboard_slugs.slice(0, 3).map((slug) => {
                                  const dash = DASHBOARD_LIST.find((d) => d.slug === slug);
                                  return (
                                    <Badge key={slug} variant="outline" className="text-xs">
                                      {dash?.name.split(" ")[0] || slug}
                                    </Badge>
                                  );
                                })}
                                {kpi.dashboard_slugs.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{kpi.dashboard_slugs.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <ChevronDown className="ml-1 h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                          {DASHBOARD_LIST.map((dash) => (
                            <DropdownMenuCheckboxItem
                              key={dash.slug}
                              checked={kpi.dashboard_slugs.includes(dash.slug)}
                              onCheckedChange={(checked) =>
                                handleDashboardToggle(kpi, dash.slug, checked)
                              }
                            >
                              {dash.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={kpi.is_active}
                        onCheckedChange={(checked) => handleStatusToggle(kpi, checked)}
                      />
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
