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

const INITIAL_WIDGET_TYPES = [
  { value: "kpi_card", label: "KPI Kort", icon: Gauge, description: "Vis en enkelt KPI værdi", isActive: true },
  { value: "bar_chart", label: "Søjlediagram", icon: BarChart3, description: "Sammenlign værdier", isActive: true },
  { value: "line_chart", label: "Linjediagram", icon: LineChart, description: "Vis trends over tid", isActive: true },
  { value: "pie_chart", label: "Cirkeldiagram", icon: PieChart, description: "Vis fordeling", isActive: true },
  { value: "table", label: "Tabel", icon: Table2, description: "Vis detaljerede data", isActive: true },
  { value: "leaderboard", label: "Leaderboard", icon: Award, description: "Top performere", isActive: true },
  { value: "clock", label: "Ur/Dato", icon: Clock, description: "Vis tid og dato", isActive: true },
  { value: "goal_progress", label: "Mål fremgang", icon: TrendingUp, description: "Vis fremgang mod mål", isActive: true },
  { value: "activity_feed", label: "Aktivitetsfeed", icon: Activity, description: "Seneste aktivitet", isActive: true },
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
  const [widgetTypes, setWidgetTypes] = useState(INITIAL_WIDGET_TYPES);

  const toggleWidgetType = (value: string) => {
    setWidgetTypes(prev => prev.map(type => 
      type.value === value ? { ...type, isActive: !type.isActive } : type
    ));
    const type = widgetTypes.find(t => t.value === value);
    toast({
      title: type?.isActive ? "Widget type deaktiveret" : "Widget type aktiveret",
      description: `${type?.label} er nu ${type?.isActive ? "deaktiveret" : "aktiveret"}.`,
    });
  };
  
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
    const widgetType = widgetTypes.find(w => w.value === type);
    return widgetType?.icon || LayoutGrid;
  };

  return (
    <div className="space-y-6">
      {/* Widget typer oversigt */}
      <Card>
        <CardHeader>
          <CardTitle>Widget typer</CardTitle>
          <CardDescription>
            Klik på en widget type for at aktivere/deaktivere den
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {widgetTypes.map((type) => {
              const IconComponent = type.icon;
              return (
                <div
                  key={type.value}
                  onClick={() => toggleWidgetType(type.value)}
                  className={`p-3 border rounded-lg text-center cursor-pointer transition-all ${
                    type.isActive 
                      ? "bg-primary/10 border-primary hover:bg-primary/20" 
                      : "bg-muted/50 border-muted opacity-60 hover:opacity-80"
                  }`}
                >
                  <IconComponent className={`h-8 w-8 mx-auto mb-2 ${type.isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <p className={`font-medium text-sm ${type.isActive ? "" : "text-muted-foreground"}`}>{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                  <Badge 
                    variant={type.isActive ? "default" : "secondary"} 
                    className="mt-2 text-xs"
                  >
                    {type.isActive ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
