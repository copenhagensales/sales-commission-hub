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
  Palette,
  Users,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useWidgetTypes, WidgetTypeConfig } from "@/hooks/useWidgetTypes";
import { useKpiTypes } from "@/hooks/useKpiTypes";
import { useDesignTypes } from "@/hooks/useDesignTypes";
import { ResizableWidgetCard, GRID_COLS, CELL_HEIGHT } from "@/components/dashboard/ResizableWidgetCard";

interface TimePeriod {
  id: string;
  name: string;
  description: string;
}

// DesignOption interface removed - now using useDesignTypes hook

interface ColorTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

interface TrackingScope {
  id: string;
  name: string;
  description: string;
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
  trackingScopeId?: string;  // Who/what the KPI tracks
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

// DESIGN_OPTIONS moved to useDesignTypes hook

const COLOR_THEMES: ColorTheme[] = [
  { id: "default", name: "Standard", primary: "hsl(var(--primary))", secondary: "hsl(var(--secondary))" },
  { id: "green", name: "Grøn", primary: "#22c55e", secondary: "#86efac" },
  { id: "blue", name: "Blå", primary: "#3b82f6", secondary: "#93c5fd" },
  { id: "purple", name: "Lilla", primary: "#8b5cf6", secondary: "#c4b5fd" },
  { id: "orange", name: "Orange", primary: "#f97316", secondary: "#fdba74" },
  { id: "red", name: "Rød", primary: "#ef4444", secondary: "#fca5a5" },
];

const TRACKING_SCOPES: TrackingScope[] = [
  { id: "all", name: "Alle", description: "Samlet data for hele virksomheden" },
  { id: "team", name: "Team", description: "Data for et specifikt team" },
  { id: "employee", name: "Medarbejder", description: "Data for en enkelt medarbejder" },
  { id: "client", name: "Kunde", description: "Data for en specifik kunde" },
  { id: "campaign", name: "Kampagne", description: "Data for en specifik kampagne" },
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
  const navigate = useNavigate();
  const { activeWidgetTypes } = useWidgetTypes();
  const { activeKpiTypes } = useKpiTypes();
  const { activeDesignTypes } = useDesignTypes();
  const [placedWidgets, setPlacedWidgets] = useState<PlacedWidget[]>([]);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isDesignPanelOpen, setIsDesignPanelOpen] = useState(true);
  const [editingWidget, setEditingWidget] = useState<PlacedWidget | null>(null);

  const handleClose = () => {
    navigate(-1); // Go back to previous page
  };
  
  // Global dashboard design state - default to first active design
  const [globalDesign, setGlobalDesign] = useState<string>(() => {
    return activeDesignTypes[0]?.id || "minimal";
  });
  
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
  const [trackingScopeId, setTrackingScopeId] = useState<string>("all");

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
    setTrackingScopeId("all");
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
    setTrackingScopeId(widget.trackingScopeId || "all");
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
      trackingScopeId: trackingScopeId !== "all" ? trackingScopeId : undefined,
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

