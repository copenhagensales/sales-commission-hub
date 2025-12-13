import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAllPulseSurveys, usePulseSurveyResults, useActivatePulseSurvey } from "@/hooks/usePulseSurvey";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Building, Plus, Info, Link, Copy, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { TeamComparisonBarChart } from "@/components/pulse-survey/TeamComparisonBarChart";
import { TeamRadarChart } from "@/components/pulse-survey/TeamRadarChart";
import { TeamHeatmap } from "@/components/pulse-survey/TeamHeatmap";
import { TeamComparisonLineChart } from "@/components/pulse-survey/TeamComparisonLineChart";
import { PulseSurveyEditor } from "@/components/quiz-admin/PulseSurveyEditor";
import { useQuizTemplate, useUpdateQuizTemplate, PulseSurveyQuestion } from "@/hooks/useQuizTemplates";

const QUESTION_DATA: Record<string, { label: string; fullQuestion: string }> = {
  nps_score: { 
    label: 'NPS', 
    fullQuestion: 'Hvor sandsynligt er det, at du vil anbefale Copenhagen Sales som arbejdsplads til en ven eller bekendt?' 
  },
  development_score: { 
    label: 'Udvikling', 
    fullQuestion: 'I hvor høj grad oplever du, at du bliver uddannet, trænet og udviklet som sælger i dit team?' 
  },
  leadership_score: { 
    label: 'Ledelse', 
    fullQuestion: 'Hvor tilfreds er du med den måde, din teamleder leder teamet på?' 
  },
  recognition_score: { 
    label: 'Anerkendelse', 
    fullQuestion: 'I hvor høj grad oplever du, at dine præstationer bliver anerkendt og belønnet på en fair måde?' 
  },
  energy_score: { 
    label: 'Energi', 
    fullQuestion: 'Hvordan vil du vurdere energien og stemningen i dit team lige nu?' 
  },
  seriousness_score: { 
    label: 'Seriøsitet', 
    fullQuestion: 'I hvor høj grad oplever du, at der arbejdes seriøst og målrettet i dit team?' 
  },
  leader_availability_score: { 
    label: 'Leder tid', 
    fullQuestion: 'I hvor høj grad oplever du, at din leder har tid og overskud til dig, når du har brug for det?' 
  },
  wellbeing_score: { 
    label: 'Trivsel', 
    fullQuestion: 'Hvor godt trives du samlet set i Copenhagen Sales lige nu?' 
  },
  psychological_safety_score: { 
    label: 'Tryghed', 
    fullQuestion: 'I hvor høj grad føler du dig tryg ved at sige din ærlige mening i teamet – også når du er uenig eller har kritik?' 
  },
};

const TENURE_LABELS: Record<string, string> = {
  'under_1_month': 'Under 1 måned',
  '1_3_months': '1-3 måneder',
  '3_6_months': '3-6 måneder',
  'over_6_months': 'Over 6 måneder',
};

function calculateNpsScore(responses: any[]) {
  if (!responses || responses.length === 0) return null;
  
  const npsValues = responses.map(r => r.nps_score).filter(v => typeof v === 'number');
  if (npsValues.length === 0) return null;
  
  const promoters = npsValues.filter(v => v >= 9).length;
  const detractors = npsValues.filter(v => v <= 6).length;
  const total = npsValues.length;
  
  const nps = Math.round(((promoters / total) - (detractors / total)) * 100);
  
  return {
    nps,
    promoters: Math.round((promoters / total) * 100),
    passives: Math.round(((total - promoters - detractors) / total) * 100),
    detractors: Math.round((detractors / total) * 100),
    totalResponses: total
  };
}

function calculateAverages(responses: any[]) {
  if (!responses || responses.length === 0) return null;

  const scoreKeys = Object.keys(QUESTION_DATA).filter(k => k !== 'nps_score');
  const averages: Record<string, number> = {};

  scoreKeys.forEach(key => {
    const values = responses.map(r => r[key]).filter(v => typeof v === 'number');
    if (values.length > 0) {
      averages[key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    }
  });

  return averages;
}

function AveragesChart({ averages }: { averages: Record<string, number> | null }) {
  if (!averages) return <p className="text-muted-foreground">Ingen data</p>;

  const data = Object.entries(averages).map(([key, value]) => ({
    name: QUESTION_DATA[key]?.label || key,
    fullQuestion: QUESTION_DATA[key]?.fullQuestion || '',
    score: value,
  }));

  return (
    <TooltipProvider>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 10]} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
          <ChartTooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-popover border rounded-lg p-3 shadow-lg max-w-xs">
                    <p className="font-medium text-sm">{data.name}: {data.score}</p>
                    <p className="text-xs text-muted-foreground mt-1">{data.fullQuestion}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </TooltipProvider>
  );
}

