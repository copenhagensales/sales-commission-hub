import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  Users, 
  Target, 
  Clock, 
  Trophy,
  Gauge,
  Calendar,
  List,
  Activity,
  Plus,
  Save,
  Eye,
  Trash2,
  GripVertical,
  Settings2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WidgetType {
  id: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

interface KpiType {
  id: string;
  name: string;
  description: string;
}

interface DesignOption {
  id: string;
  name: string;
  description: string;
  preview: string;
}

interface PlacedWidget {
  id: string;
  widgetTypeId: string;
  kpiTypeId: string;
  designId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const INITIAL_WIDGET_TYPES: WidgetType[] = [
  { id: "bar-chart", name: "Søjlediagram", description: "Vis data som søjler", icon: "bar-chart", isActive: true },
  { id: "line-chart", name: "Linjediagram", description: "Vis trends over tid", icon: "line-chart", isActive: true },
  { id: "pie-chart", name: "Cirkeldiagram", description: "Vis fordelinger", icon: "pie-chart", isActive: true },
  { id: "kpi-card", name: "KPI Kort", description: "Vis nøgletal", icon: "trending-up", isActive: true },
  { id: "leaderboard", name: "Leaderboard", description: "Top performere", icon: "trophy", isActive: true },
  { id: "gauge", name: "Måler", description: "Vis fremskridt mod mål", icon: "gauge", isActive: true },
  { id: "team-stats", name: "Team Statistik", description: "Team performance", icon: "users", isActive: true },
  { id: "target-progress", name: "Mål Fremskridt", description: "Vis målstatus", icon: "target", isActive: true },
  { id: "time-tracker", name: "Tidstracker", description: "Vis tidsforbrug", icon: "clock", isActive: true },
  { id: "calendar-widget", name: "Kalender", description: "Vis kommende events", icon: "calendar", isActive: true },
  { id: "task-list", name: "Opgaveliste", description: "Vis opgaver", icon: "list", isActive: true },
  { id: "activity-feed", name: "Aktivitetsfeed", description: "Seneste aktiviteter", icon: "activity", isActive: true },
];

const KPI_TYPES: KpiType[] = [
  { id: "sales-today", name: "Salg i dag", description: "Antal salg i dag" },
  { id: "sales-week", name: "Salg denne uge", description: "Antal salg denne uge" },
  { id: "sales-month", name: "Salg denne måned", description: "Antal salg denne måned" },
  { id: "revenue-today", name: "Omsætning i dag", description: "Omsætning i dag" },
  { id: "revenue-month", name: "Omsætning måned", description: "Omsætning denne måned" },
  { id: "conversion-rate", name: "Konverteringsrate", description: "Konverteringsrate %" },
  { id: "calls-today", name: "Opkald i dag", description: "Antal opkald i dag" },
  { id: "calls-week", name: "Opkald denne uge", description: "Antal opkald denne uge" },
  { id: "avg-call-duration", name: "Gns. opkaldstid", description: "Gennemsnitlig opkaldstid" },
  { id: "team-target", name: "Team mål", description: "Fremskridt mod team mål" },
  { id: "individual-target", name: "Individuelt mål", description: "Fremskridt mod individuelt mål" },
  { id: "leads-generated", name: "Leads genereret", description: "Antal nye leads" },
  { id: "appointments-booked", name: "Aftaler booket", description: "Antal bookede aftaler" },
  { id: "customer-satisfaction", name: "Kundetilfredshed", description: "Kundetilfredshedsscore" },
];

const DESIGN_OPTIONS: DesignOption[] = [
  { id: "minimal", name: "Minimal", description: "Rent og simpelt design", preview: "bg-card border" },
  { id: "gradient", name: "Gradient", description: "Gradient baggrund", preview: "bg-gradient-to-br from-primary/20 to-primary/5" },
  { id: "dark", name: "Mørk", description: "Mørk baggrund", preview: "bg-zinc-900 text-white" },
  { id: "accent", name: "Accent", description: "Med accent farve", preview: "bg-primary/10 border-primary/30" },
  { id: "glass", name: "Glas", description: "Glasmorfisme effekt", preview: "bg-white/10 backdrop-blur-sm border-white/20" },
  { id: "outline", name: "Kontur", description: "Kun kontur", preview: "bg-transparent border-2" },
];

const getWidgetIcon = (iconName: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    "bar-chart": BarChart3,
    "line-chart": LineChart,
    "pie-chart": PieChart,
    "trending-up": TrendingUp,
    "trophy": Trophy,
    "gauge": Gauge,
    "users": Users,
    "target": Target,
    "clock": Clock,
    "calendar": Calendar,
    "list": List,
    "activity": Activity,
  };
  const IconComponent = icons[iconName] || BarChart3;
  return <IconComponent className="h-5 w-5" />;
};

export default function DesignDashboard() {
  const { toast } = useToast();
  const [widgetTypes] = useState<WidgetType[]>(INITIAL_WIDGET_TYPES);
  const [placedWidgets, setPlacedWidgets] = useState<PlacedWidget[]>([]);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<PlacedWidget | null>(null);
  
  // Config form state
  const [selectedWidgetType, setSelectedWidgetType] = useState<string>("");
  const [selectedKpiType, setSelectedKpiType] = useState<string>("");
  const [selectedDesign, setSelectedDesign] = useState<string>("minimal");

  const openAddWidgetDialog = () => {
    setEditingWidget(null);
    setSelectedWidgetType("");
    setSelectedKpiType("");
    setSelectedDesign("minimal");
    setIsConfigDialogOpen(true);
  };

  const openEditWidgetDialog = (widget: PlacedWidget) => {
    setEditingWidget(widget);
    setSelectedWidgetType(widget.widgetTypeId);
    setSelectedKpiType(widget.kpiTypeId);
    setSelectedDesign(widget.designId);
    setIsConfigDialogOpen(true);
  };

  const handleSaveWidget = () => {
    if (!selectedWidgetType || !selectedKpiType) {
      toast({
        title: "Manglende valg",
        description: "Vælg venligst widget type og KPI type",
        variant: "destructive",
      });
      return;
    }

    if (editingWidget) {
      setPlacedWidgets(prev => prev.map(w => 
        w.id === editingWidget.id 
          ? { ...w, widgetTypeId: selectedWidgetType, kpiTypeId: selectedKpiType, designId: selectedDesign }
          : w
      ));
      toast({
        title: "Widget opdateret",
        description: "Widget er blevet opdateret",
      });
    } else {
      const newWidget: PlacedWidget = {
        id: `widget-${Date.now()}`,
        widgetTypeId: selectedWidgetType,
        kpiTypeId: selectedKpiType,
        designId: selectedDesign,
        x: placedWidgets.length % 3,
        y: Math.floor(placedWidgets.length / 3),
        width: 1,
        height: 1,
      };
      setPlacedWidgets(prev => [...prev, newWidget]);
      toast({
        title: "Widget tilføjet",
        description: "Widget er tilføjet til dit dashboard",
      });
    }
    setIsConfigDialogOpen(false);
  };

  const removeWidget = (widgetId: string) => {
    setPlacedWidgets(prev => prev.filter(w => w.id !== widgetId));
    toast({
      title: "Widget fjernet",
      description: "Widget er fjernet fra dit dashboard",
    });
  };

  const getDesignClasses = (designId: string) => {
    const design = DESIGN_OPTIONS.find(d => d.id === designId);
    return design?.preview || "bg-card border";
  };

  const activeWidgetTypes = widgetTypes.filter(w => w.isActive);

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Design Dashboard</h1>
            <p className="text-muted-foreground">Design dit eget dashboard med widgets</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Forhåndsvis
            </Button>
            <Button>
              <Save className="h-4 w-4 mr-2" />
              Gem Dashboard
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Widget Palette */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Tilføj Widget</CardTitle>
                <CardDescription>Konfigurer og tilføj widgets</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={openAddWidgetDialog} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Tilføj ny widget
                </Button>
              </CardContent>
            </Card>

            {/* Quick add from active types */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Hurtig tilføj</CardTitle>
                <CardDescription>Klik for at konfigurere</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {activeWidgetTypes.slice(0, 6).map((widget) => (
                  <div
                    key={widget.id}
                    onClick={() => {
                      setSelectedWidgetType(widget.id);
                      setSelectedKpiType("");
                      setSelectedDesign("minimal");
                      setEditingWidget(null);
                      setIsConfigDialogOpen(true);
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      {getWidgetIcon(widget.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{widget.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{widget.description}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Dashboard Canvas */}
          <div className="lg:col-span-3">
            <Card className="min-h-[600px]">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">Dashboard Canvas</CardTitle>
                <CardDescription>Dine widgets vises her - klik på en widget for at redigere</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {placedWidgets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <Plus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Ingen widgets endnu</h3>
                    <p className="text-muted-foreground max-w-sm mb-4">
                      Klik på "Tilføj ny widget" for at komme i gang
                    </p>
                    <Button onClick={openAddWidgetDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Tilføj første widget
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {placedWidgets.map((widget) => {
                      const widgetType = widgetTypes.find(w => w.id === widget.widgetTypeId);
                      const kpiType = KPI_TYPES.find(k => k.id === widget.kpiTypeId);
                      const design = DESIGN_OPTIONS.find(d => d.id === widget.designId);
                      
                      return (
                        <Card 
                          key={widget.id} 
                          className={`relative group cursor-pointer transition-all hover:shadow-lg ${getDesignClasses(widget.designId)}`}
                          onClick={() => openEditWidgetDialog(widget)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                  {widgetType && getWidgetIcon(widgetType.icon)}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditWidgetDialog(widget);
                                  }}
                                >
                                  <Settings2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeWidget(widget.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1 mb-3">
                              <p className="font-medium text-sm">{widgetType?.name}</p>
                              <p className="text-xs text-muted-foreground">{kpiType?.name}</p>
                            </div>
                            <div className="h-24 bg-muted/30 rounded-md flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">{design?.name} design</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Widget Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingWidget ? "Rediger Widget" : "Tilføj Widget"}</DialogTitle>
            <DialogDescription>
              Vælg widget type, KPI og design for din widget
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Widget Type Selection */}
            <div className="space-y-2">
              <Label>Widget Type</Label>
              <Select value={selectedWidgetType} onValueChange={setSelectedWidgetType}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg widget type" />
                </SelectTrigger>
                <SelectContent>
                  {activeWidgetTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        {getWidgetIcon(type.icon)}
                        <span>{type.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* KPI Type Selection */}
            <div className="space-y-2">
              <Label>KPI Type</Label>
              <Select value={selectedKpiType} onValueChange={setSelectedKpiType}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg KPI type" />
                </SelectTrigger>
                <SelectContent>
                  {KPI_TYPES.map((kpi) => (
                    <SelectItem key={kpi.id} value={kpi.id}>
                      <div className="flex flex-col">
                        <span>{kpi.name}</span>
                        <span className="text-xs text-muted-foreground">{kpi.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Design Selection */}
            <div className="space-y-2">
              <Label>Design</Label>
              <div className="grid grid-cols-3 gap-2">
                {DESIGN_OPTIONS.map((design) => (
                  <div
                    key={design.id}
                    onClick={() => setSelectedDesign(design.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedDesign === design.id 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className={`h-12 rounded-md mb-2 ${design.preview}`} />
                    <p className="text-xs font-medium text-center">{design.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={handleSaveWidget}>
              {editingWidget ? "Gem ændringer" : "Tilføj widget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
