import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useActivePulseSurvey, useHasCompletedSurvey, useSubmitPulseSurvey, PulseSurveyResponse } from "@/hooks/usePulseSurvey";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, HeartHandshake } from "lucide-react";

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
    question: 'Hvor sandsynligt er det, at du vil anbefale Copenhagen Sales som arbejdsplads til en ven eller bekendt?',
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

  // Get employee department
  const { data: employee } = useQuery({
    queryKey: ['employee-for-pulse', user?.email],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_master_data')
        .select('id, department')
        .eq('private_email', user?.email)
        .single();
      return data;
    },
    enabled: !!user?.email
  });

  const [formData, setFormData] = useState<Partial<PulseSurveyResponse>>({});
  const [npsComment, setNpsComment] = useState('');
  const [improvementSuggestions, setImprovementSuggestions] = useState('');

  const handleScaleChange = (key: string, value: number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    const requiredScales = ['nps_score', 'development_score', 'leadership_score', 'recognition_score', 
      'energy_score', 'seriousness_score', 'leader_availability_score', 'wellbeing_score', 'psychological_safety_score'];
    
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

    if (!activeSurvey?.id) {
      toast.error('Ingen aktiv pulsmåling fundet');
      return;
    }

    try {
      await submitSurvey.mutateAsync({
        surveyId: activeSurvey.id,
        response: {
          ...formData as PulseSurveyResponse,
          nps_comment: npsComment || undefined,
          improvement_suggestions: improvementSuggestions || undefined,
        },
        department: employee?.department || undefined
      });

      toast.success('Tak for din besvarelse!');
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Der opstod en fejl ved indsendelse');
    }
  };

  if (surveyLoading || completionLoading) {
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
            </CardDescription>
          </CardHeader>
        </Card>

        {/* NPS Question */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{SCALE_QUESTIONS[0].title}</CardTitle>
            <CardDescription>{SCALE_QUESTIONS[0].question}</CardDescription>
            <p className="text-sm text-muted-foreground">{SCALE_QUESTIONS[0].helpText}</p>
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
              disabled={submitSurvey.isPending}
            >
              {submitSurvey.isPending ? 'Indsender...' : 'Indsend besvarelse'}
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Din besvarelse er anonym og kan ikke ændres efter indsendelse.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