// Default pulse survey questions
const DEFAULT_PULSE_QUESTIONS: PulseSurveyQuestion[] = [
  { id: 'nps_score', label: 'NPS', question: 'Hvor sandsynligt er det, at du vil anbefale Copenhagen Sales som arbejdsplads til en ven eller bekendt?', type: 'rating', min: 0, max: 10 },
  { id: 'development_score', label: 'Udvikling', question: 'I hvor høj grad oplever du, at du bliver uddannet, trænet og udviklet som sælger i dit team?', type: 'rating', min: 1, max: 10 },
  { id: 'leadership_score', label: 'Ledelse', question: 'Hvor tilfreds er du med den måde, din teamleder leder teamet på?', type: 'rating', min: 1, max: 10 },
  { id: 'recognition_score', label: 'Anerkendelse', question: 'I hvor høj grad oplever du, at dine præstationer bliver anerkendt og belønnet på en fair måde?', type: 'rating', min: 1, max: 10 },
  { id: 'energy_score', label: 'Energi', question: 'Hvordan vil du vurdere energien og stemningen i dit team lige nu?', type: 'rating', min: 1, max: 10 },
  { id: 'seriousness_score', label: 'Seriøsitet', question: 'I hvor høj grad oplever du, at der arbejdes seriøst og målrettet i dit team?', type: 'rating', min: 1, max: 10 },
  { id: 'leader_availability_score', label: 'Leder tid', question: 'I hvor høj grad oplever du, at din leder har tid og overskud til dig, når du har brug for det?', type: 'rating', min: 1, max: 10 },
  { id: 'wellbeing_score', label: 'Trivsel', question: 'Hvor godt trives du samlet set i Copenhagen Sales lige nu?', type: 'rating', min: 1, max: 10 },
  { id: 'psychological_safety_score', label: 'Tryghed', question: 'I hvor høj grad føler du dig tryg ved at sige din ærlige mening i teamet – også når du er uenig eller har kritik?', type: 'rating', min: 1, max: 10 },
];

