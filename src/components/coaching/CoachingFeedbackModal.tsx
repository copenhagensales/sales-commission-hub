import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFeedbackTypes, useObjections, useCoachingTemplates, useCreateCoachingFeedback, CoachingTemplate } from "@/hooks/useCoachingTemplates";
import { useOnboardingDrills } from "@/hooks/useOnboarding";
import { Loader2, ChevronDown, Target, TrendingUp, Star, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CoachingFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  coachId: string;
  callId?: string;
  onSuccess?: () => void;
}

const RECENT_TEMPLATES_KEY = "coaching_recent_templates";

// Quick presets - maps to template titles
const QUICK_PRESETS = [
  { label: "For blødt næste step", typeKey: "indvending", searchTerm: "blødt" },
  { label: "Pitcher for tidligt", typeKey: "pitch", searchTerm: "tidligt" },
  { label: "Mister kontrol", typeKey: "samtalestyring", searchTerm: "kontrol" },
  { label: "Mail-indvending", typeKey: "indvending", searchTerm: "mail" },
];

// Quick-tags for fields
const STRENGTH_TAGS = [
  "Energi & toneleje",
  "God lytning",
  "Stærk åbning",
  "Professionel",
  "Holdt roen",
  "Nysgerrig",
  "Struktureret",
];

const IMPROVEMENT_TAGS = [
  "Brug navne mere",
  "Stil flere spørgsmål",
  "Kortere intro",
  "Stærkere close",
  "Mere struktur",
  "Lyt mere",
  "Konkretisér værdi",
];

// Positive score options
const scoreOptions = [
  { 
    value: 0, 
    label: "Fokusområde", 
    icon: Target, 
    activeClass: "bg-orange-500/20 border-orange-500 text-orange-700 dark:text-orange-400 ring-2 ring-orange-500/30 ring-offset-2 ring-offset-background",
    inactiveClass: "border-border hover:bg-orange-500/10 hover:border-orange-500/50"
  },
  { 
    value: 1, 
    label: "På vej", 
    icon: TrendingUp, 
    activeClass: "bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-background",
    inactiveClass: "border-border hover:bg-emerald-500/10 hover:border-emerald-500/50"
  },
  { 
    value: 2, 
    label: "Stærk præstation", 
    icon: Star, 
    activeClass: "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/30 ring-offset-2 ring-offset-background",
    inactiveClass: "border-border hover:bg-amber-500/10 hover:border-amber-500/50"
  },
];

function getRecentTemplateIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentTemplate(templateId: string) {
  try {
    const recent = getRecentTemplateIds().filter(id => id !== templateId);
    recent.unshift(templateId);
    localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch {
    // Ignore localStorage errors
  }
}

export function CoachingFeedbackModal({
  open,
  onOpenChange,
  employeeId,
  coachId,
  callId,
  onSuccess,
}: CoachingFeedbackModalProps) {
  const { data: feedbackTypes = [] } = useFeedbackTypes();
  const { data: objections = [] } = useObjections();
  const { data: allTemplates = [] } = useCoachingTemplates({ activeOnly: true });
  const { data: drills = [] } = useOnboardingDrills();
  const createFeedback = useCreateCoachingFeedback();

  // Section A: Selection state
  const [selectedTypeKey, setSelectedTypeKey] = useState("");
  const [selectedObjectionKey, setSelectedObjectionKey] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<CoachingTemplate | null>(null);

  // Section B: Form state
  const [score, setScore] = useState<number>(1);
  const [strength, setStrength] = useState("");
  const [nextRep, setNextRep] = useState("");
  const [sayThis, setSayThis] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [drillId, setDrillId] = useState("");
  const [reps, setReps] = useState<number>(3);
  const [evidence, setEvidence] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // Filter templates based on selected type and objection
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(t => {
      if (selectedTypeKey && t.type_key !== selectedTypeKey) return false;
      if (selectedObjectionKey && t.objection_key !== selectedObjectionKey) return false;
      return true;
    });
  }, [allTemplates, selectedTypeKey, selectedObjectionKey]);

  // Check if selected type shows objection dropdown
  const showObjectionDropdown = selectedTypeKey === "indvending";

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTypeKey("");
      setSelectedObjectionKey("");
      setSelectedTemplateId("");
      setSelectedTemplate(null);
      setScore(1);
      setStrength("");
      setNextRep("");
      setSayThis("");
      setSuccessCriteria("");
      setDrillId("");
      setReps(3);
      setEvidence("");
      setShowDetails(false);
    }
  }, [open]);

  // Auto-fill form when template is selected
  useEffect(() => {
    if (selectedTemplateId) {
      const template = allTemplates.find(t => t.id === selectedTemplateId);
      if (template) {
        setSelectedTemplate(template);
        setScore(template.default_score ?? 1);
        setStrength(template.strength_default || "");
        setNextRep(template.next_rep_default || "");
        setSayThis(template.say_this_default || "");
        setSuccessCriteria(template.success_criteria_default || "");
        setDrillId(template.drill_id || "");
        setReps(template.reps_default || 3);
      }
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId, allTemplates]);

  // Handle quick preset click
  const handleQuickPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setSelectedTypeKey(preset.typeKey);
    setSelectedObjectionKey("");

    // Find matching template
    const matchingTemplate = allTemplates.find(t =>
      t.type_key === preset.typeKey &&
      t.title.toLowerCase().includes(preset.searchTerm.toLowerCase())
    );

    if (matchingTemplate) {
      if (matchingTemplate.objection_key) {
        setSelectedObjectionKey(matchingTemplate.objection_key);
      }
      setSelectedTemplateId(matchingTemplate.id);
    }
  };

  // Handle tag clicks
  const handleStrengthTag = (tag: string) => {
    setStrength(prev => prev ? `${prev}. ${tag}` : tag);
  };

  const handleImprovementTag = (tag: string) => {
    setNextRep(prev => prev ? `${prev}. ${tag}` : tag);
  };

  // Helper to get labels
  const getTypeLabel = (typeKey: string) => {
    return feedbackTypes.find(t => t.key === typeKey)?.label_da || typeKey;
  };

  const getObjectionLabel = (objKey: string) => {
    return objections.find(o => o.key === objKey)?.label_da || objKey;
  };

  // Check if field matches template default
  const isFromTemplate = (fieldValue: string, templateDefault: string | null | undefined) => {
    return selectedTemplate && fieldValue === (templateDefault || "") && fieldValue !== "";
  };

  const handleSubmit = async () => {
    if (!selectedTemplate || !strength || !nextRep) return;

    addRecentTemplate(selectedTemplate.id);

    await createFeedback.mutateAsync({
      employee_id: employeeId,
      coach_id: coachId,
      call_id: callId || null,
      template_id: selectedTemplate.id,
      type_key: selectedTemplate.type_key,
      objection_key: selectedTemplate.objection_key || null,
      score,
      strength,
      next_rep: nextRep,
      say_this: sayThis || null,
      success_criteria: successCriteria || null,
      drill_id: drillId || null,
      reps: drillId ? reps : null,
      evidence: evidence || null,
      is_done: false,
    });

    onOpenChange(false);
    onSuccess?.();
  };

  const isValid = selectedTemplate && strength.trim() && nextRep.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ny Coaching Feedback
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Presets Section */}
          <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Hurtigvalg</span>
              <span className="text-xs text-muted-foreground">(1-klik feedback)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs hover:bg-primary/10 hover:border-primary/50"
                  onClick={() => handleQuickPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Section A: Vælg */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">A</div>
              <span className="text-sm font-medium">Vælg</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Feedback Type */}
              <div className="space-y-2">
                <Label>Feedback-type *</Label>
                <Select value={selectedTypeKey} onValueChange={(val) => {
                  setSelectedTypeKey(val);
                  setSelectedObjectionKey("");
                  setSelectedTemplateId("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {feedbackTypes.map(type => (
                      <SelectItem key={type.key} value={type.key}>
                        {type.label_da}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Objection (conditional) */}
              {showObjectionDropdown && (
                <div className="space-y-2">
                  <Label>Indvending</Label>
                  <Select value={selectedObjectionKey || "all"} onValueChange={(val) => {
                    setSelectedObjectionKey(val === "all" ? "" : val);
                    setSelectedTemplateId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg indvending..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      {objections.map(obj => (
                        <SelectItem key={obj.key} value={obj.key}>
                          {obj.label_da}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Template */}
              <div className={cn("space-y-2", !showObjectionDropdown && "md:col-span-2")}>
                <Label>Skabelon *</Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                  disabled={!selectedTypeKey}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedTypeKey ? "Vælg skabelon..." : "Vælg type først..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section B: Feedback Form (only when template selected) */}
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">B</div>
                <span className="text-sm font-medium">Feedback</span>
                <Badge variant="secondary" className="text-xs">
                  {selectedTemplate.title}
                </Badge>
              </div>

              {/* Score */}
              <div className="space-y-2">
                <Label>Score *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {scoreOptions.map(option => {
                    const Icon = option.icon;
                    const isActive = score === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setScore(option.value)}
                        className={cn(
                          "flex items-center justify-center gap-2 py-3 px-2 rounded-lg border-2 transition-all",
                          isActive ? option.activeClass : option.inactiveClass
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strength with quick-tags */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>1 Styrke *</Label>
                  {isFromTemplate(strength, selectedTemplate.strength_default) && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Fra skabelon</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {STRENGTH_TAGS.map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer text-xs hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                      onClick={() => handleStrengthTag(tag)}
                    >
                      + {tag}
                    </Badge>
                  ))}
                </div>
                <Textarea
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  placeholder="Hvad gjorde medarbejderen godt?"
                  rows={2}
                />
              </div>

              {/* Next Rep (Improvement) with quick-tags */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>1 Forbedring *</Label>
                  {isFromTemplate(nextRep, selectedTemplate.next_rep_default) && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Fra skabelon</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {IMPROVEMENT_TAGS.map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer text-xs hover:bg-orange-500/10 hover:border-orange-500/50 hover:text-orange-700 dark:hover:text-orange-400 transition-colors"
                      onClick={() => handleImprovementTag(tag)}
                    >
                      + {tag}
                    </Badge>
                  ))}
                </div>
                <Textarea
                  value={nextRep}
                  onChange={(e) => setNextRep(e.target.value)}
                  placeholder="Hvad skal medarbejderen fokusere på næste gang?"
                  rows={2}
                />
              </div>

              {/* Collapsible additional details */}
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span>Vis flere detaljer</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Say This */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Sig denne sætning</Label>
                      {isFromTemplate(sayThis, selectedTemplate.say_this_default) && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Fra skabelon</Badge>
                      )}
                    </div>
                    <Textarea
                      value={sayThis}
                      onChange={(e) => setSayThis(e.target.value)}
                      placeholder="En konkret sætning medarbejderen kan bruge..."
                      rows={2}
                    />
                  </div>

                  {/* Success Criteria */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Success-kriterie</Label>
                      {isFromTemplate(successCriteria, selectedTemplate.success_criteria_default) && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Fra skabelon</Badge>
                      )}
                    </div>
                    <Textarea
                      value={successCriteria}
                      onChange={(e) => setSuccessCriteria(e.target.value)}
                      placeholder="Det er lykkedes når..."
                      rows={2}
                    />
                  </div>

                  {/* Drill Assignment */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tildel Drill</Label>
                      <Select value={drillId || "none"} onValueChange={(v) => setDrillId(v === "none" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg drill..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ingen drill</SelectItem>
                          {drills.map(drill => (
                            <SelectItem key={drill.id} value={drill.id}>
                              {drill.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {drillId && (
                      <div className="space-y-2">
                        <Label>Antal reps</Label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={reps}
                          onChange={(e) => setReps(parseInt(e.target.value) || 3)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Evidence */}
                  <div className="space-y-2">
                    <Label>Evidence / Timestamp</Label>
                    <Textarea
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder="Fx tidsstempel i opkaldet eller konkret citat..."
                      rows={2}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || createFeedback.isPending}>
            {createFeedback.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gem Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
