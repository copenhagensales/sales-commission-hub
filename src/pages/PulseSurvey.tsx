import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useActivePulseSurvey, useHasCompletedSurvey, useSubmitPulseSurvey, usePulseSurveyDraft, useSavePulseSurveyDraft, useDeletePulseSurveyDraft, PulseSurveyResponse } from "@/hooks/usePulseSurvey";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, HeartHandshake, Save, FlaskConical } from "lucide-react";
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
    title: '1. NPS / anbefaling',
    question: 'Hvor sandsynligt er det, at du vil anbefale Copenhagen Sales som arbejdsplads, hvis nogen spørger dig?',
    extraHelpText: 'Tænk på, hvor tryg du ville være ved at anbefale Copenhagen Sales som arbejdsplads - ikke på om du konkret har nogen i dit netværk, du ville anbefale os til.',
    helpText: '0 = Slet ikke sandsynligt, 10 = Meget sandsynligt',
    isNps: true
  },
  {
    key: 'development_score',
    title: '4. Udvikling og træning',
    question: 'I hvor høj grad oplever du, at du bliver uddannet, trænet og udviklet som sælger i dit team?',
    helpText: '1 = Slet ikke, 10 = I meget høj grad'
  },
  {
    key: 'leadership_score',
    title: '5. Teamlederens ledelse',
    question: 'Hvor tilfreds er du med den måde, din teamleder leder teamet på?',
    helpText: '1 = Slet ikke tilfreds, 10 = Meget tilfreds'
  },
  {
    key: 'recognition_score',
    title: '6. Anerkendelse og belønning',
    question: 'I hvor høj grad oplever du, at dine præstationer bliver anerkendt og belønnet på en fair måde?',
    helpText: '1 = Slet ikke, 10 = I meget høj grad'
  },
  {
    key: 'energy_score',
    title: '7. Energi og stemning',
    question: 'Hvordan vil du vurdere energien og stemningen i dit team lige nu?',
    helpText: '1 = Meget dårlig, 10 = Meget god'
  },
  {
    key: 'seriousness_score',
    title: '8. Seriøsitet i arbejdet',
    question: 'I hvor høj grad oplever du, at der arbejdes seriøst og målrettet i dit team?',
    helpText: '1 = Slet ikke, 10 = I meget høj grad'
  },
  {
    key: 'leader_availability_score',
    title: '9. Lederens tid og overskud',
    question: 'I hvor høj grad oplever du, at din leder har tid og overskud til dig, når du har brug for det?',
    helpText: '1 = Slet ikke, 10 = I meget høj grad'
  },
  {
    key: 'wellbeing_score',
    title: '10. Samlet trivsel',
    question: 'Hvor godt trives du samlet set i Copenhagen Sales lige nu?',
    helpText: '1 = Slet ikke, 10 = Rigtig godt'
  },
  {
    key: 'psychological_safety_score',
    title: '11. Psykologisk tryghed',
    question: 'I hvor høj grad føler du dig tryg ved at sige din ærlige mening i teamet – også når du er uenig eller har kritik?',
    helpText: '1 = Slet ikke, 10 = I meget høj grad'
  },
  {
    key: 'product_competitiveness_score',
    title: '12. Produktkonkurrenceevne',
    question: 'Hvad er din opfattelse af de produkter, du sælger – hvor konkurrencedygtige er de over for de kunder, du taler med?',
    helpText: '1 = Slet ikke konkurrencedygtige, 10 = Meget konkurrencedygtige'
  },
  {
    key: 'market_fit_score',
    title: '13. Markedsmatch',
    question: 'Hvor godt matcher kundens produkter det, markedet efterspørger?',
    helpText: '1 = Meget dårligt, 10 = Meget godt'
  },
  {
    key: 'interest_creation_score',
    title: '14. Interesse for produkter',
    question: 'Hvor let er det at skabe interesse for kundens produkter?',
    helpText: '1 = Meget svært, 10 = Meget let'
  },
  {
    key: 'campaign_attractiveness_score',
    title: '15. Kampagneattraktivitet',
    question: 'Hvor attraktiv oplever du kampagnen, du sidder på, sammenlignet med andre kampagner hos Copenhagen Sales?',
    helpText: '1 = Jeg ville helst sidde på en anden kampagne, 10 = Jeg ville klart foretrække at blive på denne kampagne'
  },
];

function ScaleSelector({ value, onChange, isNps = false }: { value: number | undefined; onChange: (v: number) => void; isNps?: boolean }) {
  const scale = isNps ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  const getNpsColor = (num: number) => {
    if (num <= 6) return 'bg-red-500 text-white'; // Detractor
    if (num <= 8) return 'bg-amber-500 text-white'; // Passive
    return 'bg-green-500 text-white'; // Promoter
  };
  
  return (
    <div className="flex flex-wrap gap-2 mt-2">
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
  );
}