export default function PulseSurveyResults() {
  const { data: surveys, isLoading: surveysLoading } = useAllPulseSurveys();
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const { data: responses, isLoading: responsesLoading } = usePulseSurveyResults(selectedSurveyId);
  const activateSurvey = useActivatePulseSurvey();
  const [linkCopied, setLinkCopied] = useState(false);

  // Template editing
  const { data: template, isLoading: templateLoading } = useQuizTemplate('pulse_survey');
  const updateTemplate = useUpdateQuizTemplate();
  const [templateQuestions, setTemplateQuestions] = useState<PulseSurveyQuestion[]>([]);
  const [templateInitialized, setTemplateInitialized] = useState(false);

  // Initialize template questions from DB or defaults
  useMemo(() => {
    if (!templateInitialized && !templateLoading) {
      if (template?.questions && Array.isArray(template.questions) && template.questions.length > 0) {
        setTemplateQuestions(template.questions as PulseSurveyQuestion[]);
      } else {
        setTemplateQuestions(DEFAULT_PULSE_QUESTIONS);
      }
      setTemplateInitialized(true);
    }
  }, [template, templateLoading, templateInitialized]);

  const handleSaveTemplate = () => {
    updateTemplate.mutate({
      quizType: 'pulse_survey',
      questions: templateQuestions,
    });
  };

  const publicSurveyLink = 'https://sales-sync-pay.lovable.app/survey';

  // Fetch all teams
  const { data: teams } = useQuery({
    queryKey: ['teams-for-pulse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const selectedSurvey = surveys?.find(s => s.id === selectedSurveyId);

  // Get teams that have responses (check both team_id and submitted_team_id)
  const teamsWithResponses = useMemo(() => {
    if (!responses || !teams) return [];
    const teamIds = new Set(responses.map(r => r.team_id || r.submitted_team_id).filter(Boolean));
    return teams.filter(t => teamIds.has(t.id));
  }, [responses, teams]);

  // Filter responses by team (check both team_id and submitted_team_id)
  const filteredResponses = useMemo(() => {
    if (!responses) return [];
    if (selectedTeamId === 'all') return responses;
    return responses.filter(r => (r.team_id || r.submitted_team_id) === selectedTeamId);
  }, [responses, selectedTeamId]);

  // Normalize responses to always have team_id populated for charts
  const normalizedResponses = useMemo(() => {
    return responses?.map(r => ({
      ...r,
      team_id: r.team_id || r.submitted_team_id
    })) || [];
  }, [responses]);

  // Calculate averages
  const averages = useMemo(() => calculateAverages(filteredResponses), [filteredResponses]);
  const npsData = useMemo(() => calculateNpsScore(filteredResponses), [filteredResponses]);

  // Calculate tenure distribution
  const tenureDistribution = useMemo(() => {
    if (!filteredResponses || filteredResponses.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredResponses.forEach(r => {
      counts[r.tenure] = (counts[r.tenure] || 0) + 1;
    });
    return Object.entries(counts).map(([tenure, count]) => ({
      name: TENURE_LABELS[tenure] || tenure,
      count,
    }));
  }, [filteredResponses]);

  // Trend data (last 6 months)
  const trendData = useMemo(() => {
    if (!surveys) return [];
    
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 
      'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    
    return surveys
      .slice(0, 6)
      .reverse()
      .map(s => ({
        month: `${monthNames[s.month - 1]} ${s.year}`,
        // Note: We'd need to fetch responses for each survey to show real trend data
        // For now, just show placeholder
      }));
  }, [surveys]);

  const handleActivateSurvey = async () => {
    try {
      await activateSurvey.mutateAsync();
      toast.success('Pulsmåling aktiveret for denne måned');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Der findes allerede en pulsmåling for denne måned');
      } else {
        toast.error('Kunne ikke aktivere pulsmåling');
      }
    }
  };

  // Auto-select first survey
  if (surveys?.length && !selectedSurveyId) {
    setSelectedSurveyId(surveys[0].id);
  }

  const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 
    'juli', 'august', 'september', 'oktober', 'november', 'december'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Pulsmåling resultater</h1>
            <p className="text-muted-foreground">Anonymiseret oversigt over medarbejdertrivsel</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleActivateSurvey} disabled={activateSurvey.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Aktiver ny pulsmåling
            </Button>
          </div>
        </div>

        {/* Shareable Link */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4" />
              Delebart link til pulsmåling
            </CardTitle>
            <CardDescription>
              Del dette link med medarbejdere, så de kan udfylde pulsmålingen uden at logge ind
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input 
                readOnly 
                value={publicSurveyLink} 
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(publicSurveyLink);
                  setLinkCopied(true);
                  toast.success('Link kopieret!');
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
              >
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg måned" />
              </SelectTrigger>
              <SelectContent>
                {surveys?.map((survey) => (
                  <SelectItem key={survey.id} value={survey.id}>
                    {monthNames[survey.month - 1]} {survey.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-48">
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle teams (samlet)</SelectItem>
                {teamsWithResponses.map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {responsesLoading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Indlæser resultater...</p>
            </CardContent>
          </Card>
        ) : !responses || responses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Ingen besvarelser for denne måned endnu.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Besvarelser</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredResponses.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {selectedTeamId === 'all' ? 'Alle teams' : teamsWithResponses.find(t => t.id === selectedTeamId)?.name}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${npsData ? (npsData.nps >= 50 ? 'text-green-500' : npsData.nps >= 0 ? 'text-amber-500' : 'text-red-500') : ''}`}>
                    {npsData?.nps ?? '-'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {npsData ? `${npsData.promoters}% promoters - ${npsData.detractors}% detractors` : 'NPS score'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Trivsel</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{averages?.wellbeing_score || '-'}</div>
                  <p className="text-xs text-muted-foreground">Gennemsnit</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Teams</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{teamsWithResponses.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Med besvarelser</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Oversigt</TabsTrigger>
                <TabsTrigger value="team-comparison">Team sammenligning</TabsTrigger>
                <TabsTrigger value="details">Detaljer</TabsTrigger>
                <TabsTrigger value="comments">Kommentarer</TabsTrigger>
                <TabsTrigger value="template" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Skabelon
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Gennemsnit pr. spørgsmål</CardTitle>
                  <CardDescription>
                    {selectedTeamId === 'all' ? 'Alle teams' : teamsWithResponses.find(t => t.id === selectedTeamId)?.name} - {filteredResponses.length} besvarelser
                  </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AveragesChart averages={averages} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Anciennitet fordeling</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4">
                      {tenureDistribution.map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <Badge variant="secondary">{item.count}</Badge>
                          <span className="text-sm">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team-comparison" className="space-y-4">
                {teamsWithResponses.length < 2 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">
                        Der kræves mindst 2 teams med besvarelser for at sammenligne.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <TeamComparisonLineChart 
                      responses={normalizedResponses} 
                      teams={teams || []} 
                      questionData={QUESTION_DATA} 
                    />
                    <TeamHeatmap 
                      responses={normalizedResponses} 
                      teams={teams || []} 
                      questionData={QUESTION_DATA} 
                    />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <TeamComparisonBarChart 
                        responses={normalizedResponses} 
                        teams={teams || []} 
                        questionData={QUESTION_DATA} 
                      />
                      <TeamRadarChart 
                        responses={normalizedResponses} 
                        teams={teams || []} 
                        questionData={QUESTION_DATA} 
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <TooltipProvider>
                  <div className="grid gap-4 md:grid-cols-3">
                    {averages && Object.entries(averages).map(([key, value]) => (
                      <Card key={key}>
                        <CardHeader className="pb-2">
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <CardTitle className="text-sm font-medium flex items-center gap-1 cursor-help">
                                {QUESTION_DATA[key]?.label || key}
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </CardTitle>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-sm">{QUESTION_DATA[key]?.fullQuestion}</p>
                            </TooltipContent>
                          </UITooltip>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">{value}</span>
                            <span className="text-muted-foreground">/ 10</span>
                          </div>
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all" 
                              style={{ width: `${(value / 10) * 100}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TooltipProvider>
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                {/* NPS Comments */}
                <Card>
                  <CardHeader>
                    <CardTitle>NPS uddybninger</CardTitle>
                    <CardDescription>Anonyme kommentarer til NPS score</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {filteredResponses
                      .filter(r => r.nps_comment)
                      .map((r, i) => (
                        <div key={i} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">NPS: {r.nps_score}</Badge>
                            {(r.team_id || r.submitted_team_id) && teams && (
                              <Badge variant="secondary">
                                {teams.find(t => t.id === (r.team_id || r.submitted_team_id))?.name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{r.nps_comment}</p>
                        </div>
                      ))}
                    {filteredResponses.filter(r => r.nps_comment).length === 0 && (
                      <p className="text-muted-foreground text-sm">Ingen kommentarer</p>
                    )}
                  </CardContent>
                </Card>

                {/* Improvement Suggestions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Forbedringsforslag</CardTitle>
                    <CardDescription>Anonyme forslag til forbedringer</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {filteredResponses
                      .filter(r => r.improvement_suggestions)
                      .map((r, i) => (
                        <div key={i} className="p-3 bg-muted rounded-lg">
                          {(r.team_id || r.submitted_team_id) && teams && (
                            <Badge variant="secondary" className="mb-2">
                              {teams.find(t => t.id === (r.team_id || r.submitted_team_id))?.name}
                            </Badge>
                          )}
                          <p className="text-sm">{r.improvement_suggestions}</p>
                        </div>
                      ))}
                    {filteredResponses.filter(r => r.improvement_suggestions).length === 0 && (
                      <p className="text-muted-foreground text-sm">Ingen forslag</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="template" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Spørgsmålsskabelon</CardTitle>
                    <CardDescription>Rediger spørgsmålene der bruges i pulsmålingen</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {templateLoading ? (
                      <p className="text-muted-foreground">Indlæser skabelon...</p>
                    ) : (
                      <PulseSurveyEditor
                        questions={templateQuestions}
                        onChange={setTemplateQuestions}
                        onSave={handleSaveTemplate}
                        isSaving={updateTemplate.isPending}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Anonymity warning */}
            {filteredResponses.length < 5 && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="py-4">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    <strong>Bemærk:</strong> Med færre end 5 besvarelser kan anonymiteten være kompromitteret. 
                    Overvej at vise data samlet med andre afdelinger.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
