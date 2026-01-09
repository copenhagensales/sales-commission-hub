import { useState, useEffect } from "react";
import { PartyPopper, Sparkles, Star, Heart, Flame, Zap, Play, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DASHBOARD_LIST } from "@/config/dashboards";
import { replaceCelebrationVariables, CelebrationTriggerData } from "@/hooks/useCelebrationData";

// Demo data for test preview
const DEMO_CELEBRATION_DATA: CelebrationTriggerData = {
  employeeName: "Martin Jensen",
  salesCount: 5,
  commission: 2500,
  metricValue: 5,
  salesToday: 5,
  salesMonth: 42,
  salesWeek: 12,
  totalSales: 42,
  commissionToday: 2500,
  commissionMonth: 21000,
  goalProgress: 78,
  goalTarget: 30000,
  goalRemaining: 9000,
};

interface TvBoardAccess {
  id: string;
  name: string | null;
  access_code: string;
  dashboard_slug: string;
  dashboard_slugs?: string[] | null;
  auto_rotate?: boolean | null;
  rotate_interval_seconds?: number | null;
  rotate_intervals_per_dashboard?: Record<string, number> | null;
  celebration_enabled?: boolean | null;
  celebration_effect?: string | null;
  celebration_duration?: number | null;
  celebration_trigger_condition?: string | null;
  celebration_text?: string | null;
  celebration_metric?: string | null;
  celebration_source_dashboard?: string | null;
}

interface DashboardRotateTime {
  minutes: number;
  seconds: number;
}

interface TvLinkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tvLink: TvBoardAccess | null;
}

const CELEBRATION_EFFECTS = [
  { value: "fireworks", label: "Fyrværkeri", icon: PartyPopper },
  { value: "confetti", label: "Konfetti", icon: Sparkles },
  { value: "stars", label: "Stjerner", icon: Star },
  { value: "hearts", label: "Hjerter", icon: Heart },
  { value: "flames", label: "Flammer", icon: Flame },
  { value: "sparkles", label: "Gnister", icon: Zap },
];

const CELEBRATION_TRIGGER_CONDITIONS = [
  { value: "any_update", label: "Ved enhver opdatering" },
  { value: "increase", label: "Ved stigning" },
  { value: "reaches_goal", label: "Når mål nås" },
];

const DURATION_OPTIONS = [
  { value: 2, label: "2 sek" },
  { value: 3, label: "3 sek" },
  { value: 5, label: "5 sek" },
  { value: 8, label: "8 sek" },
];

// Available metrics based on dashboard type - used for both trigger and text variables
const CELEBRATION_METRICS = [
  { value: "sales_today", label: "Salg i dag", dashboards: ["all"] },
  { value: "sales_month", label: "Salg denne måned", dashboards: ["all"] },
  { value: "sales_week", label: "Salg denne uge", dashboards: ["all"] },
  { value: "total_sales", label: "Samlet antal salg", dashboards: ["all"] },
  { value: "commission_today", label: "Provision i dag", dashboards: ["all"] },
  { value: "commission_month", label: "Provision denne måned", dashboards: ["all"] },
  { value: "goal_progress", label: "Mål-fremskridt (%)", dashboards: ["tdc-erhverv-goals", "fieldmarketing-goals"] },
  { value: "goal_target", label: "Mål (DKK)", dashboards: ["tdc-erhverv-goals", "fieldmarketing-goals"] },
  { value: "goal_remaining", label: "Mangler (DKK)", dashboards: ["tdc-erhverv-goals", "fieldmarketing-goals"] },
];

