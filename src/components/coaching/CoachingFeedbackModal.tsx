import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeedbackTypes, useObjections, useCoachingTemplates, useCreateCoachingFeedback, CoachingTemplate } from "@/hooks/useCoachingTemplates";
import { useOnboardingDrills } from "@/hooks/useOnboarding";
import { Loader2 } from "lucide-react";

interface CoachingFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  coachId: string;
  callId?: string;
  onSuccess?: () => void;
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
  const { data: drills = [] } = useOnboardingDrills();
  const createFeedback = useCreateCoachingFeedback();

  // Form state - Group A (controls logic)
  const [selectedTypeKey, setSelectedTypeKey] = useState("");
  const [selectedObjectionKey, setSelectedObjectionKey] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Form state - Group B (auto-filled from template)
  const [score, setScore] = useState("");
  const [strength, setStrength] = useState("");
  const [nextRep, setNextRep] = useState("");
  const [sayThis, setSayThis] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [drillId, setDrillId] = useState("");
  const [reps, setReps] = useState("");
  const [evidence, setEvidence] = useState("");

  // Get templates filtered by type and optionally objection
  const { data: templates = [] } = useCoachingTemplates({
    typeKey: selectedTypeKey || undefined,
    objectionKey: selectedTypeKey === "indvending" && selectedObjectionKey ? selectedObjectionKey : undefined,
  });

  // Filter templates when type is indvending but no objection selected yet
  const filteredTemplates = selectedTypeKey === "indvending" && !selectedObjectionKey
    ? templates.filter(t => t.objection_key !== null)
    : templates;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedTypeKey("");
      setSelectedObjectionKey("");
      setSelectedTemplateId("");
      setScore("");
      setStrength("");
      setNextRep("");
      setSayThis("");
      setSuccessCriteria("");
      setDrillId("");
      setReps("");
      setEvidence("");
    }
  }, [open]);

  // Reset template and objection when type changes
  useEffect(() => {
    setSelectedTemplateId("");
    if (selectedTypeKey !== "indvending") {
      setSelectedObjectionKey("");
    }
  }, [selectedTypeKey]);

  // Reset template when objection changes
  useEffect(() => {
    setSelectedTemplateId("");
  }, [selectedObjectionKey]);

  // Auto-fill form when template is selected
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        if (template.default_score !== null) {
          setScore(template.default_score.toString());
        }
        setStrength(template.strength_default);
        setNextRep(template.next_rep_default);
        setSayThis(template.say_this_default || "");
        setSuccessCriteria(template.success_criteria_default || "");
        setDrillId(template.drill_id || "");
        setReps(template.reps_default.toString());
      }
    }
  }, [selectedTemplateId, templates]);

  const handleSubmit = async () => {
    if (!selectedTypeKey || !score || !strength || !nextRep) return;

    await createFeedback.mutateAsync({
      employee_id: employeeId,
      coach_id: coachId,
      call_id: callId || null,
      template_id: selectedTemplateId || null,
      type_key: selectedTypeKey,
      objection_key: selectedObjectionKey || null,
      score: parseInt(score),
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

  const isValid = selectedTypeKey && score && strength && nextRep;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Giv Coaching Feedback</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Group A: Controls logic */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm text-muted-foreground">Vælg Type og Skabelon</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Feedback Type *</Label>
                <Select value={selectedTypeKey} onValueChange={setSelectedTypeKey}>
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

              {selectedTypeKey === "indvending" && (
                <div>
                  <Label>Indvending *</Label>
                  <Select value={selectedObjectionKey} onValueChange={setSelectedObjectionKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg indvending..." />
                    </SelectTrigger>
                    <SelectContent>
                      {objections.map(obj => (
                        <SelectItem key={obj.key} value={obj.key}>
                          {obj.label_da}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedTypeKey && (selectedTypeKey !== "indvending" || selectedObjectionKey) && (
              <div>
                <Label>Skabelon *</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg skabelon..." />
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
            )}
          </div>

          {/* Group B: Editable fields */}
          <div className="space-y-4">
            <div>
              <Label>Score (0-2) *</Label>
              <Select value={score} onValueChange={setScore}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg score..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - Skal forbedres ❌</SelectItem>
                  <SelectItem value="1">1 - Godkendt ✓</SelectItem>
                  <SelectItem value="2">2 - Stærk præstation ⭐</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
          </div>
        </div>

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