export default function PulseSurvey() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: activeSurvey, isLoading: surveyLoading } = useActivePulseSurvey();
  const { data: hasCompleted, isLoading: completionLoading } = useHasCompletedSurvey(activeSurvey?.id);
  const submitSurvey = useSubmitPulseSurvey();
  const { data: draftData, isLoading: draftLoading } = usePulseSurveyDraft(activeSurvey?.id);
  const saveDraft = useSavePulseSurveyDraft();
  const deleteDraft = useDeletePulseSurveyDraft();

  // Get employee department
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

  // Fetch teams for dropdown
  const { data: teams } = useQuery({
    queryKey: ['teams-for-pulse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const draftInitialized = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load draft data on mount
  useEffect(() => {
    if (draftData && !draftInitialized.current) {
      draftInitialized.current = true;
      const draft = draftData as Record<string, any>;
      setFormData({
        nps_score: draft.nps_score,
        tenure: draft.tenure,
        development_score: draft.development_score,
        leadership_score: draft.leadership_score,
        recognition_score: draft.recognition_score,
        energy_score: draft.energy_score,
        seriousness_score: draft.seriousness_score,
        leader_availability_score: draft.leader_availability_score,
        wellbeing_score: draft.wellbeing_score,
        psychological_safety_score: draft.psychological_safety_score,
        product_competitiveness_score: draft.product_competitiveness_score,
        market_fit_score: draft.market_fit_score,
        interest_creation_score: draft.interest_creation_score,
        campaign_attractiveness_score: draft.campaign_attractiveness_score,
      });
      setNpsComment(draft.nps_comment || '');
      setImprovementSuggestions(draft.improvement_suggestions || '');
      setCampaignImprovementSuggestions(draft.campaign_improvement_suggestions || '');
      if (draft.selected_team_id) setSelectedTeamId(draft.selected_team_id);
    }
  }, [draftData]);

  // Auto-save draft with debounce
  const triggerDraftSave = useCallback(() => {
    if (!activeSurvey?.id || hasCompleted) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setDraftStatus('saving');
      saveDraft.mutate(
        {
          surveyId: activeSurvey.id,
          draftData: { ...formData, nps_comment: npsComment, improvement_suggestions: improvementSuggestions, campaign_improvement_suggestions: campaignImprovementSuggestions, selected_team_id: selectedTeamId },
        },
        {
          onSuccess: () => {
            setDraftStatus('saved');
            setTimeout(() => setDraftStatus('idle'), 2000);
          },
          onError: () => setDraftStatus('idle'),
        }
      );
    }, 3000);
  }, [activeSurvey?.id, formData, npsComment, improvementSuggestions, campaignImprovementSuggestions, selectedTeamId, hasCompleted, saveDraft]);

  // Trigger auto-save when form data changes (skip initial load)
  useEffect(() => {
    if (draftInitialized.current) {
      triggerDraftSave();
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [formData, npsComment, improvementSuggestions, campaignImprovementSuggestions, selectedTeamId, triggerDraftSave]);

  const handleScaleChange = (key: string, value: number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    const requiredScales = ['nps_score', 'development_score', 'leadership_score', 'recognition_score', 
      'energy_score', 'seriousness_score', 'leader_availability_score', 'wellbeing_score', 'psychological_safety_score',
      'product_competitiveness_score', 'market_fit_score', 'interest_creation_score', 'campaign_attractiveness_score'];
    
    for (const key of requiredScales) {
      if (!formData[key as keyof PulseSurveyResponse]) {
        toast.error(`Besvar venligst alle obligatoriske spørgsmål`);
        return;
      }
    }

    if (!formData.tenure) {
      toast.error('Vælg venligst din anciennitet');
      return;
    }

    if (!selectedTeamId) {
      toast.error('Vælg venligst dit team');
      return;
    }

    if (!activeSurvey?.id) {
      toast.error('Ingen aktiv pulsmåling fundet');
      return;
    }

    try {
      await submitSurvey.mutateAsync({
        surveyId: activeSurvey.id,
        selectedTeamId,
        response: {
          ...formData as PulseSurveyResponse,
          nps_comment: npsComment || undefined,
          improvement_suggestions: improvementSuggestions || undefined,
          campaign_improvement_suggestions: campaignImprovementSuggestions || undefined,
        }
      });

      // Delete draft after successful submission
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      deleteDraft.mutate(activeSurvey.id);

      toast.success('Tak for din besvarelse!');
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Der opstod en fejl ved indsendelse');
    }
  };

  if (surveyLoading || completionLoading || draftLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        </div>
      </MainLayout>
    );
  }

  if (!activeSurvey) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Pulsmåling</h1>
            <p className="text-muted-foreground">Månedlig trivselsmåling</p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HeartHandshake className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground text-center">
                Der er ingen aktiv pulsmåling lige nu.<br />
                Næste pulsmåling aktiveres den 15. i måneden.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (hasCompleted) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Pulsmåling</h1>
            <p className="text-muted-foreground">Månedlig trivselsmåling</p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-medium text-center mb-2">
                Tak for din besvarelse!
              </p>
              <p className="text-muted-foreground text-center">
                Du har allerede udfyldt denne måneds pulsmåling.<br />
                Næste pulsmåling aktiveres den 15. i næste måned.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 
    'juli', 'august', 'september', 'oktober', 'november', 'december'];

  return (
    <MainLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Pulsmåling</h1>
          <p className="text-muted-foreground">
            {monthNames[activeSurvey.month - 1]} {activeSurvey.year}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Velkommen til pulsmålingen</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Formålet med denne pulsmåling er at forstå, hvordan du trives, og hvordan vi kan gøre hverdagen og ledelsen endnu bedre i Copenhagen Sales.
              <br /><br />
              Svarene er anonyme og bliver kun brugt til at forbedre vores måde at arbejde og lede på – ikke til at vurdere dig som medarbejder.
              <br /><br />
              <strong>NPS-spørgsmålet bruger skala 0-10. Øvrige spørgsmål bruger skala 1-10.</strong>
              <br /><br />
              <span className="flex items-center gap-1.5 text-sm">
                <Save className="h-4 w-4" />
                Dine svar gemmes automatisk som kladde, så du kan vende tilbage og fortsætte senere.
              </span>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Team Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vælg dit team</CardTitle>
            <CardDescription>Hvilket team arbejder du på?</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg team..." />
              </SelectTrigger>
              <SelectContent>
                {teams?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* NPS Question */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{SCALE_QUESTIONS[0].title}</CardTitle>
            <CardDescription>{SCALE_QUESTIONS[0].question}</CardDescription>
            <p className="text-sm text-muted-foreground">{SCALE_QUESTIONS[0].helpText}</p>
            {SCALE_QUESTIONS[0].extraHelpText && (
              <p className="text-sm text-muted-foreground italic">{SCALE_QUESTIONS[0].extraHelpText}</p>
            )}
            <div className="flex gap-4 text-xs mt-2">
              <span className="text-red-500">0-6: Kritiker</span>
              <span className="text-amber-500">7-8: Passiv</span>
              <span className="text-green-500">9-10: Promoter</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScaleSelector 
              value={formData.nps_score}
              isNps={true}
              onChange={(v) => handleScaleChange('nps_score', v)} 
            />
          </CardContent>
        </Card>

        {/* NPS Comment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Uddybning af NPS</CardTitle>
            <CardDescription>
              Vil du kort uddybe, hvorfor du gav den score?<br />
              (Hvad fungerer godt – og hvad kunne være bedre?)
            </CardDescription>
            <p className="text-sm text-muted-foreground">Valgfrit</p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={npsComment}
              onChange={(e) => setNpsComment(e.target.value)}
              placeholder="Skriv din kommentar her..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Tenure Question */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Anciennitet</CardTitle>
            <CardDescription>Hvor længe har du arbejdet hos Copenhagen Sales?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={formData.tenure}
              onValueChange={(v) => setFormData(prev => ({ ...prev, tenure: v as PulseSurveyResponse['tenure'] }))}
            >
              {TENURE_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value}>{option.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Scale Questions */}
        {SCALE_QUESTIONS.slice(1).map((q) => (
          <Card key={q.key}>
            <CardHeader>
              <CardTitle className="text-lg">{q.title}</CardTitle>
              <CardDescription>{q.question}</CardDescription>
              <p className="text-sm text-muted-foreground">{q.helpText}</p>
            </CardHeader>
            <CardContent>
              <ScaleSelector 
                value={formData[q.key as keyof PulseSurveyResponse] as number} 
                onChange={(v) => handleScaleChange(q.key, v)} 
              />
            </CardContent>
          </Card>
        ))}

        {/* Campaign Improvement Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">16. Kampagneforbedring</CardTitle>
            <CardDescription>
              Hvad bør kunden forbedre for at gøre kampagnen og produkterne lettere at sælge?
            </CardDescription>
            <p className="text-sm text-muted-foreground">Valgfrit</p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={campaignImprovementSuggestions}
              onChange={(e) => setCampaignImprovementSuggestions(e.target.value)}
              placeholder="Skriv dine forslag her..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Improvement Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">17. Forbedringsforslag</CardTitle>
            <CardDescription>
              Har du idéer eller input til, hvad vi kunne gøre bedre i forhold til at arbejde i Copenhagen Sales?<br />
              (Alt er velkomment: ledelse, træning, stemning, rammer, løn/bonus, kommunikation osv.)
            </CardDescription>
            <p className="text-sm text-muted-foreground">Valgfrit</p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={improvementSuggestions}
              onChange={(e) => setImprovementSuggestions(e.target.value)}
              placeholder="Skriv dine forslag her..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={handleSubmit} 
              size="lg" 
              className="w-full"
              disabled={submitSurvey.isPending}
            >
              {submitSurvey.isPending ? 'Indsender...' : 'Indsend besvarelse'}
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Din besvarelse er anonym og kan ikke ændres efter indsendelse.
            </p>
            {draftStatus !== 'idle' && (
              <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1.5">
                <Save className="h-3 w-3" />
                {draftStatus === 'saving' ? 'Gemmer kladde...' : 'Kladde gemt'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
