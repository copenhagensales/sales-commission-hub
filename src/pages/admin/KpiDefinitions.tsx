import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useKpiDefinitions, useKpiDefinition, KpiCategory } from "@/hooks/useKpiDefinitions";
import { KpiDefinitionList } from "@/components/kpi/KpiDefinitionList";
import { KpiDefinitionDetail } from "@/components/kpi/KpiDefinitionDetail";
import { KpiDefinitionForm } from "@/components/kpi/KpiDefinitionForm";
import { KpiFormulaBuilder } from "@/components/kpi/KpiFormulaBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, BookOpen, TrendingUp, Clock, Phone, Users, Calculator, Loader2 } from "lucide-react";

export default function KpiDefinitions() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<KpiCategory | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState("definitions");

  const { data: definitions, isLoading } = useKpiDefinitions(
    categoryFilter === "all" ? undefined : categoryFilter
  );
  const { data: selectedDefinition } = useKpiDefinition(selectedId);

  // Filter by search
  const filteredDefinitions = definitions?.filter((def) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      def.name.toLowerCase().includes(search) ||
      def.slug.toLowerCase().includes(search) ||
      def.description?.toLowerCase().includes(search)
    );
  });

  return (
    <MainLayout>
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">KPI Definitioner</h1>
              <p className="text-sm text-muted-foreground">
                Central dokumentation af nøgletal og beregningslogik
              </p>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="definitions" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Definitioner
            </TabsTrigger>
            <TabsTrigger value="formulas" className="gap-2">
              <Calculator className="h-4 w-4" />
              Formelbygger
            </TabsTrigger>
          </TabsList>

          {/* Definitions Tab */}
          <TabsContent value="definitions" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-emerald-500" />
                    <div>
                      <div className="text-2xl font-bold">
                        {definitions?.filter((d) => d.category === "sales").length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Salgs-KPI'er</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-blue-500" />
                    <div>
                      <div className="text-2xl font-bold">
                        {definitions?.filter((d) => d.category === "hours").length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Timer-KPI'er</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-8 w-8 text-purple-500" />
                    <div>
                      <div className="text-2xl font-bold">
                        {definitions?.filter((d) => d.category === "calls").length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Opkalds-KPI'er</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-amber-500" />
                    <div>
                      <div className="text-2xl font-bold">
                        {definitions?.filter((d) => d.category === "employees").length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Medarbejder-KPI'er</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main content */}
            <div className="grid grid-cols-12 gap-6">
              {/* Left sidebar - KPI list */}
              <div className="col-span-4 space-y-4">
                {/* Search and filter */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Søg i KPI'er..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button onClick={() => setShowCreateForm(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Tabs
                    value={categoryFilter}
                    onValueChange={(v) => setCategoryFilter(v as KpiCategory | "all")}
                  >
                    <TabsList className="grid grid-cols-5 w-full">
                      <TabsTrigger value="all">Alle</TabsTrigger>
                      <TabsTrigger value="sales">Salg</TabsTrigger>
                      <TabsTrigger value="hours">Timer</TabsTrigger>
                      <TabsTrigger value="calls">Opkald</TabsTrigger>
                      <TabsTrigger value="employees">Folk</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* List */}
                <Card>
                  <CardContent className="p-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredDefinitions?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "Ingen KPI'er matcher søgningen" : "Ingen KPI'er fundet"}
                      </div>
                    ) : (
                      <KpiDefinitionList
                        definitions={filteredDefinitions || []}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right panel - Details */}
              <div className="col-span-8">
                <Card>
                  <CardContent className="p-6">
                    {selectedDefinition ? (
                      <KpiDefinitionDetail
                        definition={selectedDefinition}
                        onClose={() => setSelectedId(null)}
                      />
                    ) : (
                      <div className="text-center py-16">
                        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="font-medium text-lg mb-2">Vælg en KPI</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                          Vælg en KPI fra listen til venstre for at se detaljer, beregningslogik og køre live tests mod databasen.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Formulas Tab */}
          <TabsContent value="formulas">
            <KpiFormulaBuilder />
          </TabsContent>
        </Tabs>

        {/* Create form dialog */}
        <KpiDefinitionForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
        />
      </div>
    </MainLayout>
  );
}
