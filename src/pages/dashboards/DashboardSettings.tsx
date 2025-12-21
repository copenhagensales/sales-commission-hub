import { useState } from "react";
import { BarChart3, Plus, Pencil, Trash2, GripVertical, Palette, Layout, Type, Sparkles, Square, Circle, TrendingUp, Phone, Users, Award, PartyPopper, Flame, Star, Zap, Heart, Clock, Play, Target } from "lucide-react";
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
import { CelebrationOverlay } from "@/components/dashboard/CelebrationOverlay";

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
  data_source: string | null;
  formula: string | null;
  base_metric: string | null;
}

interface DashboardTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardStyle: "flat" | "elevated" | "bordered" | "glass";
  borderRadius: "none" | "small" | "medium" | "large";
  fontSize: "small" | "medium" | "large" | "xlarge";
  animations: boolean;
  // Celebration popup settings
  celebrationEnabled: boolean;
  celebrationEffect: "fireworks" | "confetti" | "stars" | "hearts" | "flames" | "sparkles";
  celebrationDuration: number; // seconds
  celebrationTriggerKpiId: string | null; // Which KPI triggers celebration
  celebrationTriggerCondition: "any_update" | "increase" | "decrease" | "reaches_goal" | "exceeds_value";
  celebrationTriggerValue: number | null; // Custom threshold value
  celebrationText: string;
  celebrationDataFields: string[];
}

const CELEBRATION_DATA_FIELDS = [
  { id: "employee_name", label: "Udløsende medarbejder", placeholder: "{{medarbejder}}", description: "Navnet på medarbejderen der udløste fejringen" },
  { id: "team_name", label: "Udløsende hold", placeholder: "{{hold}}", description: "Holdet som medarbejderen tilhører" },
  { id: "sale_number", label: "Salg nummer", placeholder: "{{salg_nummer}}", description: "Nummer på det seneste salg" },
  { id: "product_name", label: "Produkt navn", placeholder: "{{produkt}}", description: "Navnet på det solgte produkt" },
  { id: "current_value", label: "KPI værdi", placeholder: "{{værdi}}", description: "Den aktuelle værdi af KPI'en" },
  { id: "goal_value", label: "Mål værdi", placeholder: "{{mål}}", description: "Målværdien for KPI'en" },
];

const CELEBRATION_EFFECTS = [
  { value: "fireworks", label: "Fyrværkeri", icon: PartyPopper, description: "Eksplosive farver" },
  { value: "confetti", label: "Konfetti", icon: Sparkles, description: "Festlige papirstykker" },
  { value: "stars", label: "Stjerner", icon: Star, description: "Glitrende stjerner" },
  { value: "hearts", label: "Hjerter", icon: Heart, description: "Flyvende hjerter" },
  { value: "flames", label: "Flammer", icon: Flame, description: "Brændende succes" },
  { value: "sparkles", label: "Gnister", icon: Zap, description: "Elektriske gnister" },
];

const CELEBRATION_TRIGGER_CONDITIONS = [
  { value: "any_update", label: "Ved enhver opdatering", description: "Vises hver gang KPI'en ændres" },
  { value: "increase", label: "Ved stigning", description: "Vises kun når værdien stiger" },
  { value: "decrease", label: "Ved fald", description: "Vises kun når værdien falder" },
  { value: "reaches_goal", label: "Når mål nås", description: "Vises når KPI'en når sin målværdi" },
  { value: "exceeds_value", label: "Når værdi overskrides", description: "Vises når værdi overstiger en grænse" },
];

const DURATION_OPTIONS = [
  { value: 2, label: "2 sekunder" },
  { value: 3, label: "3 sekunder" },
  { value: 5, label: "5 sekunder" },
  { value: 8, label: "8 sekunder" },
  { value: 10, label: "10 sekunder" },
];

const KPI_TYPES = [
  { value: "number", label: "Antal" },
  { value: "percentage", label: "Procent" },
  { value: "currency", label: "Beløb (DKK)" },
];

const DATA_SOURCE_OPTIONS = [
  { value: "manual", label: "Manuel (ingen datakilde)" },
  { value: "base", label: "Basis-metrik" },
  { value: "formula", label: "Formel (beregnet)" },
];

const BASE_METRICS = [
  { value: "antal_salg", label: "Antal salg", description: "Antal produktlinjer solgt" },
  { value: "antal_kunder", label: "Antal kunder", description: "Antal unikke salg" },
  { value: "timer", label: "Timer", description: "Timer fra vagtplan" },
  { value: "antal_medarbejdere", label: "Antal medarbejdere", description: "Unikke sælgere med data" },
];

