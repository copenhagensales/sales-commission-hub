import { useState } from "react";
import { Monitor, Copy, Trash2, Plus, Loader2, ExternalLink, CalendarIcon, PartyPopper, Sparkles, Star, Heart, Flame, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DASHBOARD_LIST } from "@/config/dashboards";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TvBoardAccess {
  id: string;
  dashboard_slug: string;
  dashboard_slugs: string[] | null;
  access_code: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
  expires_at?: string | null;
  auto_rotate?: boolean | null;
  rotate_interval_seconds?: number | null;
  rotate_intervals_per_dashboard?: Record<string, number> | null;
  celebration_enabled?: boolean | null;
  celebration_effect?: string | null;
  celebration_duration?: number | null;
  celebration_trigger_condition?: string | null;
  celebration_trigger_value?: number | null;
  celebration_text?: string | null;
}

interface DashboardRotateTime {
  minutes: number;
  seconds: number;
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

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function TvLinksSettingsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCodeName, setNewCodeName] = useState("");
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>([]);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateTimes, setRotateTimes] = useState<Record<string, DashboardRotateTime>>({});
  // Celebration settings
  const [celebrationEnabled, setCelebrationEnabled] = useState(false);
  const [celebrationEffect, setCelebrationEffect] = useState("fireworks");
  const [celebrationDuration, setCelebrationDuration] = useState(3);
  const [celebrationTriggerCondition, setCelebrationTriggerCondition] = useState("any_update");
  const [celebrationText, setCelebrationText] = useState("");
  const queryClient = useQueryClient();

  const { data: accessCodes = [], isLoading } = useQuery({
    queryKey: ["tv-board-access-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_board_access")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TvBoardAccess[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ 
      name, 
      dashboardSlugs, 
      expiresAt,
      autoRotate,
      rotateIntervalSeconds,
      rotateIntervalsPerDashboard,
      celebrationEnabled,
      celebrationEffect,
      celebrationDuration,
      celebrationTriggerCondition,
      celebrationText,
    }: {
      name: string; 
      dashboardSlugs: string[]; 
      expiresAt: string | null;
      autoRotate: boolean;
      rotateIntervalSeconds: number | null;
      rotateIntervalsPerDashboard: Record<string, number> | null;
      celebrationEnabled: boolean;
      celebrationEffect: string;
      celebrationDuration: number;
      celebrationTriggerCondition: string;
      celebrationText: string;
    }) => {
      const code = generateCode();
      const { error } = await supabase.from("tv_board_access").insert({
        access_code: code,
        dashboard_slug: dashboardSlugs[0],
        dashboard_slugs: dashboardSlugs,
        name: name || null,
        is_active: true,
        expires_at: expiresAt,
        auto_rotate: autoRotate,
        rotate_interval_seconds: rotateIntervalSeconds,
        rotate_intervals_per_dashboard: rotateIntervalsPerDashboard,
        celebration_enabled: celebrationEnabled,
        celebration_effect: celebrationEffect,
        celebration_duration: celebrationDuration,
        celebration_trigger_condition: celebrationTriggerCondition,
        celebration_text: celebrationText || null,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access-all"] });
      resetForm();
      setDialogOpen(false);
      toast.success(`Adgangskode oprettet: ${code}`);
    },
    onError: () => {
      toast.error("Kunne ikke oprette adgangskode");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tv_board_access")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access-all"] });
      toast.success("Adgangskode deaktiveret");
    },
    onError: () => {
      toast.error("Kunne ikke deaktivere adgangskode");
    },
  });

  const resetForm = () => {
    setNewCodeName("");
    setSelectedDashboards([]);
    setHasExpiry(false);
    setExpiryDate(undefined);
    setAutoRotate(false);
    setRotateTimes({});
    setCelebrationEnabled(false);
    setCelebrationEffect("fireworks");
    setCelebrationDuration(3);
    setCelebrationTriggerCondition("any_update");
    setCelebrationText("");
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopieret`);
  };

  const getTvUrl = (code: string) => `${window.location.origin}/t/${code}`;

  const getDashboardName = (slug: string) => {
    return DASHBOARD_LIST.find((d) => d.slug === slug)?.name || slug;
  };

  const getDashboardSlugs = (code: TvBoardAccess): string[] => {
    return code.dashboard_slugs?.length ? code.dashboard_slugs : [code.dashboard_slug];
  };

  const toggleDashboard = (slug: string) => {
    setSelectedDashboards((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleCreate = () => {
    if (selectedDashboards.length === 0) {
      toast.error("Vælg mindst ét dashboard");
      return;
    }
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
    createMutation.mutate({ 
      name: newCodeName, 
      dashboardSlugs: selectedDashboards,
      expiresAt: hasExpiry && expiryDate ? expiryDate.toISOString() : null,
      autoRotate: autoRotate && selectedDashboards.length > 1,
      rotateIntervalSeconds: totalSeconds ? Math.round(totalSeconds) : null,
      rotateIntervalsPerDashboard: autoRotate && selectedDashboards.length > 1 ? rotateIntervalsPerDashboard : null,
      celebrationEnabled,
      celebrationEffect,
      celebrationDuration,
      celebrationTriggerCondition,
      celebrationText,
    });
  };

  const formatRotateInterval = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0 && secs > 0) return `${mins} min ${secs} sek`;
    if (mins > 0) return `${mins} min`;
    return `${secs} sek`;
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          TV Links
        </CardTitle>
        <CardDescription>
          Opret og administrer TV-adgangskoder til dine dashboards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Opret nyt TV-link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Opret nyt TV-link</DialogTitle>
              <DialogDescription>
                Vælg dashboards og indstillinger for dit nye TV-link
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {/* Name input */}
              <div className="space-y-2">
                <Label htmlFor="link-name">Navn (valgfrit)</Label>
                <Input
                  id="link-name"
                  placeholder="F.eks. Kontor TV"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value)}
                />
              </div>

              {/* Dashboard selection */}
              <div className="space-y-2">
                <Label>Vælg dashboards</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border rounded-md bg-muted/30">
                  {DASHBOARD_LIST.map((dashboard) => (
                    <div key={dashboard.slug} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dialog-dashboard-${dashboard.slug}`}
                        checked={selectedDashboards.includes(dashboard.slug)}
                        onCheckedChange={() => toggleDashboard(dashboard.slug)}
                      />
                      <Label
                        htmlFor={`dialog-dashboard-${dashboard.slug}`}
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
                    <Label htmlFor="auto-rotate">Automatisk skift mellem boards</Label>
                    <Switch
                      id="auto-rotate"
                      checked={autoRotate}
                      onCheckedChange={setAutoRotate}
                    />
                  </div>
                  {autoRotate && (
                    <div className="space-y-3">
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
                                className="w-16 h-8 text-center"
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
                                className="w-16 h-8 text-center"
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

              {/* Expiry date */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="has-expiry">Udløbsdato</Label>
                  <Switch
                    id="has-expiry"
                    checked={hasExpiry}
                    onCheckedChange={setHasExpiry}
                  />
                </div>
                {hasExpiry && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !expiryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expiryDate ? format(expiryDate, "d. MMMM yyyy", { locale: da }) : "Vælg udløbsdato"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expiryDate}
                        onSelect={setExpiryDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="pointer-events-auto"
                        locale={da}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Celebration Popup Section */}
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
                        {CELEBRATION_EFFECTS.map((effect, index) => {
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
                                  : "hover:border-purple-400 hover:bg-purple-500/5 hover:scale-102"
                              )}
                              onClick={() => setCelebrationEffect(effect.value)}
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div className={cn(
                                "absolute inset-0 rounded-xl transition-opacity duration-300",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}>
                                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
                              </div>
                              <IconComponent className={cn(
                                "h-5 w-5 mx-auto mb-1.5 transition-all duration-300 relative z-10",
                                isSelected 
                                  ? "text-white drop-shadow-lg" 
                                  : "text-muted-foreground group-hover:text-purple-500 group-hover:scale-110"
                              )} />
                              <p className={cn(
                                "text-xs font-medium relative z-10 transition-colors",
                                isSelected ? "text-white" : ""
                              )}>{effect.label}</p>
                            </div>
                          );
                        })}
                      </div>
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
                        placeholder="F.eks. 🎉 Nyt salg!"
                        rows={2}
                        className="bg-background/80 backdrop-blur-sm resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuller
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || selectedDashboards.length === 0}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Opret
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Existing codes */}
        <div>
          <p className="text-sm font-medium mb-3">Aktive adgangskoder:</p>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accessCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen aktive TV-links. Opret et nyt ovenfor.
            </div>
          ) : (
            <div className="space-y-2">
              {accessCodes.map((code) => {
                const slugs = getDashboardSlugs(code);
                const expired = isExpired(code.expires_at);
                return (
                  <div
                    key={code.id}
                    className={cn(
                      "flex items-start justify-between gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                      expired && "opacity-60"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium truncate">
                          {code.name || "Unavngivet"}
                        </span>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {code.access_code}
                        </span>
                        {expired && (
                          <Badge variant="destructive" className="text-xs">
                            Udløbet
                          </Badge>
                        )}
                        {code.expires_at && !expired && (
                          <Badge variant="outline" className="text-xs">
                            Udløber {format(new Date(code.expires_at), "d. MMM yyyy", { locale: da })}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {slugs.map((slug) => (
                          <Badge key={slug} variant="secondary" className="text-xs">
                            {getDashboardName(slug)}
                          </Badge>
                        ))}
                        {code.auto_rotate && code.rotate_interval_seconds && (
                          <Badge variant="outline" className="text-xs">
                            Skifter hver {formatRotateInterval(code.rotate_interval_seconds)}
                          </Badge>
                        )}
                        {code.celebration_enabled && (
                          <Badge className="text-xs bg-purple-500/20 text-purple-600 border-purple-500/30">
                            <PartyPopper className="h-3 w-3 mr-1" />
                            Fejring
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(getTvUrl(code.access_code), "Link")}
                        title="Kopier link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(getTvUrl(code.access_code), "_blank")}
                        title="Åbn i nyt vindue"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(code.id)}
                        disabled={deleteMutation.isPending}
                        title="Deaktiver"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 border rounded-lg bg-muted/30">
          <p className="text-sm font-medium mb-2">Sådan bruges TV Links:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Vælg ét eller flere dashboards til ét TV-link</li>
            <li>Kopier linket og åbn det på din TV-skærm</li>
            <li>Linket kræver ingen login og opdateres automatisk</li>
            <li>Brug udløbsdato til midlertidige links</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
