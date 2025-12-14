import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, HeartHandshake } from "lucide-react";
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

const DEFAULT_QUESTIONS: PulseSurveyQuestion[] = [
  { id: "nps_score", label: "1. NPS / anbefaling", question: "Hvor sandsynligt er det, at du vil anbefale Copenhagen Sales som arbejdsplads til en ven eller bekendt?", type: "rating", min: 0, max: 10 },
  { id: "development_score", label: "4. Udvikling og træning", question: "I hvor høj grad oplever du, at du bliver uddannet, trænet og udviklet som sælger i dit team?", type: "rating", min: 1, max: 10 },
  { id: "leadership_score", label: "5. Teamlederens ledelse", question: "Hvor tilfreds er du med den måde, din teamleder leder teamet på?", type: "rating", min: 1, max: 10 },
  { id: "recognition_score", label: "6. Anerkendelse og belønning", question: "I hvor høj grad oplever du, at dine præstationer bliver anerkendt og belønnet på en fair måde?", type: "rating", min: 1, max: 10 },
  { id: "energy_score", label: "7. Energi og stemning", question: "Hvordan vil du vurdere energien og stemningen i dit team lige nu?", type: "rating", min: 1, max: 10 },
  { id: "seriousness_score", label: "8. Seriøsitet i arbejdet", question: "I hvor høj grad oplever du, at der arbejdes seriøst og målrettet i dit team?", type: "rating", min: 1, max: 10 },
  { id: "leader_availability_score", label: "9. Lederens tid og overskud", question: "I hvor høj grad oplever du, at din leder har tid og overskud til dig, når du har brug for det?", type: "rating", min: 1, max: 10 },
  { id: "wellbeing_score", label: "10. Samlet trivsel", question: "Hvor godt trives du samlet set i Copenhagen Sales lige nu?", type: "rating", min: 1, max: 10 },
  { id: "psychological_safety_score", label: "11. Psykologisk tryghed", question: "I hvor høj grad føler du dig tryg ved at sige din ærlige mening i teamet – også når du er uenig eller har kritik?", type: "rating", min: 1, max: 10 },
];

