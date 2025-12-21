import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { OnboardingDrill } from "@/hooks/useOnboarding";

interface DrillEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drill: OnboardingDrill | null;
}

const FOCUS_OPTIONS = ["B", "A", "L", "B/A", "Struktur", "Mindset", "Flow"];

export function DrillEditDialog({ open, onOpenChange, drill }: DrillEditDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    focus: "B",
    duration_min: 5,
    description: "",
    when_to_use: "",
    setup: "",
    steps: [] as string[],
    reps: 10,
    script_snippets: [] as string[],
    success_criteria: [] as string[],
    common_mistakes: [] as string[],
    variants: [] as string[],
  });

  const [newStep, setNewStep] = useState("");
  const [newSnippet, setNewSnippet] = useState("");
  const [newCriteria, setNewCriteria] = useState("");
  const [newMistake, setNewMistake] = useState("");
  const [newVariant, setNewVariant] = useState("");

  useEffect(() => {
    if (drill) {
      setFormData({
        title: drill.title || "",
        focus: drill.focus || "B",
        duration_min: drill.duration_min || 5,
        description: drill.description || "",
        when_to_use: drill.when_to_use || "",
        setup: drill.setup || "",
        steps: drill.steps || [],
        reps: drill.reps || 10,
        script_snippets: drill.script_snippets || [],
        success_criteria: drill.success_criteria || [],
        common_mistakes: drill.common_mistakes || [],
        variants: drill.variants || [],
      });
    }
  }, [drill]);

  const addToArray = (field: keyof typeof formData, value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...(prev[field] as string[]), value.trim()],
      }));
      setter("");
    }
  };

  const removeFromArray = (field: keyof typeof formData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!drill) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_drills")
        .update({
          title: formData.title,
          focus: formData.focus,
          duration_min: formData.duration_min,
          description: formData.description || null,
          when_to_use: formData.when_to_use || null,
          setup: formData.setup || null,
          steps: formData.steps,
          reps: formData.reps,
          script_snippets: formData.script_snippets,
          success_criteria: formData.success_criteria,
          common_mistakes: formData.common_mistakes,
          variants: formData.variants,
        })
        .eq("id", drill.id);

      if (error) throw error;
      
      toast.success("Drill gemt");
      queryClient.invalidateQueries({ queryKey: ["onboarding-drills"] });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Kunne ikke gemme drill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Rediger drill</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Titel</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Fokus</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={formData.focus}
                onChange={(e) => setFormData(prev => ({ ...prev, focus: e.target.value }))}
              >
                {FOCUS_OPTIONS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            
            <div>
              <Label>Varighed (min)</Label>
              <Input
                type="number"
                value={formData.duration_min}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_min: parseInt(e.target.value) || 5 }))}
              />
            </div>
            
            <div>
              <Label>Reps</Label>
              <Input
                type="number"
                value={formData.reps || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, reps: parseInt(e.target.value) || null }))}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Beskrivelse</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>

          {/* When to use */}
          <div>
            <Label>Hvornår bruges den</Label>
            <Textarea
              value={formData.when_to_use}
              onChange={(e) => setFormData(prev => ({ ...prev, when_to_use: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Setup */}
          <div>
            <Label>Setup</Label>
            <Textarea
              value={formData.setup}
              onChange={(e) => setFormData(prev => ({ ...prev, setup: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Steps */}
          <div>
            <Label>Trin</Label>
            <div className="space-y-2 mt-1">
              {formData.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted p-2 rounded">
                  <span className="text-sm flex-1">{i + 1}. {step}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeFromArray("steps", i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Tilføj trin..."
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("steps", newStep, setNewStep))}
                />
                <Button size="icon" onClick={() => addToArray("steps", newStep, setNewStep)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Script snippets */}
          <div>
            <Label>Script-eksempler</Label>
            <div className="space-y-2 mt-1">
              {formData.script_snippets.map((snippet, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted p-2 rounded">
                  <code className="text-sm flex-1 font-mono">{snippet}</code>
                  <Button size="icon" variant="ghost" onClick={() => removeFromArray("script_snippets", i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Tilføj script..."
                  value={newSnippet}
                  onChange={(e) => setNewSnippet(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("script_snippets", newSnippet, setNewSnippet))}
                />
                <Button size="icon" onClick={() => addToArray("script_snippets", newSnippet, setNewSnippet)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Success criteria */}
          <div>
            <Label>Succeskriterier</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {formData.success_criteria.map((c, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {c}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("success_criteria", i)} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Tilføj kriterie..."
                value={newCriteria}
                onChange={(e) => setNewCriteria(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("success_criteria", newCriteria, setNewCriteria))}
              />
              <Button size="icon" onClick={() => addToArray("success_criteria", newCriteria, setNewCriteria)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Common mistakes */}
          <div>
            <Label>Typiske fejl</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {formData.common_mistakes.map((m, i) => (
                <Badge key={i} variant="destructive" className="gap-1">
                  {m}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("common_mistakes", i)} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Tilføj fejl..."
                value={newMistake}
                onChange={(e) => setNewMistake(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("common_mistakes", newMistake, setNewMistake))}
              />
              <Button size="icon" onClick={() => addToArray("common_mistakes", newMistake, setNewMistake)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Variants */}
          <div>
            <Label>Varianter</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {formData.variants.map((v, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  {v}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("variants", i)} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="solo, buddy, manager-led..."
                value={newVariant}
                onChange={(e) => setNewVariant(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("variants", newVariant, setNewVariant))}
              />
              <Button size="icon" onClick={() => addToArray("variants", newVariant, setNewVariant)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Gem ændringer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
