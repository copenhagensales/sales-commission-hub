import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, HeartHandshake, Shield, Clock, BarChart3 } from "lucide-react";
import { useQuizTemplate, PulseSurveyQuestion } from "@/hooks/useQuizTemplates";

interface PulseSurveyResponse {
  nps_score: number;
  tenure: 'under_1_month' | '1_3_months' | '3_6_months' | 'over_6_months';
  [key: string]: number | string | undefined;
}

const TENURE_OPTIONS = [
  { value: 'under_1_month', label: 'Under 1 måned' },
  { value: '1_3_months', label: '1–3 måneder' },
  { value: '3_6_months', label: '3–6 måneder' },
  { value: 'over_6_months', label: 'Over 6 måneder' },
];

// Section definitions for grouping questions
const SECTION_CONFIG = [
  { id: 'leadership', title: 'Ledelse og udvikling', icon: '📊', questionIds: ['development_score', 'leadership_score', 'recognition_score', 'leader_availability_score'] },
  { id: 'wellbeing', title: 'Trivsel og kultur', icon: '💚', questionIds: ['energy_score', 'seriousness_score', 'wellbeing_score', 'psychological_safety_score'] },
  { id: 'product', title: 'Produkt og kampagne', icon: '🎯', questionIds: ['product_competitiveness_score', 'market_fit_score', 'interest_creation_score', 'campaign_attractiveness_score'] },
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

export default function PublicPulseSurvey() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<PulseSurveyResponse>>({});
  const [npsComment, setNpsComment] = useState('');
  const [improvementSuggestions, setImprovementSuggestions] = useState('');
  const [campaignImprovementSuggestions, setCampaignImprovementSuggestions] = useState('');

  const { data: template, isLoading: templateLoading } = useQuizTemplate("pulse_survey");
  
  const questions = useMemo(() => {
    if (template?.questions && Array.isArray(template.questions) && template.questions.length > 0) {
      return template.questions as PulseSurveyQuestion[];
    }
    return [];
  }, [template]);

  const npsQuestion = useMemo(() => questions.find(q => q.id === 'nps_score') || questions[0], [questions]);
  const otherQuestions = useMemo(() => questions.filter(q => q.id !== 'nps_score'), [questions]);

  // Group questions into sections
  const sections = useMemo(() => {
    return SECTION_CONFIG.map(section => ({
      ...section,
      questions: section.questionIds
        .map(id => otherQuestions.find(q => q.id === id))
        .filter(Boolean) as PulseSurveyQuestion[],
    })).filter(s => s.questions.length > 0);
  }, [otherQuestions]);

  // Ungrouped questions (not in any section)
  const groupedIds = SECTION_CONFIG.flatMap(s => s.questionIds);
  const ungroupedQuestions = useMemo(() => otherQuestions.filter(q => !groupedIds.includes(q.id)), [otherQuestions]);

  // Progress calculation
  const totalFields = useMemo(() => questions.length + 1 + 1, [questions]); // all scale questions + tenure + team
  const filledFields = useMemo(() => {
    let count = 0;
    questions.forEach(q => { if (formData[q.id] !== undefined) count++; });
    if (formData.tenure) count++;
    if (selectedTeamId) count++;
    return count;
  }, [formData, selectedTeamId, questions]);
  const progressPercent = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  const { data: activeSurvey, isLoading: surveyLoading } = useQuery({
    queryKey: ['public-active-survey'],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from('pulse_surveys')
        .select('*')
        .eq('year', now.getFullYear())
        .eq('month', now.getMonth() + 1)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const HIDDEN_PULSE_TEAMS = ['Fieldmarketing', 'Stab'];
  const { data: teams } = useQuery({
    queryKey: ['public-teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('id, name').order('name');
      if (error) throw error;
      return (data || []).filter(t => !HIDDEN_PULSE_TEAMS.includes(t.name));
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (response: PulseSurveyResponse & { teamId: string; surveyId: string }) => {
      const teamName = teams?.find(t => t.id === response.teamId)?.name || 'Ukendt';
      const { teamId, surveyId, tenure, nps_comment, improvement_suggestions, campaign_improvement_suggestions, ...scores } = response;
      const res = await supabase.functions.invoke('submit-pulse-survey', {
        body: {
          survey_id: surveyId, tenure, nps_comment: nps_comment || null,
          improvement_suggestions: improvement_suggestions || null,
          campaign_improvement_suggestions: campaign_improvement_suggestions || null,
          submitted_team_id: teamId, department: teamName, ...scores,
        }
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => { setSubmitted(true); toast.success('Tak for din besvarelse!'); },
    onError: (error: any) => { console.error('Error submitting survey:', error); toast.error('Fejl ved indsendelse - prøv igen'); }
  });

  const handleScaleChange = (key: string, value: number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedTeamId) { toast.error('Vælg venligst dit team'); return; }
    const requiredScales = questions.map(q => q.id);
    for (const key of requiredScales) {
      if (formData[key as keyof PulseSurveyResponse] === undefined) {
        toast.error('Besvar venligst alle obligatoriske spørgsmål'); return;
      }
    }
    if (!formData.tenure) { toast.error('Vælg venligst din anciennitet'); return; }
    if (!activeSurvey?.id) { toast.error('Ingen aktiv pulsmåling fundet'); return; }

    submitMutation.mutate({
      ...formData as PulseSurveyResponse,
      nps_comment: npsComment || undefined,
      improvement_suggestions: improvementSuggestions || undefined,
      campaign_improvement_suggestions: campaignImprovementSuggestions || undefined,
      teamId: selectedTeamId,
      surveyId: activeSurvey.id,
    });
  };

  if (surveyLoading || templateLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto py-12">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HeartHandshake className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground text-center">
                Pulsmålingen er ikke konfigureret endnu.<br />Kontakt venligst en administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!activeSurvey) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto py-12">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HeartHandshake className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground text-center">
                Der er ingen aktiv pulsmåling lige nu.<br />Næste pulsmåling aktiveres den 15. i måneden.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto py-12">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-medium text-center mb-2">Tak for din besvarelse!</p>
              <p className="text-muted-foreground text-center">Din feedback er vigtig for os.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 
    'juli', 'august', 'september', 'oktober', 'november', 'december'];

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Sticky progress bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm pb-3 pt-2 -mx-4 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-1.5">
            <span>Fremgang</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      <div className="space-y-6 max-w-3xl mx-auto py-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Pulsmåling</h1>
          <p className="text-muted-foreground">{monthNames[activeSurvey.month - 1]} {activeSurvey.year}</p>
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
            </div>
          </CardContent>
        </Card>

        {/* Section 1: Din baggrund (Team + Tenure) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              👤 Din baggrund
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Team */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hvilket team arbejder du på? <span className="text-destructive">*</span></Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams?.map((team) => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border" />

            {/* Tenure */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hvor længe har du arbejdet hos Copenhagen Sales?</Label>
              <RadioGroup
                value={formData.tenure}
                onValueChange={(v) => setFormData(prev => ({ ...prev, tenure: v as PulseSurveyResponse['tenure'] }))}
              >
                {TENURE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`public-${option.value}`} />
                    <Label htmlFor={`public-${option.value}`}>{option.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Anbefaling (NPS + comment) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              ⭐ Anbefaling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* NPS */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{npsQuestion?.question}</Label>
              <ScaleSelector 
                value={formData.nps_score as number}
                isNps={true}
                onChange={(v) => handleScaleChange('nps_score', v)}
                lowLabel="Slet ikke sandsynligt"
                highLabel="Meget sandsynligt"
              />
            </div>

            <div className="border-t border-border" />

            {/* NPS Comment */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Vil du kort uddybe, hvorfor du gav den score?
                <span className="text-muted-foreground font-normal ml-1">(valgfrit)</span>
              </Label>
              <Textarea
                value={npsComment}
                onChange={(e) => setNpsComment(e.target.value)}
                placeholder="Hvad fungerer godt – og hvad kunne være bedre?"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic sections */}
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {section.icon} {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {section.questions.map((q, idx) => (
                <div key={q.id}>
                  {idx > 0 && <div className="border-t border-border mb-6" />}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{q.question}</Label>
                    <ScaleSelector
                      value={formData[q.id] as number}
                      onChange={(v) => handleScaleChange(q.id, v)}
                      lowLabel={`${q.min} = Slet ikke`}
                      highLabel={`${q.max} = I meget høj grad`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Ungrouped questions */}
        {ungroupedQuestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Øvrige spørgsmål</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {ungroupedQuestions.map((q, idx) => (
                <div key={q.id}>
                  {idx > 0 && <div className="border-t border-border mb-6" />}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{q.question}</Label>
                    <ScaleSelector
                      value={formData[q.id] as number}
                      onChange={(v) => handleScaleChange(q.id, v)}
                      lowLabel={`${q.min} = Slet ikke`}
                      highLabel={`${q.max} = I meget høj grad`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Section: Afsluttende (open text + submit) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              💬 Dine forslag
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Campaign improvement */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Hvad bør kunden forbedre for at gøre kampagnen og produkterne lettere at sælge?
                <span className="text-muted-foreground font-normal ml-1">(valgfrit)</span>
              </Label>
              <Textarea
                value={campaignImprovementSuggestions}
                onChange={(e) => setCampaignImprovementSuggestions(e.target.value)}
                placeholder="Skriv dine forslag her..."
                rows={3}
              />
            </div>

            <div className="border-t border-border" />

            {/* General improvement */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Har du idéer til, hvad vi kunne gøre bedre i Copenhagen Sales?
                <span className="text-muted-foreground font-normal ml-1">(valgfrit)</span>
              </Label>
              <p className="text-xs text-muted-foreground">Ledelse, træning, stemning, rammer, løn/bonus, kommunikation – alt er velkomment.</p>
              <Textarea
                value={improvementSuggestions}
                onChange={(e) => setImprovementSuggestions(e.target.value)}
                placeholder="Skriv dine forslag her..."
                rows={3}
              />
            </div>

            <div className="border-t border-border" />

            {/* Submit */}
            <div>
              <Button 
                onClick={handleSubmit} 
                size="lg" 
                className="w-full"
                disabled={submitMutation.isPending || !selectedTeamId}
              >
                {submitMutation.isPending ? 'Indsender...' : 'Indsend besvarelse'}
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-3">
                Din besvarelse er anonym og kan ikke ændres efter indsendelse.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
