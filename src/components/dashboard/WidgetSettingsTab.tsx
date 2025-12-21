import { useState } from "react";
import { Plus, Pencil, Trash2, GripVertical, LayoutGrid, BarChart3, PieChart, LineChart, Table2, Clock, Users, TrendingUp, Award, Gauge, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DASHBOARD_LIST } from "@/config/dashboards";

interface Widget {
  id: string;
  name: string;
  description: string;
  type: "kpi_card" | "bar_chart" | "line_chart" | "pie_chart" | "table" | "leaderboard" | "clock" | "goal_progress" | "activity_feed";
  size: "small" | "medium" | "large" | "full";
  dataSource: string | null;
  config: Record<string, unknown>;
  dashboardSlugs: string[];
  displayOrder: number;
  isActive: boolean;
}

const WIDGET_TYPES = [
  { value: "kpi_card", label: "KPI Kort", icon: Gauge, description: "Vis en enkelt KPI værdi" },
  { value: "bar_chart", label: "Søjlediagram", icon: BarChart3, description: "Sammenlign værdier" },
  { value: "line_chart", label: "Linjediagram", icon: LineChart, description: "Vis trends over tid" },
  { value: "pie_chart", label: "Cirkeldiagram", icon: PieChart, description: "Vis fordeling" },
  { value: "table", label: "Tabel", icon: Table2, description: "Vis detaljerede data" },
  { value: "leaderboard", label: "Leaderboard", icon: Award, description: "Top performere" },
  { value: "clock", label: "Ur/Dato", icon: Clock, description: "Vis tid og dato" },
  { value: "goal_progress", label: "Mål fremgang", icon: TrendingUp, description: "Vis fremgang mod mål" },
  { value: "activity_feed", label: "Aktivitetsfeed", icon: Activity, description: "Seneste aktivitet" },
];

const WIDGET_SIZES = [
  { value: "small", label: "Lille", description: "1x1 celle" },
  { value: "medium", label: "Medium", description: "2x1 celler" },
  { value: "large", label: "Stor", description: "2x2 celler" },
  { value: "full", label: "Fuld bredde", description: "4x1 celler" },
];

const PRESET_WIDGETS: Widget[] = [
  {
    id: "preset-sales-today",
    name: "Salg i dag",
    description: "Viser dagens salgstal",
    type: "kpi_card",
    size: "small",
    dataSource: "antal_salg",
    config: { showTrend: true, accentColor: "#10b981" },
    dashboardSlugs: [],
    displayOrder: 0,
    isActive: true,
  },
  {
    id: "preset-leaderboard",
    name: "Top sælgere",
    description: "Leaderboard for dagens top performere",
    type: "leaderboard",
    size: "medium",
    dataSource: "antal_salg",
    config: { limit: 5, showAvatar: true },
    dashboardSlugs: [],
    displayOrder: 1,
    isActive: true,
  },
  {
    id: "preset-weekly-chart",
    name: "Ugentlig udvikling",
    description: "Linjediagram med ugens salg",
    type: "line_chart",
    size: "large",
    dataSource: "antal_salg",
    config: { period: "week", showGoal: true },
    dashboardSlugs: [],
    displayOrder: 2,
    isActive: true,
  },
  {
    id: "preset-team-distribution",
    name: "Team fordeling",
    description: "Cirkeldiagram over salg pr. team",
    type: "pie_chart",
    size: "medium",
    dataSource: "antal_salg",
    config: { groupBy: "team" },
    dashboardSlugs: [],
    displayOrder: 3,
    isActive: true,
  },
];

