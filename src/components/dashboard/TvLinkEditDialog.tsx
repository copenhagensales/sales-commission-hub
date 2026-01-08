import { useState, useEffect } from "react";
import { PartyPopper, Sparkles, Star, Heart, Flame, Zap, Play, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

interface TvBoardAccess {
  id: string;
  name: string | null;
  access_code: string;
  dashboard_slugs?: string[] | null;
  celebration_enabled?: boolean | null;
  celebration_effect?: string | null;
  celebration_duration?: number | null;
  celebration_trigger_condition?: string | null;
  celebration_text?: string | null;
  celebration_metric?: string | null;
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

// Available metrics based on dashboard type
const CELEBRATION_METRICS = [
  { value: "sales_today", label: "Salg i dag", dashboards: ["all"] },
  { value: "sales_month", label: "Salg denne måned", dashboards: ["all"] },
  { value: "sales_week", label: "Salg denne uge", dashboards: ["all"] },
  { value: "total_sales", label: "Samlet antal salg", dashboards: ["all"] },
  { value: "goal_progress", label: "Mål-fremskridt (%)", dashboards: ["tdc-erhverv-goals", "fieldmarketing-goals"] },
];

export function TvLinkEditDialog({ open, onOpenChange, tvLink }: TvLinkEditDialogProps) {
  const queryClient = useQueryClient();
  const [celebrationEnabled, setCelebrationEnabled] = useState(false);
  const [celebrationEffect, setCelebrationEffect] = useState("fireworks");
  const [celebrationDuration, setCelebrationDuration] = useState(3);
  const [celebrationTriggerCondition, setCelebrationTriggerCondition] = useState("any_update");
  const [celebrationText, setCelebrationText] = useState("");
  const [celebrationMetric, setCelebrationMetric] = useState("sales_today");
  const [showTestCelebration, setShowTestCelebration] = useState(false);

  // Get available metrics based on selected dashboards
  const availableMetrics = CELEBRATION_METRICS.filter(m => 
    m.dashboards.includes("all") || 
    m.dashboards.some(d => tvLink?.dashboard_slugs?.includes(d))
  );

  // Load values from tvLink when it changes
  useEffect(() => {
    if (tvLink) {
      setCelebrationEnabled(tvLink.celebration_enabled ?? false);
      setCelebrationEffect(tvLink.celebration_effect ?? "fireworks");
      setCelebrationDuration(tvLink.celebration_duration ?? 3);
      setCelebrationTriggerCondition(tvLink.celebration_trigger_condition ?? "any_update");
      setCelebrationText(tvLink.celebration_text ?? "");
      setCelebrationMetric(tvLink.celebration_metric ?? "sales_today");
    }
  }, [tvLink]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!tvLink) return;
      const { error } = await supabase
        .from("tv_board_access")
        .update({
          celebration_enabled: celebrationEnabled,
          celebration_effect: celebrationEffect,
          celebration_duration: celebrationDuration,
          celebration_trigger_condition: celebrationTriggerCondition,
          celebration_text: celebrationText || null,
          celebration_metric: celebrationMetric,
        })
        .eq("id", tvLink.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-board-access-all"] });
      toast.success("Fejringsindstillinger gemt");
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rediger fejringsindstillinger</DialogTitle>
            <DialogDescription>
              {tvLink.name || tvLink.access_code}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                      placeholder="F.eks. 🎉 Nyt salg!"
                      rows={2}
                      className="bg-background/80 backdrop-blur-sm resize-none"
                    />
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
        text={celebrationText || "🎉 Test fejring!"}
      />
    </>
  );
}