const PRESET_THEMES: DashboardTheme[] = [
  {
    id: "modern-blue",
    name: "Modern Blue",
    primaryColor: "#3b82f6",
    secondaryColor: "#1e40af",
    accentColor: "#10b981",
    backgroundColor: "#0f172a",
    cardStyle: "glass",
    borderRadius: "large",
    fontSize: "large",
    animations: true,
    celebrationEnabled: true,
    celebrationEffect: "fireworks",
    celebrationDuration: 5,
    celebrationTriggerKpiId: null,
    celebrationTriggerCondition: "increase",
    celebrationTriggerValue: null,
    celebrationText: "🎉 {{medarbejder}} har lige lavet salg nummer {{salg_nummer}}!",
    celebrationDataFields: ["employee_name", "sale_number"],
  },
  {
    id: "corporate",
    name: "Corporate",
    primaryColor: "#1e3a5f",
    secondaryColor: "#2d5a87",
    accentColor: "#f59e0b",
    backgroundColor: "#f8fafc",
    cardStyle: "bordered",
    borderRadius: "small",
    fontSize: "medium",
    animations: false,
    celebrationEnabled: false,
    celebrationEffect: "confetti",
    celebrationDuration: 3,
    celebrationTriggerKpiId: null,
    celebrationTriggerCondition: "reaches_goal",
    celebrationTriggerValue: null,
    celebrationText: "",
    celebrationDataFields: [],
  },
  {
    id: "vibrant",
    name: "Vibrant",
    primaryColor: "#8b5cf6",
    secondaryColor: "#ec4899",
    accentColor: "#14b8a6",
    backgroundColor: "#18181b",
    cardStyle: "elevated",
    borderRadius: "large",
    fontSize: "xlarge",
    animations: true,
    celebrationEnabled: true,
    celebrationEffect: "stars",
    celebrationDuration: 5,
    celebrationTriggerKpiId: null,
    celebrationTriggerCondition: "any_update",
    celebrationTriggerValue: null,
    celebrationText: "⭐ {{medarbejder}} er on fire! Salg #{{salg_nummer}}",
    celebrationDataFields: ["employee_name", "sale_number"],
  },
  {
    id: "minimal",
    name: "Minimal",
    primaryColor: "#374151",
    secondaryColor: "#6b7280",
    accentColor: "#059669",
    backgroundColor: "#ffffff",
    cardStyle: "flat",
    borderRadius: "medium",
    fontSize: "medium",
    animations: false,
    celebrationEnabled: false,
    celebrationEffect: "sparkles",
    celebrationDuration: 2,
    celebrationTriggerKpiId: null,
    celebrationTriggerCondition: "reaches_goal",
    celebrationTriggerValue: null,
    celebrationText: "",
    celebrationDataFields: [],
  },
];

const CARD_STYLES = [
  { value: "flat", label: "Flad", description: "Simpel uden skygge" },
  { value: "elevated", label: "Hævet", description: "Med skygge" },
  { value: "bordered", label: "Rammet", description: "Med border" },
  { value: "glass", label: "Glas", description: "Gennemsigtig effekt" },
];

const BORDER_RADIUS_OPTIONS = [
  { value: "none", label: "Ingen", px: "0px" },
  { value: "small", label: "Lille", px: "4px" },
  { value: "medium", label: "Medium", px: "8px" },
  { value: "large", label: "Stor", px: "16px" },
];

const FONT_SIZE_OPTIONS = [
  { value: "small", label: "Lille", size: "24px" },
  { value: "medium", label: "Medium", size: "32px" },
  { value: "large", label: "Stor", size: "48px" },
  { value: "xlarge", label: "Ekstra stor", size: "64px" },
];

const DashboardSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<DashboardKpi | null>(null);
  
  // Design state
  const [isDesignDialogOpen, setIsDesignDialogOpen] = useState(false);
  const [savedThemes, setSavedThemes] = useState<DashboardTheme[]>([]);
  const [editingTheme, setEditingTheme] = useState<DashboardTheme | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [themeFormData, setThemeFormData] = useState<DashboardTheme>({
    id: "",
    name: "",
    primaryColor: "#3b82f6",
    secondaryColor: "#1e40af",
    accentColor: "#10b981",
    backgroundColor: "#0f172a",
    cardStyle: "elevated",
    borderRadius: "medium",
    fontSize: "large",
    animations: true,
    celebrationEnabled: false,
    celebrationEffect: "fireworks",
    celebrationDuration: 5,
    celebrationTriggerKpiId: null,
    celebrationTriggerCondition: "increase",
    celebrationTriggerValue: null,
    celebrationText: "",
    celebrationDataFields: [],
  });

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
    data_source: "manual",
    formula: "",
    base_metric: "",
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
        data_source: data.data_source,
        formula: data.data_source === "formula" ? data.formula : null,
        base_metric: data.data_source === "base" ? data.base_metric : null,
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
      data_source: "manual",
      formula: "",
      base_metric: "",
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
      data_source: kpi.data_source || "manual",
      formula: kpi.formula || "",
      base_metric: kpi.base_metric || "",
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

  // Design functions
  const openCreateThemeDialog = (preset?: DashboardTheme) => {
    if (preset) {
      setThemeFormData({ ...preset, id: "", name: `${preset.name} (kopi)` });
    } else {
      setThemeFormData({
        id: "",
        name: "",
        primaryColor: "#3b82f6",
        secondaryColor: "#1e40af",
        accentColor: "#10b981",
        backgroundColor: "#0f172a",
        cardStyle: "elevated",
        borderRadius: "medium",
        fontSize: "large",
        animations: true,
        celebrationEnabled: false,
        celebrationEffect: "fireworks",
        celebrationDuration: 5,
        celebrationTriggerKpiId: null,
        celebrationTriggerCondition: "increase",
        celebrationTriggerValue: null,
        celebrationText: "",
        celebrationDataFields: [],
      });
    }
    setEditingTheme(null);
    setIsDesignDialogOpen(true);
  };

  const openEditThemeDialog = (theme: DashboardTheme) => {
    setThemeFormData({ ...theme });
    setEditingTheme(theme);
    setIsDesignDialogOpen(true);
  };

  const handleSaveTheme = () => {
    const newTheme = {
      ...themeFormData,
      id: editingTheme?.id || `theme-${Date.now()}`,
    };
    
    if (editingTheme) {
      setSavedThemes(prev => prev.map(t => t.id === editingTheme.id ? newTheme : t));
    } else {
      setSavedThemes(prev => [...prev, newTheme]);
    }
    
    setIsDesignDialogOpen(false);
    toast({
      title: editingTheme ? "Tema opdateret" : "Tema oprettet",
      description: `"${newTheme.name}" er blevet ${editingTheme ? "opdateret" : "gemt"}.`,
    });
  };

  const deleteTheme = (id: string) => {
    setSavedThemes(prev => prev.filter(t => t.id !== id));
    toast({
      title: "Tema slettet",
      description: "Temaet er blevet slettet.",
    });
  };

  const getCardStyleClasses = (theme: DashboardTheme) => {
    const styles: Record<string, string> = {
      flat: "",
      elevated: "shadow-lg",
      bordered: "border-2",
      glass: "backdrop-blur-md bg-opacity-80",
    };
    return styles[theme.cardStyle] || "";
  };

  const getBorderRadiusClass = (radius: string) => {
    const radiusMap: Record<string, string> = {
      none: "rounded-none",
      small: "rounded",
      medium: "rounded-lg",
      large: "rounded-2xl",
    };
    return radiusMap[radius] || "rounded-lg";
  };

  const getFontSizeClass = (size: string) => {
    const sizeMap: Record<string, string> = {
      small: "text-2xl",
      medium: "text-3xl",
      large: "text-4xl",
      xlarge: "text-5xl",
    };
    return sizeMap[size] || "text-4xl";
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
            <TabsTrigger value="design">Design</TabsTrigger>
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
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline">
                                {KPI_TYPES.find((t) => t.value === kpi.kpi_type)?.label}
                              </Badge>
                              {kpi.data_source === "base" && kpi.base_metric && (
                                <Badge variant="secondary">
                                  {BASE_METRICS.find((m) => m.value === kpi.base_metric)?.label}
                                </Badge>
                              )}
                              {kpi.data_source === "formula" && kpi.formula && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {kpi.formula}
                                </Badge>
                              )}
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

          <TabsContent value="design" className="mt-6 space-y-6">
            {/* Gemte temaer */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Mine temaer
                  </CardTitle>
                  <CardDescription>
                    Dine gemte dashboard-temaer
                  </CardDescription>
                </div>
                <Button onClick={() => openCreateThemeDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nyt tema
                </Button>
              </CardHeader>
              <CardContent>
                {savedThemes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Palette className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Ingen temaer oprettet endnu.</p>
                    <p className="text-sm">Vælg et preset nedenfor eller opret dit eget.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedThemes.map((theme) => (
                      <div
                        key={theme.id}
                        className="group relative overflow-hidden border rounded-xl transition-all hover:shadow-lg"
                      >
                        {/* Preview */}
                        <div
                          className="p-4 h-32"
                          style={{ backgroundColor: theme.backgroundColor }}
                        >
                          <div className="grid grid-cols-2 gap-2 h-full">
                            <div
                              className={`p-2 ${getBorderRadiusClass(theme.borderRadius)} ${getCardStyleClasses(theme)}`}
                              style={{
                                backgroundColor: theme.cardStyle === "glass" ? `${theme.primaryColor}40` : theme.primaryColor,
                                borderColor: theme.cardStyle === "bordered" ? theme.secondaryColor : "transparent",
                              }}
                            >
                              <div className={`${getFontSizeClass(theme.fontSize)} font-bold text-white`}>42</div>
                              <div className="text-xs text-white/70">Salg</div>
                            </div>
                            <div
                              className={`p-2 ${getBorderRadiusClass(theme.borderRadius)} ${getCardStyleClasses(theme)}`}
                              style={{
                                backgroundColor: theme.cardStyle === "glass" ? `${theme.accentColor}40` : theme.accentColor,
                                borderColor: theme.cardStyle === "bordered" ? theme.secondaryColor : "transparent",
                              }}
                            >
                              <div className={`${getFontSizeClass(theme.fontSize)} font-bold text-white`}>8.5</div>
                              <div className="text-xs text-white/70">Timer</div>
                            </div>
                          </div>
                        </div>
                        {/* Info */}
                        <div className="p-3 bg-card border-t flex items-center justify-between">
                          <div>
                            <p className="font-medium">{theme.name}</p>
                            <div className="flex gap-1 mt-1">
                              {[theme.primaryColor, theme.secondaryColor, theme.accentColor].map((c, i) => (
                                <div key={i} className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} />
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditThemeDialog(theme)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteTheme(theme.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preset temaer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Preset temaer
                </CardTitle>
                <CardDescription>
                  Hurtigstart med et færdigt tema - klik for at tilpasse og gemme
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {PRESET_THEMES.map((theme) => (
                    <div
                      key={theme.id}
                      className="group relative overflow-hidden border rounded-xl cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                      onClick={() => openCreateThemeDialog(theme)}
                    >
                      {/* Preview */}
                      <div
                        className="p-4 h-40 relative"
                        style={{ backgroundColor: theme.backgroundColor }}
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div
                            className={`p-3 ${getBorderRadiusClass(theme.borderRadius)} ${getCardStyleClasses(theme)} ${theme.animations ? "transition-transform group-hover:scale-105" : ""}`}
                            style={{
                              backgroundColor: theme.cardStyle === "glass" ? `${theme.primaryColor}40` : theme.primaryColor,
                              borderColor: theme.cardStyle === "bordered" ? theme.secondaryColor : "transparent",
                            }}
                          >
                            <div className={`${getFontSizeClass(theme.fontSize)} font-bold text-white`}>156</div>
                            <div className="text-xs text-white/70 mt-1">Antal salg</div>
                          </div>
                          <div
                            className={`p-3 ${getBorderRadiusClass(theme.borderRadius)} ${getCardStyleClasses(theme)} ${theme.animations ? "transition-transform group-hover:scale-105" : ""}`}
                            style={{
                              backgroundColor: theme.cardStyle === "glass" ? `${theme.accentColor}40` : theme.accentColor,
                              borderColor: theme.cardStyle === "bordered" ? theme.secondaryColor : "transparent",
                            }}
                          >
                            <div className={`${getFontSizeClass(theme.fontSize)} font-bold text-white`}>87%</div>
                            <div className="text-xs text-white/70 mt-1">Mål opnået</div>
                          </div>
                        </div>
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="secondary" size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Brug tema
                          </Button>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-3 bg-card border-t">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{theme.name}</p>
                          <div className="flex gap-1">
                            {[theme.primaryColor, theme.secondaryColor, theme.accentColor].map((c, i) => (
                              <div key={i} className="h-3 w-3 rounded-full border" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {CARD_STYLES.find(s => s.value === theme.cardStyle)?.label}
                          </Badge>
                          {theme.animations && (
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Animation
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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

                {/* Data Source Section */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <div className="grid gap-2">
                    <Label htmlFor="data_source">Datakilde</Label>
                    <Select
                      value={formData.data_source}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ 
                          ...prev, 
                          data_source: value,
                          formula: value !== "formula" ? "" : prev.formula,
                          base_metric: value !== "base" ? "" : prev.base_metric,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_SOURCE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.data_source === "base" && (
                    <div className="grid gap-2">
                      <Label htmlFor="base_metric">Basis-metrik</Label>
                      <Select
                        value={formData.base_metric}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, base_metric: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg metrik..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BASE_METRICS.map((metric) => (
                            <SelectItem key={metric.value} value={metric.value}>
                              <div>
                                <span>{metric.label}</span>
                                <span className="text-muted-foreground text-xs ml-2">
                                  ({metric.description})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.data_source === "formula" && (
                    <div className="grid gap-2">
                      <Label htmlFor="formula">Formel</Label>
                      <div className="space-y-2">
                        <Input
                          id="formula"
                          value={formData.formula}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, formula: e.target.value }))
                          }
                          placeholder="F.eks. antal_salg / timer"
                        />
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Tilgængelige variabler:</p>
                          <div className="flex flex-wrap gap-1">
                            {BASE_METRICS.map((metric) => (
                              <Badge 
                                key={metric.value} 
                                variant="outline" 
                                className="cursor-pointer hover:bg-accent"
                                onClick={() => {
                                  const currentFormula = formData.formula;
                                  const newFormula = currentFormula 
                                    ? `${currentFormula} ${metric.value}` 
                                    : metric.value;
                                  setFormData((prev) => ({ ...prev, formula: newFormula }));
                                }}
                              >
                                {metric.value}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2">Operatorer: + - * / ( )</p>
                          <p className="text-muted-foreground/70">
                            Eksempler: "antal_salg / timer", "(antal_salg / antal_medarbejdere) * 100"
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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

        {/* Design Theme Dialog */}
        <Dialog open={isDesignDialogOpen} onOpenChange={(open) => {
          // Don't close dialog if celebration overlay is showing
          if (!open && showCelebration) return;
          setIsDesignDialogOpen(open);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => {
            // Prevent closing when clicking on celebration overlay
            if (showCelebration) {
              e.preventDefault();
            }
          }}>
            <DialogHeader>
              <DialogTitle>
                {editingTheme ? "Rediger tema" : "Opret nyt tema"}
              </DialogTitle>
              <DialogDescription>
                Tilpas dit dashboard-tema og se en live preview.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Settings */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="theme_name">Tema navn *</Label>
                  <Input
                    id="theme_name"
                    value={themeFormData.name}
                    onChange={(e) =>
                      setThemeFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="F.eks. Mit custom tema"
                  />
                </div>

                {/* Colors */}
                <div className="border rounded-lg p-4 space-y-4">
                  <Label className="text-base font-semibold">Farver</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Primær farve</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={themeFormData.primaryColor}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                          }
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <Input
                          value={themeFormData.primaryColor}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Sekundær farve</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={themeFormData.secondaryColor}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))
                          }
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <Input
                          value={themeFormData.secondaryColor}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Accent farve</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={themeFormData.accentColor}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({ ...prev, accentColor: e.target.value }))
                          }
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <Input
                          value={themeFormData.accentColor}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({ ...prev, accentColor: e.target.value }))
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Baggrund</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={themeFormData.backgroundColor}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({ ...prev, backgroundColor: e.target.value }))
                          }
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <Input
                          value={themeFormData.backgroundColor}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({ ...prev, backgroundColor: e.target.value }))
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Style */}
                <div className="grid gap-2">
                  <Label>Kort stil</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {CARD_STYLES.map((style) => (
                      <div
                        key={style.value}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          themeFormData.cardStyle === style.value
                            ? "border-primary bg-primary/10"
                            : "hover:border-muted-foreground"
                        }`}
                        onClick={() =>
                          setThemeFormData((prev) => ({
                            ...prev,
                            cardStyle: style.value as DashboardTheme["cardStyle"],
                          }))
                        }
                      >
                        <p className="font-medium text-sm">{style.label}</p>
                        <p className="text-xs text-muted-foreground">{style.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Border Radius & Font Size */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hjørner</Label>
                    <Select
                      value={themeFormData.borderRadius}
                      onValueChange={(value) =>
                        setThemeFormData((prev) => ({
                          ...prev,
                          borderRadius: value as DashboardTheme["borderRadius"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BORDER_RADIUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label} ({opt.px})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tekststørrelse</Label>
                    <Select
                      value={themeFormData.fontSize}
                      onValueChange={(value) =>
                        setThemeFormData((prev) => ({
                          ...prev,
                          fontSize: value as DashboardTheme["fontSize"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_SIZE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label} ({opt.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Animations */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Animationer</p>
                    <p className="text-sm text-muted-foreground">Hover og fade effekter</p>
                  </div>
                  <Switch
                    checked={themeFormData.animations}
                    onCheckedChange={(checked) =>
                      setThemeFormData((prev) => ({ ...prev, animations: checked }))
                    }
                  />
                </div>

                {/* Celebration Popup Section */}
                <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PartyPopper className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="font-semibold">Fejrings-popup</p>
                        <p className="text-xs text-muted-foreground">Vis effekter når tal opdateres</p>
                      </div>
                    </div>
                    <Switch
                      checked={themeFormData.celebrationEnabled}
                      onCheckedChange={(checked) =>
                        setThemeFormData((prev) => ({ ...prev, celebrationEnabled: checked }))
                      }
                    />
                  </div>

                  {themeFormData.celebrationEnabled && (
                    <div className="space-y-4 pt-2 animate-fade-in">
                      {/* Effect Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm">Visuel effekt</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {CELEBRATION_EFFECTS.map((effect) => {
                            const IconComponent = effect.icon;
                            return (
                              <div
                                key={effect.value}
                                className={`p-3 border rounded-lg cursor-pointer transition-all text-center ${
                                  themeFormData.celebrationEffect === effect.value
                                    ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/50"
                                    : "hover:border-muted-foreground hover:bg-muted/50"
                                }`}
                                onClick={() =>
                                  setThemeFormData((prev) => ({
                                    ...prev,
                                    celebrationEffect: effect.value as DashboardTheme["celebrationEffect"],
                                  }))
                                }
                              >
                                <IconComponent className={`h-5 w-5 mx-auto mb-1 ${
                                  themeFormData.celebrationEffect === effect.value 
                                    ? "text-purple-500" 
                                    : "text-muted-foreground"
                                }`} />
                                <p className="text-xs font-medium">{effect.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* KPI Trigger Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Vælg udløsende KPI</Label>
                        <Select
                          value={themeFormData.celebrationTriggerKpiId || ""}
                          onValueChange={(value) =>
                            setThemeFormData((prev) => ({
                              ...prev,
                              celebrationTriggerKpiId: value || null,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vælg en KPI..." />
                          </SelectTrigger>
                          <SelectContent>
                            {kpis.filter(k => k.is_active).map((kpi) => (
                              <SelectItem key={kpi.id} value={kpi.id}>
                                <div className="flex items-center gap-2">
                                  <span>{kpi.name}</span>
                                  {kpi.unit && (
                                    <span className="text-muted-foreground text-xs">({kpi.unit})</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {kpis.filter(k => k.is_active).length === 0 && (
                          <p className="text-xs text-amber-500">
                            Opret først en aktiv KPI i KPI-fanen for at kunne vælge en trigger
                          </p>
                        )}
                      </div>

                      {/* Trigger Condition Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Betingelse for udløsning</Label>
                        <Select
                          value={themeFormData.celebrationTriggerCondition}
                          onValueChange={(value) =>
                            setThemeFormData((prev) => ({
                              ...prev,
                              celebrationTriggerCondition: value as DashboardTheme["celebrationTriggerCondition"],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CELEBRATION_TRIGGER_CONDITIONS.map((condition) => (
                              <SelectItem key={condition.value} value={condition.value}>
                                <div>
                                  <span>{condition.label}</span>
                                  <span className="text-muted-foreground text-xs ml-2">
                                    ({condition.description})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Custom threshold value for "exceeds_value" condition */}
                      {themeFormData.celebrationTriggerCondition === "exceeds_value" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Grænseværdi</Label>
                          <Input
                            type="number"
                            value={themeFormData.celebrationTriggerValue ?? ""}
                            onChange={(e) =>
                              setThemeFormData((prev) => ({
                                ...prev,
                                celebrationTriggerValue: e.target.value ? parseFloat(e.target.value) : null,
                              }))
                            }
                            placeholder="F.eks. 100"
                          />
                          <p className="text-xs text-muted-foreground">
                            Fejring vises når KPI'en overstiger denne værdi
                          </p>
                        </div>
                      )}

                      {/* Duration Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Varighed
                        </Label>
                        <div className="flex gap-2">
                          {DURATION_OPTIONS.map((duration) => (
                            <button
                              key={duration.value}
                              type="button"
                              className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-all ${
                                themeFormData.celebrationDuration === duration.value
                                  ? "border-purple-500 bg-purple-500/10 text-purple-600 font-medium"
                                  : "hover:border-muted-foreground hover:bg-muted/50"
                              }`}
                              onClick={() =>
                                setThemeFormData((prev) => ({
                                  ...prev,
                                  celebrationDuration: duration.value,
                                }))
                              }
                            >
                              {duration.value}s
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Celebration Text */}
                      <div className="space-y-2">
                        <Label className="text-sm">Fejringstekst</Label>
                        <Textarea
                          value={themeFormData.celebrationText}
                          onChange={(e) =>
                            setThemeFormData((prev) => ({
                              ...prev,
                              celebrationText: e.target.value,
                            }))
                          }
                          placeholder="F.eks. 🎉 {{medarbejder}} har lige lavet salg nummer {{salg_nummer}}!"
                          className="min-h-[60px] resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                          Brug data-felter herunder til at indsætte dynamiske værdier
                        </p>
                      </div>

                      {/* Data Fields Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm">Tilgængelige data-felter (fra udløsende medarbejder/hold)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {CELEBRATION_DATA_FIELDS.map((field) => (
                            <div
                              key={field.id}
                              className={`p-2 border rounded-lg cursor-pointer transition-all ${
                                themeFormData.celebrationDataFields.includes(field.id)
                                  ? "border-purple-500 bg-purple-500/10"
                                  : "hover:border-muted-foreground hover:bg-muted/50"
                              }`}
                              onClick={() => {
                                const newText = themeFormData.celebrationText
                                  ? `${themeFormData.celebrationText} ${field.placeholder}`
                                  : field.placeholder;
                                setThemeFormData((prev) => ({
                                  ...prev,
                                  celebrationText: newText,
                                  celebrationDataFields: prev.celebrationDataFields.includes(field.id)
                                    ? prev.celebrationDataFields
                                    : [...prev.celebrationDataFields, field.id],
                                }));
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">{field.label}</span>
                                <code className="text-[10px] text-purple-400 bg-purple-500/10 px-1 rounded">
                                  {field.placeholder}
                                </code>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{field.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
                        <p className="text-xs text-muted-foreground text-center mb-2">Preview af fejring</p>
                        <div className="flex flex-col items-center gap-3">
                          {(() => {
                            const effect = CELEBRATION_EFFECTS.find(e => e.value === themeFormData.celebrationEffect);
                            const selectedKpi = kpis.find(k => k.id === themeFormData.celebrationTriggerKpiId);
                            const selectedCondition = CELEBRATION_TRIGGER_CONDITIONS.find(c => c.value === themeFormData.celebrationTriggerCondition);
                            if (!effect) return null;
                            const IconComponent = effect.icon;
                            
                            // Replace placeholders with example data - use triggering employee/team context
                            const exampleText = themeFormData.celebrationText
                              .replace("{{medarbejder}}", "Anders Jensen")
                              .replace("{{salg_nummer}}", selectedKpi ? "42" : "#")
                              .replace("{{produkt}}", "Premium Abonnement")
                              .replace("{{hold}}", "Team Alpha")
                              .replace("{{værdi}}", selectedKpi?.target_value ? `${selectedKpi.target_value}` : "100")
                              .replace("{{mål}}", selectedKpi?.target_value ? `${selectedKpi.target_value} ${selectedKpi.unit || ""}`.trim() : "100");
                            
                            return (
                              <div className="w-full p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-center space-y-3">
                                {/* Trigger summary */}
                                <div className="flex items-center justify-center gap-2 text-xs bg-background/50 rounded-md py-1.5 px-3">
                                  <Target className="h-3.5 w-3.5 text-purple-400" />
                                  <span className="text-muted-foreground">
                                    {selectedKpi ? (
                                      <>
                                        <span className="text-purple-400 font-medium">{selectedKpi.name}</span>
                                        {" → "}
                                        <span className="text-foreground">{selectedCondition?.label}</span>
                                        {themeFormData.celebrationTriggerCondition === "exceeds_value" && themeFormData.celebrationTriggerValue && (
                                          <span className="text-purple-400 font-medium"> ({themeFormData.celebrationTriggerValue})</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-amber-500">Vælg en KPI ovenfor</span>
                                    )}
                                  </span>
                                </div>

                                <IconComponent className="h-8 w-8 mx-auto text-purple-500 animate-pulse" />
                                {themeFormData.celebrationText ? (
                                  <p className="text-sm font-medium">{exampleText}</p>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">Tilføj fejringstekst med data-felter ovenfor</p>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  className="mt-2 gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                                  onClick={() => setShowCelebration(true)}
                                >
                                  <Play className="h-4 w-4" />
                                  Test effekt
                                </Button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Preview - CPH Sales Dashboard Style */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Live preview</Label>
                  <Badge variant="outline" className="text-xs">CPH Sales Dashboard</Badge>
                </div>
                <div
                  className="p-4 rounded-xl min-h-[380px] space-y-4"
                  style={{ backgroundColor: themeFormData.backgroundColor }}
                >
                  {/* Header */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white/90">Dagsboard CPH Sales</h3>
                    <p className="text-xs text-white/50">Lørdag 21. december 2024</p>
                  </div>

                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Salg i dag */}
                    <div
                      className={`p-3 ${getBorderRadiusClass(themeFormData.borderRadius)} ${getCardStyleClasses(themeFormData)} ${
                        themeFormData.animations ? "transition-all hover:scale-105 cursor-pointer" : ""
                      }`}
                      style={{
                        backgroundColor:
                          themeFormData.cardStyle === "glass"
                            ? `${themeFormData.accentColor}25`
                            : `${themeFormData.accentColor}15`,
                        borderColor:
                          themeFormData.cardStyle === "bordered"
                            ? `${themeFormData.accentColor}40`
                            : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/60">Salg i dag</span>
                        <TrendingUp className="h-4 w-4" style={{ color: themeFormData.accentColor }} />
                      </div>
                      <div className={`${getFontSizeClass(themeFormData.fontSize)} font-bold`} style={{ color: themeFormData.accentColor }}>
                        24
                      </div>
                      <div className="flex gap-1 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${themeFormData.accentColor}30`, color: themeFormData.accentColor }}>
                          18 bekræftet
                        </span>
                      </div>
                    </div>

                    {/* Opkald i dag */}
                    <div
                      className={`p-3 ${getBorderRadiusClass(themeFormData.borderRadius)} ${getCardStyleClasses(themeFormData)} ${
                        themeFormData.animations ? "transition-all hover:scale-105 cursor-pointer" : ""
                      }`}
                      style={{
                        backgroundColor:
                          themeFormData.cardStyle === "glass"
                            ? `${themeFormData.primaryColor}25`
                            : `${themeFormData.primaryColor}15`,
                        borderColor:
                          themeFormData.cardStyle === "bordered"
                            ? `${themeFormData.primaryColor}40`
                            : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/60">Opkald i dag</span>
                        <Phone className="h-4 w-4" style={{ color: themeFormData.primaryColor }} />
                      </div>
                      <div className={`${getFontSizeClass(themeFormData.fontSize)} font-bold`} style={{ color: themeFormData.primaryColor }}>
                        847
                      </div>
                      <p className="text-[10px] text-white/40 mt-1">Registrerede opkald</p>
                    </div>

                    {/* Aktive medarbejdere */}
                    <div
                      className={`p-3 ${getBorderRadiusClass(themeFormData.borderRadius)} ${getCardStyleClasses(themeFormData)} ${
                        themeFormData.animations ? "transition-all hover:scale-105 cursor-pointer" : ""
                      }`}
                      style={{
                        backgroundColor:
                          themeFormData.cardStyle === "glass"
                            ? `${themeFormData.secondaryColor}25`
                            : `${themeFormData.secondaryColor}15`,
                        borderColor:
                          themeFormData.cardStyle === "bordered"
                            ? `${themeFormData.secondaryColor}40`
                            : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/60">Aktive medarbejdere</span>
                        <Users className="h-4 w-4" style={{ color: themeFormData.secondaryColor }} />
                      </div>
                      <div className={`${getFontSizeClass(themeFormData.fontSize)} font-bold`} style={{ color: themeFormData.secondaryColor }}>
                        42
                      </div>
                      <p className="text-[10px] text-white/40 mt-1">Sælgere</p>
                    </div>

                    {/* Stabsmedarbejdere */}
                    <div
                      className={`p-3 ${getBorderRadiusClass(themeFormData.borderRadius)} ${getCardStyleClasses(themeFormData)} ${
                        themeFormData.animations ? "transition-all hover:scale-105 cursor-pointer" : ""
                      }`}
                      style={{
                        backgroundColor: themeFormData.cardStyle === "glass" ? "#f97316" + "25" : "#f97316" + "15",
                        borderColor: themeFormData.cardStyle === "bordered" ? "#f97316" + "40" : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/60">Stabsmedarbejdere</span>
                        <Award className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className={`${getFontSizeClass(themeFormData.fontSize)} font-bold text-orange-500`}>
                        8
                      </div>
                      <p className="text-[10px] text-white/40 mt-1">Aktive stabsmedarbejdere</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="text-center pt-2">
                    <p className="text-[10px] text-white/30">CPH Sales Dashboard • 14:32</p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDesignDialogOpen(false)}>
                Annuller
              </Button>
              <Button onClick={handleSaveTheme} disabled={!themeFormData.name}>
                {editingTheme ? "Opdater tema" : "Gem tema"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Celebration Overlay - rendered outside dialog to avoid closing it */}
        {showCelebration && (
          <CelebrationOverlay
            isOpen={showCelebration}
            onClose={() => setShowCelebration(false)}
            effect={themeFormData.celebrationEffect}
            duration={themeFormData.celebrationDuration}
            text={themeFormData.celebrationText
              .replace("{{medarbejder}}", "Anders Jensen")
              .replace("{{salg_nummer}}", "42")
              .replace("{{produkt}}", "Premium Abonnement")
              .replace("{{hold}}", "Team Alpha")
              .replace("{{værdi}}", "1.250 kr")
              .replace("{{mål}}", "100 salg")}
            primaryColor={themeFormData.primaryColor}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default DashboardSettings;
