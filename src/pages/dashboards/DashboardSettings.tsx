import { useState } from "react";
import { BarChart3, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DASHBOARD_LIST } from "@/config/dashboards";

interface DashboardKpi {
  id: string;
  name: string;
  description: string | null;
  kpi_type: string;
  target_value: number | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  unit: string | null;
  dashboard_slugs: string[];
  display_order: number;
  is_active: boolean;
}

const KPI_TYPES = [
  { value: "number", label: "Antal" },
  { value: "percentage", label: "Procent" },
  { value: "currency", label: "Beløb (DKK)" },
];

const DashboardSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<DashboardKpi | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    kpi_type: "number",
    target_value: "",
    warning_threshold: "",
    critical_threshold: "",
    unit: "",
    dashboard_slugs: [] as string[],
    is_active: true,
  });

  // Fetch KPIs
  const { data: kpis = [], isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_kpis")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as DashboardKpi[];
    },
  });

  // Create/Update KPI
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        kpi_type: data.kpi_type,
        target_value: data.target_value ? parseFloat(data.target_value) : null,
        warning_threshold: data.warning_threshold ? parseFloat(data.warning_threshold) : null,
        critical_threshold: data.critical_threshold ? parseFloat(data.critical_threshold) : null,
        unit: data.unit || null,
        dashboard_slugs: data.dashboard_slugs,
        is_active: data.is_active,
      };

      if (data.id) {
        const { error } = await supabase
          .from("dashboard_kpis")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dashboard_kpis")
          .insert({ ...payload, display_order: kpis.length });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingKpi ? "KPI opdateret" : "KPI oprettet",
        description: `KPI'en er blevet ${editingKpi ? "opdateret" : "oprettet"} succesfuldt.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl. Prøv igen.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  // Delete KPI
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dashboard_kpis")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast({
        title: "KPI slettet",
        description: "KPI'en er blevet slettet.",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      kpi_type: "number",
      target_value: "",
      warning_threshold: "",
      critical_threshold: "",
      unit: "",
      dashboard_slugs: [],
      is_active: true,
    });
    setEditingKpi(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (kpi: DashboardKpi) => {
    setEditingKpi(kpi);
    setFormData({
      name: kpi.name,
      description: kpi.description || "",
      kpi_type: kpi.kpi_type,
      target_value: kpi.target_value?.toString() || "",
      warning_threshold: kpi.warning_threshold?.toString() || "",
      critical_threshold: kpi.critical_threshold?.toString() || "",
      unit: kpi.unit || "",
      dashboard_slugs: kpi.dashboard_slugs || [],
      is_active: kpi.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editingKpi?.id });
  };

  const toggleDashboard = (slug: string) => {
    setFormData((prev) => ({
      ...prev,
      dashboard_slugs: prev.dashboard_slugs.includes(slug)
        ? prev.dashboard_slugs.filter((s) => s !== slug)
        : [...prev.dashboard_slugs, slug],
    }));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indstilling dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Administrer indstillinger for dashboards
          </p>
        </div>

        <Tabs defaultValue="kpis" className="w-full">
          <TabsList>
            <TabsTrigger value="kpis" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              KPI'er
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kpis" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    KPI Indstillinger
                  </CardTitle>
                  <CardDescription>
                    Opret og administrer KPI'er der vises på dine dashboards
                  </CardDescription>
                </div>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ny KPI
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-muted-foreground py-8 text-center">
                    Indlæser KPI'er...
                  </div>
                ) : kpis.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    Ingen KPI'er oprettet endnu. Klik på "Ny KPI" for at oprette din første.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kpis.map((kpi) => (
                      <div
                        key={kpi.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{kpi.name}</span>
                              {!kpi.is_active && (
                                <Badge variant="secondary">Inaktiv</Badge>
                              )}
                            </div>
                            {kpi.description && (
                              <p className="text-sm text-muted-foreground">
                                {kpi.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">
                                {KPI_TYPES.find((t) => t.value === kpi.kpi_type)?.label}
                              </Badge>
                              {kpi.target_value && (
                                <Badge variant="outline">
                                  Mål: {kpi.target_value}
                                  {kpi.unit}
                                </Badge>
                              )}
                              {kpi.dashboard_slugs?.length > 0 && (
                                <Badge variant="outline">
                                  {kpi.dashboard_slugs.length} dashboard
                                  {kpi.dashboard_slugs.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(kpi)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(kpi.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingKpi ? "Rediger KPI" : "Opret ny KPI"}
              </DialogTitle>
              <DialogDescription>
                Udfyld nedenstående felter for at {editingKpi ? "opdatere" : "oprette"} en KPI.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Navn *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="F.eks. Salg i dag"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Beskrivelse</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Kort beskrivelse af KPI'en"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="kpi_type">Type</Label>
                    <Select
                      value={formData.kpi_type}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, kpi_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KPI_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="unit">Enhed</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, unit: e.target.value }))
                      }
                      placeholder="F.eks. stk, kr, %"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="target_value">Målværdi</Label>
                    <Input
                      id="target_value"
                      type="number"
                      value={formData.target_value}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, target_value: e.target.value }))
                      }
                      placeholder="100"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="warning_threshold">Advarsel under</Label>
                    <Input
                      id="warning_threshold"
                      type="number"
                      value={formData.warning_threshold}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, warning_threshold: e.target.value }))
                      }
                      placeholder="80"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="critical_threshold">Kritisk under</Label>
                    <Input
                      id="critical_threshold"
                      type="number"
                      value={formData.critical_threshold}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, critical_threshold: e.target.value }))
                      }
                      placeholder="50"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Vis på dashboards</Label>
                  <div className="flex flex-wrap gap-2">
                    {DASHBOARD_LIST.map((dashboard) => (
                      <Badge
                        key={dashboard.slug}
                        variant={
                          formData.dashboard_slugs.includes(dashboard.slug)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleDashboard(dashboard.slug)}
                      >
                        {dashboard.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                  <Label htmlFor="is_active">Aktiv</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Annuller
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? "Gemmer..."
                    : editingKpi
                    ? "Opdater"
                    : "Opret"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default DashboardSettings;