export const WidgetSettingsTab = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [savedWidgets, setSavedWidgets] = useState<Widget[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "kpi_card" as Widget["type"],
    size: "small" as Widget["size"],
    dataSource: "",
    dashboardSlugs: [] as string[],
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "kpi_card",
      size: "small",
      dataSource: "",
      dashboardSlugs: [],
      isActive: true,
    });
    setEditingWidget(null);
  };

  const openCreateDialog = (preset?: Widget) => {
    if (preset) {
      setFormData({
        name: `${preset.name} (kopi)`,
        description: preset.description,
        type: preset.type,
        size: preset.size,
        dataSource: preset.dataSource || "",
        dashboardSlugs: [],
        isActive: true,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const openEditDialog = (widget: Widget) => {
    setEditingWidget(widget);
    setFormData({
      name: widget.name,
      description: widget.description,
      type: widget.type,
      size: widget.size,
      dataSource: widget.dataSource || "",
      dashboardSlugs: widget.dashboardSlugs,
      isActive: widget.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const newWidget: Widget = {
      id: editingWidget?.id || `widget-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      type: formData.type,
      size: formData.size,
      dataSource: formData.dataSource || null,
      config: {},
      dashboardSlugs: formData.dashboardSlugs,
      displayOrder: editingWidget?.displayOrder || savedWidgets.length,
      isActive: formData.isActive,
    };

    if (editingWidget) {
      setSavedWidgets(prev => prev.map(w => w.id === editingWidget.id ? newWidget : w));
    } else {
      setSavedWidgets(prev => [...prev, newWidget]);
    }

    setIsDialogOpen(false);
    resetForm();
    toast({
      title: editingWidget ? "Widget opdateret" : "Widget oprettet",
      description: `"${newWidget.name}" er blevet ${editingWidget ? "opdateret" : "gemt"}.`,
    });
  };

  const deleteWidget = (id: string) => {
    setSavedWidgets(prev => prev.filter(w => w.id !== id));
    toast({
      title: "Widget slettet",
      description: "Widgetten er blevet fjernet.",
    });
  };

  const toggleDashboard = (slug: string) => {
    setFormData(prev => ({
      ...prev,
      dashboardSlugs: prev.dashboardSlugs.includes(slug)
        ? prev.dashboardSlugs.filter(s => s !== slug)
        : [...prev.dashboardSlugs, slug],
    }));
  };

  const getWidgetIcon = (type: Widget["type"]) => {
    const widgetType = WIDGET_TYPES.find(w => w.value === type);
    return widgetType?.icon || LayoutGrid;
  };

  return (
    <div className="space-y-6">
      {/* Mine widgets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              Mine widgets
            </CardTitle>
            <CardDescription>
              Dine gemte dashboard-widgets
            </CardDescription>
          </div>
          <Button onClick={() => openCreateDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Ny widget
          </Button>
        </CardHeader>
        <CardContent>
          {savedWidgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Ingen widgets oprettet endnu.</p>
              <p className="text-sm">Vælg et preset nedenfor eller opret din egen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedWidgets.map((widget) => {
                const IconComponent = getWidgetIcon(widget.type);
                return (
                  <div
                    key={widget.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                      <div className="p-2 rounded-lg bg-primary/10">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{widget.name}</span>
                          {!widget.isActive && (
                            <Badge variant="secondary">Inaktiv</Badge>
                          )}
                        </div>
                        {widget.description && (
                          <p className="text-sm text-muted-foreground">
                            {widget.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline">
                            {WIDGET_TYPES.find(t => t.value === widget.type)?.label}
                          </Badge>
                          <Badge variant="secondary">
                            {WIDGET_SIZES.find(s => s.value === widget.size)?.label}
                          </Badge>
                          {widget.dashboardSlugs.length > 0 && (
                            <Badge variant="outline">
                              {widget.dashboardSlugs.length} dashboard{widget.dashboardSlugs.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(widget)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteWidget(widget.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preset widgets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Preset widgets
          </CardTitle>
          <CardDescription>
            Hurtigstart med en færdig widget - klik for at tilpasse og gemme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRESET_WIDGETS.map((preset) => {
              const IconComponent = getWidgetIcon(preset.type);
              return (
                <div
                  key={preset.id}
                  className="group relative overflow-hidden border rounded-xl cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] p-4"
                  onClick={() => openCreateDialog(preset)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{preset.name}</p>
                      <p className="text-sm text-muted-foreground">{preset.description}</p>
                      <div className="flex gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {WIDGET_TYPES.find(t => t.value === preset.type)?.label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {WIDGET_SIZES.find(s => s.value === preset.size)?.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="secondary" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Brug widget
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Widget typer oversigt */}
      <Card>
        <CardHeader>
          <CardTitle>Widget typer</CardTitle>
          <CardDescription>
            Oversigt over tilgængelige widget typer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {WIDGET_TYPES.map((type) => {
              const IconComponent = type.icon;
              return (
                <div
                  key={type.value}
                  className="p-3 border rounded-lg text-center hover:bg-accent/50 transition-colors"
                >
                  <IconComponent className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingWidget ? "Rediger widget" : "Opret ny widget"}
            </DialogTitle>
            <DialogDescription>
              {editingWidget
                ? "Opdater indstillingerne for denne widget"
                : "Konfigurer din nye widget"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Navn</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Min widget"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Beskrivelse</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Kort beskrivelse af widgetten"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as Widget["type"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDGET_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Størrelse</Label>
                <Select
                  value={formData.size}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, size: value as Widget["size"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDGET_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label} - {size.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Vis på dashboards</Label>
              <div className="flex flex-wrap gap-2">
                {DASHBOARD_LIST.map((dashboard) => (
                  <Badge
                    key={dashboard.slug}
                    variant={formData.dashboardSlugs.includes(dashboard.slug) ? "default" : "outline"}
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
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Aktiv</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={handleSave} disabled={!formData.name}>
              {editingWidget ? "Opdater" : "Opret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
