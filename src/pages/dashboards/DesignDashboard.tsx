import { useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  Clock, 
  Trophy,
  Gauge,
  Calendar as CalendarIcon,
  Activity,
  Plus,
  Save,
  Eye,
  Trash2,
  GripVertical,
  Settings2,
  Table2,
  Award,
  LayoutGrid,
  Target,
  ArrowUpDown,
  Palette
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWidgetTypes, WidgetTypeConfig } from "@/hooks/useWidgetTypes";
import { useKpiTypes } from "@/hooks/useKpiTypes";

interface TimePeriod {
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

interface ColorTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

interface PlacedWidget {
  id: string;
  widgetTypeId: string;
  dataSource: "kpi" | "custom";
  kpiTypeIds: string[];  // Now supports multiple KPIs
  customValue?: string;
  customLabel?: string;
  timePeriodId: string;
  customFromDate?: Date;
  // New optional fields
  title?: string;  // Custom title override
  targetValue?: number;  // Target value for progress widgets
  showComparison?: boolean;  // Show comparison with previous period
  comparisonPeriodId?: string;  // Which period to compare against
  colorThemeId?: string;  // Color theme for the widget
  showTrend?: boolean;  // Show trend indicator
  x: number;
  y: number;
  width: number;
  height: number;
}

const TIME_PERIODS: TimePeriod[] = [
  { id: "today", name: "I dag", description: "Data fra i dag" },
  { id: "yesterday", name: "I går", description: "Data fra i går" },
  { id: "this-week", name: "Denne uge", description: "Data fra denne uge" },
  { id: "last-week", name: "Sidste uge", description: "Data fra sidste uge" },
  { id: "this-month", name: "Denne måned", description: "Data fra denne måned" },
  { id: "last-month", name: "Sidste måned", description: "Data fra sidste måned" },
  { id: "this-year", name: "I år", description: "Data fra i år" },
  { id: "last-year", name: "Sidste år", description: "Data fra sidste år" },
  { id: "custom-from", name: "Fra dato til nu", description: "Vælg startdato" },
];

const COMPARISON_PERIODS: TimePeriod[] = [
  { id: "previous-period", name: "Forrige periode", description: "Sammenlign med forrige periode" },
  { id: "same-period-last-year", name: "Samme periode sidste år", description: "Sammenlign med samme periode sidste år" },
  { id: "yesterday", name: "I går", description: "Sammenlign med i går" },
  { id: "last-week", name: "Sidste uge", description: "Sammenlign med sidste uge" },
  { id: "last-month", name: "Sidste måned", description: "Sammenlign med sidste måned" },
];

const DESIGN_OPTIONS: DesignOption[] = [
  { id: "minimal", name: "Minimal", description: "Rent og simpelt design", preview: "bg-card border" },
  { id: "gradient", name: "Gradient", description: "Gradient baggrund", preview: "bg-gradient-to-br from-primary/20 to-primary/5" },
  { id: "dark", name: "Mørk", description: "Mørk baggrund", preview: "bg-zinc-900 text-white" },
  { id: "accent", name: "Accent", description: "Med accent farve", preview: "bg-primary/10 border-primary/30" },
  { id: "glass", name: "Glas", description: "Glasmorfisme effekt", preview: "bg-white/10 backdrop-blur-sm border-white/20" },
  { id: "outline", name: "Kontur", description: "Kun kontur", preview: "bg-transparent border-2" },
];

const COLOR_THEMES: ColorTheme[] = [
  { id: "default", name: "Standard", primary: "hsl(var(--primary))", secondary: "hsl(var(--secondary))" },
  { id: "green", name: "Grøn", primary: "#22c55e", secondary: "#86efac" },
  { id: "blue", name: "Blå", primary: "#3b82f6", secondary: "#93c5fd" },
  { id: "purple", name: "Lilla", primary: "#8b5cf6", secondary: "#c4b5fd" },
  { id: "orange", name: "Orange", primary: "#f97316", secondary: "#fdba74" },
  { id: "red", name: "Rød", primary: "#ef4444", secondary: "#fca5a5" },
];

const getWidgetIcon = (iconName: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    "gauge": Gauge,
    "bar-chart": BarChart3,
    "line-chart": LineChart,
    "pie-chart": PieChart,
    "table": Table2,
    "award": Award,
    "clock": Clock,
    "trending-up": TrendingUp,
    "activity": Activity,
    "trophy": Trophy,
  };
  const IconComponent = icons[iconName] || LayoutGrid;
  return <IconComponent className="h-5 w-5" />;
};

