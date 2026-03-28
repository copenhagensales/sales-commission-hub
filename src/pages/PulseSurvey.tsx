import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useActivePulseSurvey, useHasCompletedSurvey, useSubmitPulseSurvey, usePulseSurveyDraft, useSavePulseSurveyDraft, useDeletePulseSurveyDraft, PulseSurveyResponse } from "@/hooks/usePulseSurvey";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, HeartHandshake, Save, FlaskConical, Shield, Clock, BarChart3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TENURE_OPTIONS = [
  { value: 'under_1_month', label: 'Under 1 måned' },
  { value: '1_3_months', label: '1–3 måneder' },
  { value: '3_6_months', label: '3–6 måneder' },
  { value: 'over_6_months', label: 'Over 6 måneder' },
];

const SCALE_QUESTIONS = [
  {
    key: 'nps_score',
    question: 'Hvor sandsynligt er det, at du vil anbefale Copenhagen Sales som arbejdsplads, hvis nogen spørger dig?',
    extraHelpText: 'Tænk på, hvor tryg du ville være ved at anbefale Copenhagen Sales som arbejdsplads - ikke på om du konkret har nogen i dit netværk, du ville anbefale os til.',
    lowLabel: 'Slet ikke sandsynligt',
    highLabel: 'Meget sandsynligt',
    isNps: true,
    section: 'nps',
  },
  { key: 'development_score', question: 'I hvor høj grad oplever du, at du bliver uddannet, trænet og udviklet som sælger i dit team?', lowLabel: 'Slet ikke', highLabel: 'I meget høj grad', section: 'leadership' },
  { key: 'leadership_score', question: 'Hvor tilfreds er du med den måde, din teamleder leder teamet på?', lowLabel: 'Slet ikke tilfreds', highLabel: 'Meget tilfreds', section: 'leadership' },
  { key: 'recognition_score', question: 'I hvor høj grad oplever du, at dine præstationer bliver anerkendt og belønnet på en fair måde?', lowLabel: 'Slet ikke', highLabel: 'I meget høj grad', section: 'leadership' },
  { key: 'energy_score', question: 'Hvordan vil du vurdere energien og stemningen i dit team lige nu?', lowLabel: 'Meget dårlig', highLabel: 'Meget god', section: 'wellbeing' },
  { key: 'seriousness_score', question: 'I hvor høj grad oplever du, at der arbejdes seriøst og målrettet i dit team?', lowLabel: 'Slet ikke', highLabel: 'I meget høj grad', section: 'wellbeing' },
  { key: 'leader_availability_score', question: 'I hvor høj grad oplever du, at din leder har tid og overskud til dig, når du har brug for det?', lowLabel: 'Slet ikke', highLabel: 'I meget høj grad', section: 'leadership' },
  { key: 'wellbeing_score', question: 'Hvor godt trives du samlet set i Copenhagen Sales lige nu?', lowLabel: 'Slet ikke', highLabel: 'Rigtig godt', section: 'wellbeing' },
  { key: 'psychological_safety_score', question: 'I hvor høj grad føler du dig tryg ved at sige din ærlige mening i teamet – også når du er uenig eller har kritik?', lowLabel: 'Slet ikke', highLabel: 'I meget høj grad', section: 'wellbeing' },
  { key: 'attrition_risk_score', question: 'Hvor sandsynligt er det, at du stadig arbejder i Copenhagen Sales om 6 måneder?', lowLabel: 'Meget usandsynligt', highLabel: 'Meget sandsynligt', section: 'wellbeing' },
  { key: 'product_competitiveness_score', question: 'Hvad er din opfattelse af de produkter, du sælger – hvor konkurrencedygtige er de over for de kunder, du taler med?', lowLabel: 'Slet ikke konkurrencedygtige', highLabel: 'Meget konkurrencedygtige', section: 'product' },
  { key: 'market_fit_score', question: 'Hvor godt matcher kundens produkter det, markedet efterspørger?', lowLabel: 'Meget dårligt', highLabel: 'Meget godt', section: 'product' },
  { key: 'interest_creation_score', question: 'Hvor let er det at skabe interesse for kundens produkter?', lowLabel: 'Meget svært', highLabel: 'Meget let', section: 'product' },
  { key: 'campaign_attractiveness_score', question: 'Hvor attraktiv oplever du kampagnen, du sidder på, sammenlignet med andre kampagner hos Copenhagen Sales?', lowLabel: 'Ville helst sidde på en anden', highLabel: 'Ville klart foretrække denne', section: 'product' },
];