export function TvLinkEditDialog({ open, onOpenChange, tvLink }: TvLinkEditDialogProps) {
  const queryClient = useQueryClient();
  
  // Dashboard selection state
  const [linkName, setLinkName] = useState("");
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>([]);
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateTimes, setRotateTimes] = useState<Record<string, DashboardRotateTime>>({});
  
  // Celebration settings
  const [celebrationEnabled, setCelebrationEnabled] = useState(false);
  const [celebrationEffect, setCelebrationEffect] = useState("fireworks");
  const [celebrationDuration, setCelebrationDuration] = useState(3);
  const [celebrationTriggerCondition, setCelebrationTriggerCondition] = useState("any_update");
  const [celebrationText, setCelebrationText] = useState("");
  const [celebrationMetric, setCelebrationMetric] = useState("sales_today");
  const [celebrationSourceDashboard, setCelebrationSourceDashboard] = useState("");
  const [showTestCelebration, setShowTestCelebration] = useState(false);

  const hasMultipleDashboards = selectedDashboards.length > 1;

  // Get available metrics based on selected dashboards
  const availableMetrics = CELEBRATION_METRICS.filter(m => 
    m.dashboards.includes("all") || 
    m.dashboards.some(d => selectedDashboards.includes(d))
  );

  const getDashboardName = (slug: string) => {
    return DASHBOARD_LIST.find((d) => d.slug === slug)?.name || slug;
  };

  const toggleDashboard = (slug: string) => {
    setSelectedDashboards((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const updateRotateTime = (slug: string, field: 'minutes' | 'seconds', value: number) => {
    setRotateTimes(prev => ({
      ...prev,
      [slug]: {
        minutes: prev[slug]?.minutes ?? 1,
        seconds: prev[slug]?.seconds ?? 0,
        [field]: value
      }
    }));
  };

  const getRotateTime = (slug: string): DashboardRotateTime => {
    return rotateTimes[slug] ?? { minutes: 1, seconds: 0 };
  };

  // Load values from tvLink when it changes
  useEffect(() => {
    if (tvLink) {
      setLinkName(tvLink.name || "");
      const slugs = tvLink.dashboard_slugs?.length ? tvLink.dashboard_slugs : [tvLink.dashboard_slug];
      setSelectedDashboards(slugs);
      setAutoRotate(tvLink.auto_rotate ?? false);
      
      // Load rotate times per dashboard
      if (tvLink.rotate_intervals_per_dashboard) {
        const times: Record<string, DashboardRotateTime> = {};
        Object.entries(tvLink.rotate_intervals_per_dashboard).forEach(([slug, seconds]) => {
          const secs = typeof seconds === 'number' ? seconds : 60;
          times[slug] = {
            minutes: Math.floor(secs / 60),
            seconds: secs % 60
          };
        });
        setRotateTimes(times);
      } else if (tvLink.rotate_interval_seconds) {
        // Fallback to equal distribution
        const perDashboard = tvLink.rotate_interval_seconds;
        const times: Record<string, DashboardRotateTime> = {};
        slugs.forEach(slug => {
          times[slug] = {
            minutes: Math.floor(perDashboard / 60),
            seconds: perDashboard % 60
          };
        });
        setRotateTimes(times);
      }
      
      setCelebrationEnabled(tvLink.celebration_enabled ?? false);
      setCelebrationEffect(tvLink.celebration_effect ?? "fireworks");
      setCelebrationDuration(tvLink.celebration_duration ?? 3);
      setCelebrationTriggerCondition(tvLink.celebration_trigger_condition ?? "any_update");
      setCelebrationText(tvLink.celebration_text ?? "");
      setCelebrationMetric(tvLink.celebration_metric ?? "sales_today");
      setCelebrationSourceDashboard(tvLink.celebration_source_dashboard ?? (slugs[0] || ""));
    }
  }, [tvLink]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!tvLink) return;
      
      // Build per-dashboard intervals
      const rotateIntervalsPerDashboard: Record<string, number> = {};
      if (autoRotate && selectedDashboards.length > 1) {
        selectedDashboards.forEach(slug => {
          const time = getRotateTime(slug);
          rotateIntervalsPerDashboard[slug] = time.minutes * 60 + time.seconds;
        });
      }
      
      // Calculate total for backwards compatibility
      const totalSeconds = autoRotate && selectedDashboards.length > 1
        ? Object.values(rotateIntervalsPerDashboard).reduce((a, b) => a + b, 0) / selectedDashboards.length
        : null;
      
      const { error } = await supabase
        .from("tv_board_access")
        .update({
          name: linkName || null,
          dashboard_slug: selectedDashboards[0],
          dashboard_slugs: selectedDashboards,
          auto_rotate: autoRotate && selectedDashboards.length > 1,
          rotate_interval_seconds: totalSeconds ? Math.round(totalSeconds) : null,
          rotate_intervals_per_dashboard: autoRotate && selectedDashboards.length > 1 ? rotateIntervalsPerDashboard : null,
          celebration_enabled: celebrationEnabled,
          celebration_effect: celebrationEffect,
          celebration_duration: celebrationDuration,
          celebration_trigger_condition: celebrationTriggerCondition,
          celebration_text: celebrationText || null,
          celebration_metric: celebrationMetric,
          celebration_source_dashboard: hasMultipleDashboards ? celebrationSourceDashboard || null : null,
        })
        .eq("id", tvLink.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access-all"] });
      toast.success("TV-link opdateret");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Kunne ikke gemme indstillinger");
    },
  });

  if (!tvLink) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Rediger TV-link</DialogTitle>
            <DialogDescription>
              {tvLink.name || tvLink.access_code}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {/* Name input */}
            <div className="space-y-2">
              <Label htmlFor="edit-link-name">Navn</Label>
              <Input
                id="edit-link-name"
                placeholder="F.eks. Kontor TV"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
              />
            </div>

            {/* Dashboard selection */}
            <div className="space-y-2">
              <Label>Dashboards</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border rounded-md bg-muted/30">
                {DASHBOARD_LIST.map((dashboard) => (
                  <div key={dashboard.slug} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-dashboard-${dashboard.slug}`}
                      checked={selectedDashboards.includes(dashboard.slug)}
                      onCheckedChange={() => toggleDashboard(dashboard.slug)}
                    />
                    <Label
                      htmlFor={`edit-dashboard-${dashboard.slug}`}
                      className="text-sm cursor-pointer truncate"
                      title={dashboard.name}
                    >
                      {dashboard.name}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedDashboards.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedDashboards.length} dashboard{selectedDashboards.length !== 1 ? "s" : ""} valgt
                </p>
              )}
            </div>

            {/* Auto rotate */}
            {selectedDashboards.length > 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-auto-rotate">Automatisk skift mellem boards</Label>
                  <Switch
                    id="edit-auto-rotate"
                    checked={autoRotate}
                    onCheckedChange={setAutoRotate}
                  />
                </div>
                {autoRotate && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Indstil tid for hvert board:</p>
                    {selectedDashboards.map((slug) => {
                      const time = getRotateTime(slug);
                      return (
                        <div key={slug} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                          <span className="text-sm font-medium flex-1 truncate">{getDashboardName(slug)}</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={60}
                              value={time.minutes}
                              onChange={(e) => updateRotateTime(slug, 'minutes', Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-14 h-8 text-center"
                            />
                            <span className="text-xs text-muted-foreground">min</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={59}
                              value={time.seconds}
                              onChange={(e) => updateRotateTime(slug, 'seconds', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                              className="w-14 h-8 text-center"
                            />
                            <span className="text-xs text-muted-foreground">sek</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Celebration Section */}
            <div className={cn(
              "relative overflow-hidden border rounded-xl p-4 space-y-4 transition-all duration-500",
              celebrationEnabled 
                ? "bg-gradient-to-br from-purple-600/15 via-pink-500/10 to-amber-500/10 border-purple-500/40 shadow-lg shadow-purple-500/10" 
                : "bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-border"
            )}>
              {/* Animated background glow when enabled */}
              {celebrationEnabled && (
                <div className="absolute inset-0 -z-10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg transition-all duration-300",
                    celebrationEnabled 
                      ? "bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30" 
                      : "bg-muted"
                  )}>
                    <PartyPopper className={cn(
                      "h-5 w-5 transition-all duration-300",
                      celebrationEnabled ? "text-white animate-bounce" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      "font-semibold text-sm transition-colors",
                      celebrationEnabled && "text-purple-600 dark:text-purple-400"
                    )}>Fejrings-popup</p>
                    <p className="text-xs text-muted-foreground">Vis effekter når tal opdateres</p>
                  </div>
                </div>
                <Switch
                  checked={celebrationEnabled}
                  onCheckedChange={setCelebrationEnabled}
                />
              </div>

              {celebrationEnabled && (
                <div className="space-y-4 pt-2 animate-fade-in">
                  {/* Effect Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Visuel effekt</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {CELEBRATION_EFFECTS.map((effect) => {
                        const IconComponent = effect.icon;
                        const isSelected = celebrationEffect === effect.value;
                        const colorClass = {
                          fireworks: "from-orange-500 to-red-500",
                          confetti: "from-blue-500 to-purple-500",
                          stars: "from-yellow-400 to-amber-500",
                          hearts: "from-pink-500 to-rose-500",
                          flames: "from-orange-600 to-red-600",
                          sparkles: "from-cyan-400 to-blue-500"
                        }[effect.value] || "from-purple-500 to-pink-500";
                        
                        return (
                          <div
                            key={effect.value}
                            className={cn(
                              "relative p-3 border rounded-xl cursor-pointer transition-all duration-300 text-center group",
                              isSelected
                                ? `bg-gradient-to-br ${colorClass} border-transparent shadow-lg scale-105`
                                : "hover:border-purple-400 hover:bg-purple-500/5"
                            )}
                            onClick={() => setCelebrationEffect(effect.value)}
                          >
                            <IconComponent className={cn(
                              "h-5 w-5 mx-auto mb-1.5 transition-all duration-300",
                              isSelected 
                                ? "text-white drop-shadow-lg" 
                                : "text-muted-foreground group-hover:text-purple-500"
                            )} />
                            <p className={cn(
                              "text-xs font-medium transition-colors",
                              isSelected ? "text-white" : ""
                            )}>{effect.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dashboard Source Selection (when multiple dashboards) */}
                  {hasMultipleDashboards && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Hent data fra dette dashboard</Label>
                      <Select
                        value={celebrationSourceDashboard}
                        onValueChange={setCelebrationSourceDashboard}
                      >
                        <SelectTrigger className="bg-background/80 backdrop-blur-sm">
                          <SelectValue placeholder="Vælg dashboard" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedDashboards.map((slug) => (
                            <SelectItem key={slug} value={slug}>
                              {getDashboardName(slug)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Vælg hvilket dashboard der udløser fejringen og leverer tal til teksten
                      </p>
                    </div>
                  )}

                  {/* Metric Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Reagér på dette tal</Label>
                    <Select
                      value={celebrationMetric}
                      onValueChange={setCelebrationMetric}
                    >
                      <SelectTrigger className="bg-background/80 backdrop-blur-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMetrics.map((metric) => (
                          <SelectItem key={metric.value} value={metric.value}>
                            {metric.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Trigger Condition */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Betingelse</Label>
                    <Select
                      value={celebrationTriggerCondition}
                      onValueChange={setCelebrationTriggerCondition}
                    >
                      <SelectTrigger className="bg-background/80 backdrop-blur-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CELEBRATION_TRIGGER_CONDITIONS.map((condition) => (
                          <SelectItem key={condition.value} value={condition.value}>
                            {condition.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Varighed</Label>
                    <div className="flex gap-2">
                      {DURATION_OPTIONS.map((duration) => (
                        <button
                          key={duration.value}
                          type="button"
                          className={cn(
                            "flex-1 px-3 py-2.5 text-xs font-medium border rounded-lg transition-all duration-200",
                            celebrationDuration === duration.value
                              ? "bg-gradient-to-r from-purple-500 to-pink-500 border-transparent text-white shadow-lg shadow-purple-500/25"
                              : "bg-background/80 hover:bg-purple-500/10 hover:border-purple-400"
                          )}
                          onClick={() => setCelebrationDuration(duration.value)}
                        >
                          {duration.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Celebration Text */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Fejringstekst (valgfrit)</Label>
                    <Textarea
                      value={celebrationText}
                      onChange={(e) => setCelebrationText(e.target.value)}
                      placeholder="F.eks. 🎉 {employee_name} har lavet salg!"
                      rows={2}
                      className="bg-background/80 backdrop-blur-sm resize-none"
                    />
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">Indsæt variable:</span>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {[
                          { var: "{employee_name}", label: "Navn" },
                          { var: "{sales_count}", label: "Antal salg" },
                          { var: "{commission}", label: "Provision" },
                        ].map((v) => (
                          <Button
                            key={v.var}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/40"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCelebrationText((prev) => prev + v.var);
                            }}
                          >
                            {v.label}
                          </Button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-xs text-muted-foreground">Medarbejder-tal:</span>
                        {availableMetrics.map((metric) => (
                          <Button
                            key={metric.value}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/40"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCelebrationText((prev) => prev + `{${metric.value}}`);
                            }}
                          >
                            {metric.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Test Button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-400/50 hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-400"
                    onClick={() => setShowTestCelebration(true)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Test effekt
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Gem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Celebration Test Overlay */}
      <CelebrationOverlay
        isOpen={showTestCelebration}
        onClose={() => setShowTestCelebration(false)}
        effect={celebrationEffect as "fireworks" | "confetti" | "stars" | "hearts" | "flames" | "sparkles"}
        duration={celebrationDuration}
        text={replaceCelebrationVariables(celebrationText || "🎉 Test fejring!", DEMO_CELEBRATION_DATA)}
      />
    </>
  );
}