export default function DesignDashboard() {
  const { toast } = useToast();
  const { activeWidgetTypes } = useWidgetTypes();
  const { activeKpiTypes } = useKpiTypes();
  const [placedWidgets, setPlacedWidgets] = useState<PlacedWidget[]>([]);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<PlacedWidget | null>(null);
  
  // Global dashboard design state
  const [globalDesign, setGlobalDesign] = useState<string>("minimal");
  
  // Config form state
  const [selectedWidgetType, setSelectedWidgetType] = useState<string>("");
  const [dataSource, setDataSource] = useState<"kpi" | "custom">("kpi");
  const [selectedKpiTypes, setSelectedKpiTypes] = useState<string[]>([]);
  const [customValue, setCustomValue] = useState<string>("");
  const [customLabel, setCustomLabel] = useState<string>("");
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string>("today");
  const [customFromDate, setCustomFromDate] = useState<Date | undefined>();
  // New config state
  const [customTitle, setCustomTitle] = useState<string>("");
  const [targetValue, setTargetValue] = useState<string>("");
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPeriodId, setComparisonPeriodId] = useState<string>("previous-period");
  const [colorThemeId, setColorThemeId] = useState<string>("default");
  const [showTrend, setShowTrend] = useState(true);

  const currentWidgetConfig = activeWidgetTypes.find(w => w.value === selectedWidgetType);
  const supportsMultiKpi = currentWidgetConfig?.supportsMultiKpi || false;
  const supportsComparison = currentWidgetConfig?.supportsComparison || false;
  const supportsTarget = currentWidgetConfig?.supportsTarget || false;

  const resetForm = () => {
    setSelectedWidgetType("");
    setDataSource("kpi");
    setSelectedKpiTypes([]);
    setCustomValue("");
    setCustomLabel("");
    setSelectedTimePeriod("today");
    setCustomFromDate(undefined);
    setCustomTitle("");
    setTargetValue("");
    setShowComparison(false);
    setComparisonPeriodId("previous-period");
    setColorThemeId("default");
    setShowTrend(true);
  };

  const openAddWidgetDialog = () => {
    setEditingWidget(null);
    resetForm();
    setIsConfigDialogOpen(true);
  };

  const openEditWidgetDialog = (widget: PlacedWidget) => {
    setEditingWidget(widget);
    setSelectedWidgetType(widget.widgetTypeId);
    setDataSource(widget.dataSource);
    setSelectedKpiTypes(widget.kpiTypeIds || []);
    setCustomValue(widget.customValue || "");
    setCustomLabel(widget.customLabel || "");
    setSelectedTimePeriod(widget.timePeriodId);
    setCustomFromDate(widget.customFromDate);
    setCustomTitle(widget.title || "");
    setTargetValue(widget.targetValue?.toString() || "");
    setShowComparison(widget.showComparison || false);
    setComparisonPeriodId(widget.comparisonPeriodId || "previous-period");
    setColorThemeId(widget.colorThemeId || "default");
    setShowTrend(widget.showTrend ?? true);
    setIsConfigDialogOpen(true);
  };

  const toggleKpiSelection = (kpiId: string) => {
    if (supportsMultiKpi) {
      setSelectedKpiTypes(prev => 
        prev.includes(kpiId) 
          ? prev.filter(id => id !== kpiId)
          : [...prev, kpiId]
      );
    } else {
      setSelectedKpiTypes([kpiId]);
    }
  };

  const handleSaveWidget = () => {
    if (!selectedWidgetType) {
      toast({ title: "Vælg widget type", variant: "destructive" });
      return;
    }
    if (dataSource === "kpi" && selectedKpiTypes.length === 0) {
      toast({ title: "Vælg mindst én KPI", variant: "destructive" });
      return;
    }
    if (dataSource === "custom" && !customValue) {
      toast({ title: "Indtast en værdi", variant: "destructive" });
      return;
    }
    if (selectedTimePeriod === "custom-from" && !customFromDate) {
      toast({ title: "Vælg en startdato", variant: "destructive" });
      return;
    }

    const widgetData: Omit<PlacedWidget, "id" | "x" | "y" | "width" | "height"> = {
      widgetTypeId: selectedWidgetType,
      dataSource,
      kpiTypeIds: dataSource === "kpi" ? selectedKpiTypes : [],
      customValue: dataSource === "custom" ? customValue : undefined,
      customLabel: dataSource === "custom" ? customLabel : undefined,
      timePeriodId: selectedTimePeriod,
      customFromDate: selectedTimePeriod === "custom-from" ? customFromDate : undefined,
      title: customTitle || undefined,
      targetValue: targetValue ? parseFloat(targetValue) : undefined,
      showComparison: supportsComparison ? showComparison : undefined,
      comparisonPeriodId: showComparison ? comparisonPeriodId : undefined,
      colorThemeId: colorThemeId !== "default" ? colorThemeId : undefined,
      showTrend,
    };

    if (editingWidget) {
      setPlacedWidgets(prev => prev.map(w => 
        w.id === editingWidget.id ? { ...w, ...widgetData } : w
      ));
      toast({ title: "Widget opdateret" });
    } else {
      const newWidget: PlacedWidget = {
        ...widgetData,
        id: `widget-${Date.now()}`,
        x: placedWidgets.length % 3,
        y: Math.floor(placedWidgets.length / 3),
        width: 1,
        height: 1,
      };
      setPlacedWidgets(prev => [...prev, newWidget]);
      toast({ title: "Widget tilføjet" });
    }
    setIsConfigDialogOpen(false);
  };

  const removeWidget = (widgetId: string) => {
    setPlacedWidgets(prev => prev.filter(w => w.id !== widgetId));
    toast({ title: "Widget fjernet" });
  };

  const getDesignClasses = (designId: string) => {
    const design = DESIGN_OPTIONS.find(d => d.id === designId);
    return design?.preview || "bg-card border";
  };

  const getDisplayLabel = (widget: PlacedWidget) => {
    if (widget.dataSource === "custom") {
      return widget.customLabel || "Brugerdefineret";
    }
    const kpiNames = widget.kpiTypeIds
      .map(id => activeKpiTypes.find(k => k.id === id)?.name)
      .filter(Boolean);
    return kpiNames.join(", ") || "";
  };

  const getDisplayValue = (widget: PlacedWidget) => {
    if (widget.dataSource === "custom") {
      return widget.customValue || "0";
    }
    return "—";
  };

  const getWidgetTypeName = (widgetTypeId: string) => {
    return activeWidgetTypes.find(w => w.value === widgetTypeId)?.label || widgetTypeId;
  };

  const getWidgetTypeIcon = (widgetTypeId: string) => {
    const type = activeWidgetTypes.find(w => w.value === widgetTypeId);
    return type ? getWidgetIcon(type.iconName) : <LayoutGrid className="h-5 w-5" />;
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Design Dashboard</h1>
            <p className="text-muted-foreground">Design dit eget dashboard med widgets fra indstillinger</p>
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

        {/* Global Design Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Vælg Design
            </CardTitle>
            <CardDescription>Dette design anvendes på alle widgets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-3">
              {DESIGN_OPTIONS.map((design) => (
                <div
                  key={design.id}
                  onClick={() => setGlobalDesign(design.id)}
                  className={cn(
                    "p-3 rounded-lg border-2 cursor-pointer transition-all",
                    globalDesign === design.id 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className={cn("h-12 rounded-md mb-2", design.preview)} />
                  <p className="text-xs font-medium text-center">{design.name}</p>
                  <p className="text-[10px] text-muted-foreground text-center">{design.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {activeWidgetTypes.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Ingen aktive widget typer</h3>
              <p className="text-muted-foreground max-w-sm">
                Gå til Dashboard Indstillinger → Widgets for at aktivere widget typer.
              </p>
            </CardContent>
          </Card>
        )}

        {activeWidgetTypes.length > 0 && (
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Aktive Widget Typer</CardTitle>
                  <CardDescription>Fra dashboard indstillinger</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                  {activeWidgetTypes.map((widget) => (
                    <div
                      key={widget.value}
                      onClick={() => {
                        resetForm();
                        setSelectedWidgetType(widget.value);
                        setEditingWidget(null);
                        setIsConfigDialogOpen(true);
                      }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent cursor-pointer transition-colors"
                    >
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        {getWidgetIcon(widget.iconName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{widget.label}</p>
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
                        Klik på en widget type til venstre eller "Tilføj ny widget"
                      </p>
                      <Button onClick={openAddWidgetDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tilføj første widget
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {placedWidgets.map((widget) => {
                        const timePeriod = TIME_PERIODS.find(t => t.id === widget.timePeriodId);
                        const design = DESIGN_OPTIONS.find(d => d.id === globalDesign);
                        const colorTheme = COLOR_THEMES.find(c => c.id === widget.colorThemeId);
                        const widgetConfig = activeWidgetTypes.find(w => w.value === widget.widgetTypeId);
                        
                        return (
                          <Card 
                            key={widget.id} 
                            className={`relative group cursor-pointer transition-all hover:shadow-lg ${getDesignClasses(globalDesign)}`}
                            onClick={() => openEditWidgetDialog(widget)}
                            style={colorTheme && colorTheme.id !== "default" ? { 
                              borderColor: colorTheme.primary,
                              borderWidth: '2px'
                            } : undefined}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                  <div 
                                    className="p-1.5 rounded-md"
                                    style={{ 
                                      backgroundColor: colorTheme?.primary ? `${colorTheme.primary}20` : undefined,
                                      color: colorTheme?.primary
                                    }}
                                  >
                                    {getWidgetTypeIcon(widget.widgetTypeId)}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); openEditWidgetDialog(widget); }}
                                  >
                                    <Settings2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-1 mb-3">
                                <p className="font-medium text-sm">
                                  {widget.title || getWidgetTypeName(widget.widgetTypeId)}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {getDisplayLabel(widget)}
                                  {widget.kpiTypeIds.length > 1 && (
                                    <span className="ml-1 text-primary">
                                      ({widget.kpiTypeIds.length} KPI'er)
                                    </span>
                                  )}
                                </p>
                                <p className="text-2xl font-bold" style={{ color: colorTheme?.primary }}>
                                  {getDisplayValue(widget)}
                                </p>
                                {widget.targetValue && (
                                  <div className="flex items-center gap-1 text-xs">
                                    <Target className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Mål: {widget.targetValue}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  {timePeriod?.name}
                                  {widget.showComparison && (
                                    <ArrowUpDown className="h-3 w-3 text-primary" />
                                  )}
                                </span>
                                <span>{design?.name}</span>
                              </div>
                              {/* Feature badges */}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {widgetConfig?.supportsMultiKpi && widget.kpiTypeIds.length > 1 && (
                                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                    Multi-KPI
                                  </span>
                                )}
                                {widget.showComparison && (
                                  <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                                    Sammenligning
                                  </span>
                                )}
                                {widget.targetValue && (
                                  <span className="text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">
                                    Mål
                                  </span>
                                )}
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
        )}
      </div>

      {/* Widget Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWidget ? "Rediger Widget" : "Tilføj Widget"}</DialogTitle>
            <DialogDescription>Konfigurer din widget</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 1. Widget Type */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">1. Widget Type</Label>
              <Select value={selectedWidgetType} onValueChange={setSelectedWidgetType}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg widget type" />
                </SelectTrigger>
                <SelectContent>
                  {activeWidgetTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {getWidgetIcon(type.iconName)}
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Data Source (KPI or Custom) */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">2. Datakilde</Label>
              <RadioGroup value={dataSource} onValueChange={(v) => setDataSource(v as "kpi" | "custom")} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="kpi" id="kpi" />
                  <Label htmlFor="kpi" className="cursor-pointer">Vælg KPI{supportsMultiKpi && "(er)"}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="cursor-pointer">Eget tal</Label>
                </div>
              </RadioGroup>

              {dataSource === "kpi" ? (
                <div className="space-y-2">
                  {supportsMultiKpi && (
                    <p className="text-xs text-muted-foreground">
                      Vælg flere KPI'er til denne widget (klik for at vælge/fravælge)
                    </p>
                  )}
                  <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-md p-2">
                    {activeKpiTypes.map((kpi) => (
                      <div
                        key={kpi.id}
                        onClick={() => toggleKpiSelection(kpi.id)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                          selectedKpiTypes.includes(kpi.id)
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-accent"
                        )}
                      >
                        <Checkbox
                          checked={selectedKpiTypes.includes(kpi.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{kpi.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{kpi.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {kpi.category}
                        </span>
                      </div>
                    ))}
                  </div>
                  {selectedKpiTypes.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedKpiTypes.length} KPI{selectedKpiTypes.length > 1 && "'er"} valgt
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="customLabel" className="text-sm">Label</Label>
                    <Input
                      id="customLabel"
                      placeholder="f.eks. 'Mål opnået'"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customValue" className="text-sm">Værdi</Label>
                    <Input
                      id="customValue"
                      placeholder="f.eks. '42' eller '85%'"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Time Period */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">3. Tidsperiode</Label>
              <Select value={selectedTimePeriod} onValueChange={setSelectedTimePeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg tidsperiode" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PERIODS.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTimePeriod === "custom-from" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2",
                        !customFromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFromDate ? format(customFromDate, "PPP", { locale: da }) : "Vælg startdato"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFromDate}
                      onSelect={setCustomFromDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* 4. Advanced Options - Comparison, Target, Trend */}
            {(supportsComparison || supportsTarget) && (
              <div className="space-y-4 border-t pt-4">
                <Label className="text-base font-semibold">4. Avancerede indstillinger</Label>
                
                {/* Custom Title */}
                <div className="space-y-2">
                  <Label htmlFor="customTitle" className="text-sm flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Tilpasset titel (valgfrit)
                  </Label>
                  <Input
                    id="customTitle"
                    placeholder="Automatisk baseret på KPI'er"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>

                {/* Target Value */}
                {supportsTarget && (
                  <div className="space-y-2">
                    <Label htmlFor="targetValue" className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Målværdi (valgfrit)
                    </Label>
                    <Input
                      id="targetValue"
                      type="number"
                      placeholder="f.eks. 100"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Vis fremgang mod et mål
                    </p>
                  </div>
                )}

                {/* Comparison Period */}
                {supportsComparison && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4" />
                        Vis sammenligning
                      </Label>
                      <Switch
                        checked={showComparison}
                        onCheckedChange={setShowComparison}
                      />
                    </div>
                    {showComparison && (
                      <Select value={comparisonPeriodId} onValueChange={setComparisonPeriodId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sammenlign med..." />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPARISON_PERIODS.map((period) => (
                            <SelectItem key={period.id} value={period.id}>
                              {period.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Show Trend */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Vis trend-indikator
                  </Label>
                  <Switch
                    checked={showTrend}
                    onCheckedChange={setShowTrend}
                  />
                </div>
              </div>
            )}

            {/* Color Theme - renumbered to 4 */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4" />
                4. Farvetema
              </Label>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_THEMES.map((theme) => (
                  <div
                    key={theme.id}
                    onClick={() => setColorThemeId(theme.id)}
                    className={cn(
                      "aspect-square rounded-lg cursor-pointer transition-all border-2 flex items-center justify-center",
                      colorThemeId === theme.id 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-border hover:border-primary/50"
                    )}
                    style={{ backgroundColor: theme.primary }}
                    title={theme.name}
                  >
                    {colorThemeId === theme.id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
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