const SECTIONS = [
  { id: 'leadership', title: 'Ledelse og udvikling', icon: '📊' },
  { id: 'wellbeing', title: 'Trivsel og kultur', icon: '💚' },
  { id: 'product', title: 'Produkt og kampagne', icon: '🎯' },
];

function ScaleSelector({ value, onChange, isNps = false, lowLabel, highLabel }: { value: number | undefined; onChange: (v: number) => void; isNps?: boolean; lowLabel?: string; highLabel?: string }) {
  const scale = isNps ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  const getNpsColor = (num: number) => {
    if (num <= 6) return 'bg-red-500 text-white';
    if (num <= 8) return 'bg-amber-500 text-white';
    return 'bg-green-500 text-white';
  };
  
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {scale.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={`w-10 h-10 rounded-lg font-medium transition-all ${
              value === num
                ? isNps ? `${getNpsColor(num)} shadow-lg scale-110` : 'bg-primary text-primary-foreground shadow-lg scale-110'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground pt-1">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

export default function PulseSurvey() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTestMode = searchParams.get('test') === 'true';
  const { user } = useAuth();
  const { data: activeSurvey, isLoading: surveyLoading } = useActivePulseSurvey();
  const { data: hasCompleted, isLoading: completionLoading } = useHasCompletedSurvey(activeSurvey?.id);
  const submitSurvey = useSubmitPulseSurvey();
  const { data: draftData, isLoading: draftLoading } = usePulseSurveyDraft(activeSurvey?.id);
  const saveDraft = useSavePulseSurveyDraft();
  const deleteDraft = useDeletePulseSurveyDraft();

  const { data: employee } = useQuery({
    queryKey: ['employee-for-pulse', user?.email],
    queryFn: async () => {
      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data } = await supabase
        .from('employee_master_data')
        .select('id, department')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .single();
      return data;
    },
    enabled: !!user?.email
  });

  const [formData, setFormData] = useState<Partial<PulseSurveyResponse>>({});
  const [npsComment, setNpsComment] = useState('');
  const [improvementSuggestions, setImprovementSuggestions] = useState('');
  const [campaignImprovementSuggestions, setCampaignImprovementSuggestions] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const HIDDEN_PULSE_TEAMS = ['Fieldmarketing', 'Stab'];
  const { data: teams } = useQuery({
    queryKey: ['teams-for-pulse'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('id, name').order('name');
      if (error) throw error;
      return (data || []).filter(t => !HIDDEN_PULSE_TEAMS.includes(t.name));
    }
  });

  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const draftInitialized = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Progress calculation
  const totalFields = SCALE_QUESTIONS.length + 2; // scales + tenure + team
  const filledFields = useMemo(() => {
    let count = 0;
    SCALE_QUESTIONS.forEach(q => { if (formData[q.key as keyof PulseSurveyResponse] !== undefined) count++; });
    if (formData.tenure) count++;
    if (selectedTeamId) count++;
    return count;
  }, [formData, selectedTeamId]);
  const progressPercent = Math.round((filledFields / totalFields) * 100);

  // Load draft
  useEffect(() => {
    if (draftData && !draftInitialized.current) {
      draftInitialized.current = true;
      const draft = draftData as Record<string, any>;
      setFormData({
        nps_score: draft.nps_score, tenure: draft.tenure,
        development_score: draft.development_score, leadership_score: draft.leadership_score,
        recognition_score: draft.recognition_score, energy_score: draft.energy_score,
        seriousness_score: draft.seriousness_score, leader_availability_score: draft.leader_availability_score,
        wellbeing_score: draft.wellbeing_score, psychological_safety_score: draft.psychological_safety_score,
        product_competitiveness_score: draft.product_competitiveness_score, market_fit_score: draft.market_fit_score,
        interest_creation_score: draft.interest_creation_score, campaign_attractiveness_score: draft.campaign_attractiveness_score,
      });
      setNpsComment(draft.nps_comment || '');
      setImprovementSuggestions(draft.improvement_suggestions || '');
      setCampaignImprovementSuggestions(draft.campaign_improvement_suggestions || '');
      if (draft.selected_team_id) setSelectedTeamId(draft.selected_team_id);
    }
  }, [draftData]);

  // Auto-save draft
  const triggerDraftSave = useCallback(() => {
    if (isTestMode || !activeSurvey?.id || hasCompleted) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setDraftStatus('saving');
      saveDraft.mutate(
        { surveyId: activeSurvey.id, draftData: { ...formData, nps_comment: npsComment, improvement_suggestions: improvementSuggestions, campaign_improvement_suggestions: campaignImprovementSuggestions, selected_team_id: selectedTeamId } },
        { onSuccess: () => { setDraftStatus('saved'); setTimeout(() => setDraftStatus('idle'), 2000); }, onError: () => setDraftStatus('idle') }
      );
    }, 3000);
  }, [activeSurvey?.id, formData, npsComment, improvementSuggestions, campaignImprovementSuggestions, selectedTeamId, hasCompleted, saveDraft]);

  useEffect(() => {
    if (draftInitialized.current) triggerDraftSave();
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [formData, npsComment, improvementSuggestions, campaignImprovementSuggestions, selectedTeamId, triggerDraftSave]);

  const handleScaleChange = (key: string, value: number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (isTestMode) { toast.success('Test afsluttet – ingen data blev gemt'); navigate('/pulse-survey-results'); return; }

    const requiredScales = SCALE_QUESTIONS.map(q => q.key);
    for (const key of requiredScales) {
      if (!formData[key as keyof PulseSurveyResponse]) { toast.error('Besvar venligst alle obligatoriske spørgsmål'); return; }
    }
    if (!formData.tenure) { toast.error('Vælg venligst din anciennitet'); return; }
    if (!selectedTeamId) { toast.error('Vælg venligst dit team'); return; }
    if (!activeSurvey?.id) { toast.error('Ingen aktiv pulsmåling fundet'); return; }

    try {
      await submitSurvey.mutateAsync({
        surveyId: activeSurvey.id, selectedTeamId,
        response: { ...formData as PulseSurveyResponse, nps_comment: npsComment || undefined, improvement_suggestions: improvementSuggestions || undefined, campaign_improvement_suggestions: campaignImprovementSuggestions || undefined }
      });
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      deleteDraft.mutate(activeSurvey.id);
      toast.success('Tak for din besvarelse!');
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Der opstod en fejl ved indsendelse');
    }
  };

  if (!isTestMode && (surveyLoading || completionLoading || draftLoading)) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        </div>
      </MainLayout>
    );
  }

  if (!isTestMode && !activeSurvey) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div><h1 className="text-3xl font-bold">Pulsmåling</h1><p className="text-muted-foreground">Månedlig trivselsmåling</p></div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HeartHandshake className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground text-center">Der er ingen aktiv pulsmåling lige nu.<br />Næste pulsmåling aktiveres den 15. i måneden.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (!isTestMode && hasCompleted) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div><h1 className="text-3xl font-bold">Pulsmåling</h1><p className="text-muted-foreground">Månedlig trivselsmåling</p></div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-medium text-center mb-2">Tak for din besvarelse!</p>
              <p className="text-muted-foreground text-center">Du har allerede udfyldt denne måneds pulsmåling.<br />Næste pulsmåling aktiveres den 15. i næste måned.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
  const npsQ = SCALE_QUESTIONS[0];

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        {/* Sticky progress bar */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm pb-3 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-1.5">
            <span>Fremgang</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <div className="space-y-6 py-4">
          {isTestMode && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <FlaskConical className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">Du er i test-tilstand – svar gemmes ikke.</AlertDescription>
            </Alert>
          )}

          <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              Vi beklager – din tidligere besvarelse blev desværre ikke registreret korrekt. Vi har derfor brug for, at du besvarer pulsmålingen igen. Tak for din forståelse.
            </AlertDescription>
          </Alert>

          <div>
            <h1 className="text-3xl font-bold">{isTestMode ? 'Pulsmåling (Test)' : 'Pulsmåling'}</h1>
            <p className="text-muted-foreground">
              {isTestMode ? 'Test-tilstand – ingen data gemmes' : activeSurvey ? `${monthNames[activeSurvey.month - 1]} ${activeSurvey.year}` : 'Månedlig trivselsmåling'}
            </p>
          </div>

          {/* Simplified intro */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">Dine svar er <strong>100% anonyme</strong> og kan ikke spores tilbage til dig.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">Det tager <strong>3–5 minutter</strong> at udfylde.</p>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">Bruges <strong>kun til at forbedre</strong> din hverdag og ledelsen.</p>
                </div>
                {!isTestMode && (
                  <div className="flex items-start gap-3">
                    <Save className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">Dine svar <strong>gemmes automatisk</strong> som kladde.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section: Din baggrund */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">👤 Din baggrund</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hvilket team arbejder du på? <span className="text-destructive">*</span></Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger><SelectValue placeholder="Vælg team..." /></SelectTrigger>
                  <SelectContent>
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t border-border" />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hvor længe har du arbejdet hos Copenhagen Sales?</Label>
                <RadioGroup value={formData.tenure} onValueChange={(v) => setFormData(prev => ({ ...prev, tenure: v as PulseSurveyResponse['tenure'] }))}>
                  {TENURE_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value}>{option.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Section: Anbefaling (NPS) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">⭐ Anbefaling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{npsQ.question}</Label>
                {npsQ.extraHelpText && <p className="text-xs text-muted-foreground italic">{npsQ.extraHelpText}</p>}
                <ScaleSelector value={formData.nps_score} isNps={true} onChange={(v) => handleScaleChange('nps_score', v)} lowLabel={npsQ.lowLabel} highLabel={npsQ.highLabel} />
              </div>
              <div className="border-t border-border" />
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Vil du kort uddybe, hvorfor du gav den score?
                  <span className="text-muted-foreground font-normal ml-1">(valgfrit)</span>
                </Label>
                <Textarea value={npsComment} onChange={(e) => setNpsComment(e.target.value)} placeholder="Hvad fungerer godt – og hvad kunne være bedre?" rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Grouped sections */}
          {SECTIONS.map((section) => {
            const sectionQuestions = SCALE_QUESTIONS.filter(q => q.section === section.id);
            return (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">{section.icon} {section.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {sectionQuestions.map((q, idx) => (
                    <div key={q.key}>
                      {idx > 0 && <div className="border-t border-border mb-6" />}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{q.question}</Label>
                        <ScaleSelector value={formData[q.key as keyof PulseSurveyResponse] as number} onChange={(v) => handleScaleChange(q.key, v)} lowLabel={q.lowLabel} highLabel={q.highLabel} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {/* Section: Dine forslag */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">💬 Dine forslag</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Hvad bør kunden forbedre for at gøre kampagnen og produkterne lettere at sælge?
                  <span className="text-muted-foreground font-normal ml-1">(valgfrit)</span>
                </Label>
                <Textarea value={campaignImprovementSuggestions} onChange={(e) => setCampaignImprovementSuggestions(e.target.value)} placeholder="Skriv dine forslag her..." rows={3} />
              </div>
              <div className="border-t border-border" />
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Har du idéer til, hvad vi kunne gøre bedre i Copenhagen Sales?
                  <span className="text-muted-foreground font-normal ml-1">(valgfrit)</span>
                </Label>
                <p className="text-xs text-muted-foreground">Ledelse, træning, stemning, rammer, løn/bonus, kommunikation – alt er velkomment.</p>
                <Textarea value={improvementSuggestions} onChange={(e) => setImprovementSuggestions(e.target.value)} placeholder="Skriv dine forslag her..." rows={3} />
              </div>
              <div className="border-t border-border" />
              <div>
                <Button onClick={handleSubmit} size="lg" className="w-full" disabled={!isTestMode && (submitSurvey.isPending || !selectedTeamId)}>
                  {isTestMode ? 'Afslut test (gemmes ikke)' : submitSurvey.isPending ? 'Indsender...' : 'Indsend besvarelse'}
                </Button>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  {isTestMode ? 'Dette er en test – ingen data gemmes.' : 'Din besvarelse er anonym og kan ikke ændres efter indsendelse.'}
                </p>
                {!isTestMode && draftStatus !== 'idle' && (
                  <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1.5">
                    <Save className="h-3 w-3" />
                    {draftStatus === 'saving' ? 'Gemmer kladde...' : 'Kladde gemt'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