function ScaleSelector({ value, onChange, isNps = false }: { value: number | undefined; onChange: (v: number) => void; isNps?: boolean }) {
  const scale = isNps ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  const getNpsColor = (num: number) => {
    if (num <= 6) return 'bg-red-500 text-white';
    if (num <= 8) return 'bg-amber-500 text-white';
    return 'bg-green-500 text-white';
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

export default function PublicPulseSurvey() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<PulseSurveyResponse>>({});
  const [npsComment, setNpsComment] = useState('');
  const [improvementSuggestions, setImprovementSuggestions] = useState('');

  // Fetch template questions from database
  const { data: template } = useQuizTemplate("pulse_survey");
  
  const questions = useMemo(() => {
    if (template?.questions && Array.isArray(template.questions) && template.questions.length > 0) {
      return template.questions as PulseSurveyQuestion[];
    }
    return DEFAULT_QUESTIONS;
  }, [template]);

  const npsQuestion = useMemo(() => questions.find(q => q.id === 'nps_score') || questions[0], [questions]);
  const otherQuestions = useMemo(() => questions.filter(q => q.id !== 'nps_score'), [questions]);

  // Fetch active survey
  const { data: activeSurvey, isLoading: surveyLoading } = useQuery({
    queryKey: ['public-active-survey'],
    queryFn: async () => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      const { data, error } = await supabase
        .from('pulse_surveys')
        .select('*')
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch teams
  const { data: teams } = useQuery({
    queryKey: ['public-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Submit mutation via edge function
  const submitMutation = useMutation({
    mutationFn: async (response: PulseSurveyResponse & { teamId: string; surveyId: string }) => {
      const teamName = teams?.find(t => t.id === response.teamId)?.name || 'Ukendt';
      
      const res = await supabase.functions.invoke('submit-pulse-survey', {
        body: {
          survey_id: response.surveyId,
          nps_score: response.nps_score,
          tenure: response.tenure,
          development_score: response.development_score,
          leadership_score: response.leadership_score,
          recognition_score: response.recognition_score,
          energy_score: response.energy_score,
          seriousness_score: response.seriousness_score,
          leader_availability_score: response.leader_availability_score,
          wellbeing_score: response.wellbeing_score,
          psychological_safety_score: response.psychological_safety_score,
          nps_comment: response.nps_comment || null,
          improvement_suggestions: response.improvement_suggestions || null,
          submitted_team_id: response.teamId,
          department: teamName,
        }
      });
      
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      
      return res.data;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Tak for din besvarelse!');
    },
    onError: (error: any) => {
      console.error('Error submitting survey:', error);
      toast.error('Fejl ved indsendelse - prøv igen');
    }
  });

  const handleScaleChange = (key: string, value: number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Validate team selection
    if (!selectedTeamId) {
      toast.error('Vælg venligst dit team');
      return;
    }

    // Validate required fields
    const requiredScales = ['nps_score', 'development_score', 'leadership_score', 'recognition_score', 
      'energy_score', 'seriousness_score', 'leader_availability_score', 'wellbeing_score', 'psychological_safety_score'];
    
    for (const key of requiredScales) {
      if (formData[key as keyof PulseSurveyResponse] === undefined) {
        toast.error('Besvar venligst alle obligatoriske spørgsmål');
        return;
      }
    }

    if (!formData.tenure) {
      toast.error('Vælg venligst din anciennitet');
      return;
    }

    if (!activeSurvey?.id) {
      toast.error('Ingen aktiv pulsmåling fundet');
      return;
    }

    submitMutation.mutate({
      ...formData as PulseSurveyResponse,
      nps_comment: npsComment || undefined,
      improvement_suggestions: improvementSuggestions || undefined,
      teamId: selectedTeamId,
      surveyId: activeSurvey.id,
    });
  };

  if (surveyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
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
                Der er ingen aktiv pulsmåling lige nu.<br />
                Næste pulsmåling aktiveres den 15. i måneden.
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
              <p className="text-lg font-medium text-center mb-2">
                Tak for din besvarelse!
              </p>
              <p className="text-muted-foreground text-center">
                Din feedback er vigtig for os.
              </p>
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
      <div className="space-y-6 max-w-3xl mx-auto py-8">
        <div className="text-center">
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
            <CardTitle className="text-lg">{npsQuestion.label}</CardTitle>
            <CardDescription>{npsQuestion.question}</CardDescription>
            <p className="text-sm text-muted-foreground">
              {npsQuestion.min} = Slet ikke sandsynligt, {npsQuestion.max} = Meget sandsynligt
            </p>
            <div className="flex gap-4 text-xs mt-2">
              <span className="text-red-500">0-6: Kritiker</span>
              <span className="text-amber-500">7-8: Passiv</span>
              <span className="text-green-500">9-10: Promoter</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScaleSelector 
              value={formData.nps_score as number}
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
                  <RadioGroupItem value={option.value} id={`public-${option.value}`} />
                  <Label htmlFor={`public-${option.value}`}>{option.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Scale Questions */}
        {otherQuestions.map((q) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-lg">{q.label}</CardTitle>
              <CardDescription>{q.question}</CardDescription>
              <p className="text-sm text-muted-foreground">
                {q.min} = Slet ikke, {q.max} = I meget høj grad
              </p>
            </CardHeader>
            <CardContent>
              <ScaleSelector 
                value={formData[q.id] as number} 
                onChange={(v) => handleScaleChange(q.id, v)} 
              />
            </CardContent>
          </Card>
        ))}

        {/* Improvement Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">12. Forbedringsforslag</CardTitle>
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
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Indsender...' : 'Indsend besvarelse'}
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Din besvarelse er anonym og kan ikke ændres efter indsendelse.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