  const resizeWidget = (widgetId: string, newSize: { width: number; height: number }) => {
    setPlacedWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, width: newSize.width, height: newSize.height } : w
    ));
  };

  // Generate example values for preview
  const getExampleValue = (widget: PlacedWidget) => {
    if (widget.dataSource === "custom") {
      return widget.customValue || "0";
    }
    // Generate realistic example based on KPI type
    const firstKpi = widget.kpiTypeIds[0];
    if (firstKpi?.includes("sales") || firstKpi?.includes("revenue")) return "847.520 kr";
    if (firstKpi?.includes("calls")) return "1.247";
    if (firstKpi?.includes("conversion") || firstKpi?.includes("rate")) return "23,4%";
    if (firstKpi?.includes("target") || firstKpi?.includes("progress")) return "78%";
    if (firstKpi?.includes("avg")) return "4.320 kr";
    if (firstKpi?.includes("time") || firstKpi?.includes("duration")) return "3:45";
    return Math.floor(Math.random() * 1000 + 100).toString();
  };

  const getExampleTrend = () => {
    const trends = [12.5, -3.2, 8.7, -1.5, 5.3, 0, 15.2, -7.8];
    return trends[Math.floor(Math.random() * trends.length)];
  };

  const getDesignClasses = (designId: string) => {
    const design = activeDesignTypes.find(d => d.id === designId);
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
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header with close button */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Design Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button>
              <Save className="h-4 w-4 mr-2" />
              Gem Dashboard
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="h-10 w-10 rounded-full hover:bg-destructive/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area - Dashboard Canvas as main view */}
      <div className="flex-1 overflow-hidden relative">
        {/* Dashboard Canvas - Full size view */}
        <div className="absolute inset-0 overflow-auto">
          <div 
            className="relative min-h-full p-4"
            style={{ minHeight: `${CELL_HEIGHT * 4}px` }}
          >
            {/* Grid cells background - only show when design panel is open */}
            {isDesignPanelOpen && (
              <div 
                className="absolute inset-4 grid gap-1 pointer-events-none"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                  gridTemplateRows: `repeat(4, ${CELL_HEIGHT}px)`,
                }}
              >
                {Array.from({ length: GRID_COLS * 4 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="border border-dashed border-border/40 rounded-md bg-muted/20"
                  />
                ))}
              </div>
            )}

            {/* Content layer */}
            {placedWidgets.length === 0 ? (
              <div className="relative flex flex-col items-center justify-center h-[480px] text-center z-10">
                <div className="p-4 rounded-full bg-background/80 backdrop-blur mb-4">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Ingen widgets endnu</h3>
                <p className="text-muted-foreground max-w-sm mb-4">
                  Brug knapperne i højre hjørne for at tilføje widgets
                </p>
              </div>
            ) : (
              <div 
                className="relative grid gap-4 z-10"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                  gridAutoRows: `${CELL_HEIGHT}px`
                }}
              >
                {placedWidgets.map((widget) => {
                  const timePeriod = TIME_PERIODS.find(t => t.id === widget.timePeriodId);
                  const design = activeDesignTypes.find(d => d.id === globalDesign);
                  const colorTheme = COLOR_THEMES.find(c => c.id === widget.colorThemeId);
                  const trackingScope = TRACKING_SCOPES.find(s => s.id === widget.trackingScopeId);
                  
                  return (
                    <ResizableWidgetCard
                      key={widget.id}
                      id={widget.id}
                      title={widget.title || getWidgetTypeName(widget.widgetTypeId)}
                      kpiLabel={getDisplayLabel(widget)}
                      value={getExampleValue(widget)}
                      size={{ width: widget.width, height: widget.height }}
                      designClasses={getDesignClasses(globalDesign)}
                      colorTheme={colorTheme}
                      timePeriodName={timePeriod?.name}
                      designName={design?.name}
                      targetValue={widget.targetValue}
                      showComparison={widget.showComparison}
                      trackingScopeName={trackingScope?.id !== "all" ? trackingScope?.name : undefined}
                      showTrend={widget.showTrend}
                      trendValue={widget.showTrend ? getExampleTrend() : undefined}
                      multiKpiCount={widget.kpiTypeIds.length > 1 ? widget.kpiTypeIds.length : undefined}
                      icon={getWidgetTypeIcon(widget.widgetTypeId)}
                      onEdit={() => openEditWidgetDialog(widget)}
                      onRemove={() => removeWidget(widget.id)}
                      onResize={(newSize) => resizeWidget(widget.id, newSize)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Floating action buttons - bottom right */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20 opacity-40 hover:opacity-100 transition-opacity duration-300">
          <Button onClick={openAddWidgetDialog} size="sm" className="shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Tilføj widget
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" className="shadow-lg">
                <Palette className="h-4 w-4 mr-2" />
                Vælg Design
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end" side="top">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Vælg Design</h4>
                <div className="grid grid-cols-2 gap-2">
                  {activeDesignTypes.map((design) => (
                    <div
                      key={design.id}
                      onClick={() => setGlobalDesign(design.id)}
                      className={cn(
                        "p-2 rounded-lg border-2 cursor-pointer transition-all",
                        globalDesign === design.id 
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn("h-6 rounded-md mb-1", design.preview)} />
                      <p className="text-xs font-medium text-center">{design.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
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

            {/* 3. Tracking Scope - Who/what to track */}
            {dataSource === "kpi" && (
              <div className="space-y-2">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  3. Hvem skal trackes?
                </Label>
                <Select value={trackingScopeId} onValueChange={setTrackingScopeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg tracking scope" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKING_SCOPES.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>
                        <div className="flex flex-col">
                          <span>{scope.name}</span>
                          <span className="text-xs text-muted-foreground">{scope.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vælg om KPI'en skal vise data for alle, et team, en medarbejder osv.
                </p>
              </div>
            )}

            {/* 4. Time Period */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">4. Tidsperiode</Label>
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

            {/* 5. Advanced Options - Comparison, Target, Trend */}
            {(supportsComparison || supportsTarget) && (
              <div className="space-y-4 border-t pt-4">
                <Label className="text-base font-semibold">5. Avancerede indstillinger</Label>
                
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

            {/* 6. Color Theme */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4" />
                6. Farvetema
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
    </div>
  );
}
