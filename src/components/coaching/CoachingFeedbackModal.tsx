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
import { Loader2, Search, ChevronDown, Clock, X, Star, Check } from "lucide-react";
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
const MAX_RECENT = 5;

function getRecentTemplateIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentTemplate(templateId: string) {
  const recent = getRecentTemplateIds().filter(id => id !== templateId);
  recent.unshift(templateId);
  localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
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
  const { data: allTemplates = [] } = useCoachingTemplates({});
  const { data: drills = [] } = useOnboardingDrills();
  const createFeedback = useCreateCoachingFeedback();

  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // Selected template
  const [selectedTemplate, setSelectedTemplate] = useState<CoachingTemplate | null>(null);

  // Form state
  const [score, setScore] = useState<number | null>(null);
  const [strength, setStrength] = useState("");
  const [nextRep, setNextRep] = useState("");
  const [sayThis, setSayThis] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [drillId, setDrillId] = useState("");
  const [reps, setReps] = useState("");
  const [evidence, setEvidence] = useState("");

  // Recent templates
  const recentTemplateIds = useMemo(() => getRecentTemplateIds(), [open]);
  const recentTemplates = useMemo(() => {
    return recentTemplateIds
      .map(id => allTemplates.find(t => t.id === id))
      .filter((t): t is CoachingTemplate => t !== undefined && t.is_active);
  }, [recentTemplateIds, allTemplates]);

  // Group templates by type
  const templatesByType = useMemo(() => {
    const activeTemplates = allTemplates.filter(t => t.is_active);
    const filtered = searchQuery
      ? activeTemplates.filter(t => 
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          feedbackTypes.find(ft => ft.key === t.type_key)?.label_da.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : activeTemplates;

    const grouped: Record<string, CoachingTemplate[]> = {};
    for (const template of filtered) {
      if (!grouped[template.type_key]) {
        grouped[template.type_key] = [];
      }
      grouped[template.type_key].push(template);
    }
    return grouped;
  }, [allTemplates, searchQuery, feedbackTypes]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setShowDetails(false);
      setSelectedTemplate(null);
      setScore(null);
      setStrength("");
      setNextRep("");
      setSayThis("");
      setSuccessCriteria("");
      setDrillId("");
      setReps("");
      setEvidence("");
    }
  }, [open]);

  // Auto-fill form when template is selected
  const handleSelectTemplate = (template: CoachingTemplate) => {
    setSelectedTemplate(template);
    if (template.default_score !== null) {
      setScore(template.default_score);
    }
    setStrength(template.strength_default);
    setNextRep(template.next_rep_default);
    setSayThis(template.say_this_default || "");
    setSuccessCriteria(template.success_criteria_default || "");
    setDrillId(template.drill_id || "");
    setReps(template.reps_default.toString());
  };

  const handleClearTemplate = () => {
    setSelectedTemplate(null);
    setScore(null);
    setStrength("");
    setNextRep("");
    setSayThis("");
    setSuccessCriteria("");
    setDrillId("");
    setReps("");
  };

  const handleSubmit = async () => {
    if (!selectedTemplate || score === null || !strength || !nextRep) return;

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
      reps: reps ? parseInt(reps) : null,
      evidence: evidence || null,
      is_done: false,
    });

    onOpenChange(false);
    onSuccess?.();
  };

  const isValid = selectedTemplate && score !== null && strength && nextRep;

  const getTypeLabel = (typeKey: string) => {
    return feedbackTypes.find(t => t.key === typeKey)?.label_da || typeKey;
  };

  const getObjectionLabel = (objectionKey: string | null) => {
    if (!objectionKey) return null;
    return objections.find(o => o.key === objectionKey)?.label_da || objectionKey;
  };

  const scoreOptions = [
    { value: 0, label: "Skal forbedres", icon: X, color: "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20" },
    { value: 1, label: "Godkendt", icon: Check, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20" },
    { value: 2, label: "Stærk", icon: Star, color: "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Giv Coaching Feedback</DialogTitle>
        </DialogHeader>

        {!selectedTemplate ? (
          // Template Selection View
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Søg skabeloner..."
                className="pl-10"
              />
            </div>

            {/* Recent Templates */}
            {recentTemplates.length > 0 && !searchQuery && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Senest brugt</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="px-3 py-2 rounded-lg border bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors text-sm text-left"
                    >
                      <span className="font-medium">{template.title}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {getTypeLabel(template.type_key)}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Templates grouped by type */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {Object.entries(templatesByType).map(([typeKey, templates]) => (
                <div key={typeKey}>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {getTypeLabel(typeKey)}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left group"
                      >
                        <div className="font-medium text-sm group-hover:text-primary transition-colors">
                          {template.title}
                        </div>
                        {template.objection_key && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {getObjectionLabel(template.objection_key)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {Object.keys(templatesByType).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen skabeloner fundet
                </div>
              )}
            </div>
          </div>
        ) : (
          // Feedback Form View
          <div className="space-y-6">
            {/* Selected template header */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium">{selectedTemplate.title}</div>
                <div className="text-sm text-muted-foreground">
                  {getTypeLabel(selectedTemplate.type_key)}
                  {selectedTemplate.objection_key && ` • ${getObjectionLabel(selectedTemplate.objection_key)}`}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearTemplate}>
                Skift skabelon
              </Button>
            </div>

            {/* Score buttons */}
            <div>
              <Label className="mb-3 block">Score *</Label>
              <div className="grid grid-cols-3 gap-2">
                {scoreOptions.map(option => {
                  const Icon = option.icon;
                  const isSelected = score === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setScore(option.value)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                        isSelected 
                          ? option.color.replace("hover:", "") + " ring-2 ring-offset-2 ring-offset-background"
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium text-sm">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Essential fields */}
            <div className="space-y-4">
              <div>
                <Label>1 Styrke *</Label>
                <Textarea
                  value={strength}
                  onChange={e => setStrength(e.target.value)}
                  placeholder="Hvad gjorde medarbejderen godt?"
                  rows={2}
                />
              </div>

              <div>
                <Label>1 Forbedring / Næste Rep *</Label>
                <Textarea
                  value={nextRep}
                  onChange={e => setNextRep(e.target.value)}
                  placeholder="Hvad skal forbedres til næste gang?"
                  rows={2}
                />
              </div>
            </div>

            {/* Collapsible details */}
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="text-muted-foreground">Vis flere detaljer</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div>
                  <Label>"Sig denne sætning næste gang"</Label>
                  <Textarea
                    value={sayThis}
                    onChange={e => setSayThis(e.target.value)}
                    placeholder="Konkret forslag til sætning..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Success-kriterie</Label>
                  <Input
                    value={successCriteria}
                    onChange={e => setSuccessCriteria(e.target.value)}
                    placeholder="Det er lykkedes når..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tildel Drill</Label>
                    <Select value={drillId} onValueChange={setDrillId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg drill..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Ingen drill</SelectItem>
                        {drills.map(drill => (
                          <SelectItem key={drill.id} value={drill.id}>
                            {drill.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Reps</Label>
                    <Input
                      type="number"
                      value={reps}
                      onChange={e => setReps(e.target.value)}
                      placeholder="Antal gentagelser"
                      min={1}
                    />
                  </div>
                </div>

                <div>
                  <Label>Evidence / Timestamp</Label>
                  <Input
                    value={evidence}
                    onChange={e => setEvidence(e.target.value)}
                    placeholder="fx 02:14 / 'kunde sagde X'"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        <DialogFooter>
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
