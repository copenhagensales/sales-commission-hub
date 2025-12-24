import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OnboardingDay, OnboardingVideo } from "@/hooks/useOnboarding";
import { useQueryClient } from "@tanstack/react-query";

interface EditDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: OnboardingDay | null;
}

export function EditDayDialog({ open, onOpenChange, day }: EditDayDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [focusTitle, setFocusTitle] = useState("");
  const [focusDescription, setFocusDescription] = useState("");
  const [callMission, setCallMission] = useState("");
  const [drillTitle, setDrillTitle] = useState("");
  const [drillDuration, setDrillDuration] = useState<number>(10);
  const [videos, setVideos] = useState<OnboardingVideo[]>([]);
  const [checkoutBlockers, setCheckoutBlockers] = useState<string[]>([]);
  const [newBlocker, setNewBlocker] = useState("");
  const [dailyMessage, setDailyMessage] = useState("");

  // Initialize form when day changes
  useEffect(() => {
    if (day) {
      setFocusTitle(day.focus_title || "");
      setFocusDescription(day.focus_description || "");
      setCallMission(day.call_mission || "");
      setDrillTitle(day.drill_title || "");
      setDrillDuration(day.drill_duration_min || 10);
      setVideos(day.videos || []);
      setCheckoutBlockers(day.checkout_blockers || []);
      setDailyMessage((day as any).daily_message || "");
    }
  }, [day]);

  const handleAddVideo = () => {
    setVideos([...videos, { title: "", duration_min: 5 }]);
  };

  const handleRemoveVideo = (index: number) => {
    setVideos(videos.filter((_, i) => i !== index));
  };

  const handleVideoChange = (index: number, field: keyof OnboardingVideo, value: string | number) => {
    const updated = [...videos];
    if (field === "duration_min") {
      updated[index] = { ...updated[index], [field]: Number(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setVideos(updated);
  };

  const handleAddBlocker = () => {
    if (newBlocker.trim() && !checkoutBlockers.includes(newBlocker.trim())) {
      setCheckoutBlockers([...checkoutBlockers, newBlocker.trim()]);
      setNewBlocker("");
    }
  };

  const handleRemoveBlocker = (blocker: string) => {
    setCheckoutBlockers(checkoutBlockers.filter(b => b !== blocker));
  };

  const handleSave = async () => {
    if (!day) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_days")
        .update({
          focus_title: focusTitle,
          focus_description: focusDescription || null,
          call_mission: callMission || null,
          drill_title: drillTitle || null,
          drill_duration_min: drillDuration || null,
          videos: videos as any,
          checkout_blockers: checkoutBlockers,
          daily_message: dailyMessage || null,
        })
        .eq("id", day.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["onboarding-days"] });
      toast.success("Dag opdateret!");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kunne ikke gemme: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!day) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rediger Uge {day.week}, Dag {day.day}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Grundlæggende info</h3>
            
            <div className="space-y-2">
              <Label htmlFor="focus-title">Fokus titel *</Label>
              <Input
                id="focus-title"
                value={focusTitle}
                onChange={(e) => setFocusTitle(e.target.value)}
                placeholder="F.eks. 'Kom i gang (træningsopkald)'"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="focus-description">Fokus beskrivelse</Label>
              <Textarea
                id="focus-description"
                value={focusDescription}
                onChange={(e) => setFocusDescription(e.target.value)}
                placeholder="Kort beskrivelse af dagens fokus"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily-message">Dagens besked (vises til medarbejderen)</Label>
              <Textarea
                id="daily-message"
                value={dailyMessage}
                onChange={(e) => setDailyMessage(e.target.value)}
                placeholder="F.eks. 'I dag er en god dag, hvis du ringer og får hul igennem...'"
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Videos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-muted-foreground">Videoer</h3>
              <Button variant="outline" size="sm" onClick={handleAddVideo}>
                <Plus className="h-4 w-4 mr-1" />
                Tilføj video
              </Button>
            </div>
            
            {videos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen videoer tilføjet endnu</p>
            ) : (
              <div className="space-y-3">
                {videos.map((video, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={video.title}
                        onChange={(e) => handleVideoChange(idx, "title", e.target.value)}
                        placeholder="Video titel"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={video.duration_min}
                          onChange={(e) => handleVideoChange(idx, "duration_min", e.target.value)}
                          className="w-24"
                          min={1}
                        />
                        <span className="text-sm text-muted-foreground">min</span>
                        {video.video_url && (
                          <Badge variant="secondary" className="text-xs">Video tilknyttet</Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveVideo(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Drill */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Drill</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drill-title">Drill titel</Label>
                <Input
                  id="drill-title"
                  value={drillTitle}
                  onChange={(e) => setDrillTitle(e.target.value)}
                  placeholder="F.eks. 'Åbning → første behovsspørgsmål'"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drill-duration">Varighed (min)</Label>
                <Input
                  id="drill-duration"
                  type="number"
                  value={drillDuration}
                  onChange={(e) => setDrillDuration(Number(e.target.value))}
                  min={1}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Call Mission */}
          <div className="space-y-2">
            <Label htmlFor="call-mission">Opkaldsmission</Label>
            <Textarea
              id="call-mission"
              value={callMission}
              onChange={(e) => setCallMission(e.target.value)}
              placeholder="Dagens mission for opkald..."
              rows={2}
            />
          </div>

          <Separator />

          {/* Checkout Blockers */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Checkout blokkere</h3>
            
            <div className="flex flex-wrap gap-2">
              {checkoutBlockers.map(blocker => (
                <Badge key={blocker} variant="secondary" className="gap-1">
                  {blocker}
                  <button onClick={() => handleRemoveBlocker(blocker)} className="ml-1 hover:text-destructive">
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                value={newBlocker}
                onChange={(e) => setNewBlocker(e.target.value)}
                placeholder="Tilføj blokker..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddBlocker())}
              />
              <Button variant="outline" onClick={handleAddBlocker}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={saving || !focusTitle.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gemmer...
              </>
            ) : (
              "Gem ændringer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
