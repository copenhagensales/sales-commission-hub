import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAllPulseSurveys, usePulseSurveyResults, useActivatePulseSurvey } from "@/hooks/usePulseSurvey";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { TrendingUp, Users, Building, Plus } from "lucide-react";
import { toast } from "sonner";

const QUESTION_LABELS: Record<string, string> = {
  nps_score: 'NPS',
  development_score: 'Udvikling',
  leadership_score: 'Ledelse',
  recognition_score: 'Anerkendelse',
  energy_score: 'Energi',
  seriousness_score: 'Seriøsitet',
  leader_availability_score: 'Leder tid',
  wellbeing_score: 'Trivsel',
  psychological_safety_score: 'Tryghed',
};

const TENURE_LABELS: Record<string, string> = {
  'under_1_month': 'Under 1 måned',
  '1_3_months': '1-3 måneder',
  '3_6_months': '3-6 måneder',
  'over_6_months': 'Over 6 måneder',
};

function calculateAverages(responses: any[]) {
  if (!responses || responses.length === 0) return null;

  const scoreKeys = Object.keys(QUESTION_LABELS);
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
    name: QUESTION_LABELS[key],
    score: value,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 10]} />
        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function PulseSurveyResults() {
  const { data: surveys, isLoading: surveysLoading } = useAllPulseSurveys();
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>();
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const { data: responses, isLoading: responsesLoading } = usePulseSurveyResults(selectedSurveyId);
  const activateSurvey = useActivatePulseSurvey();

  const selectedSurvey = surveys?.find(s => s.id === selectedSurveyId);

  // Get unique departments
  const departments = useMemo(() => {
    if (!responses) return [];
    const depts = [...new Set(responses.map(r => r.department).filter(Boolean))];
    return depts.sort();
  }, [responses]);

  // Filter responses by department
  const filteredResponses = useMemo(() => {
    if (!responses) return [];
    if (selectedDepartment === 'all') return responses;
    return responses.filter(r => r.department === selectedDepartment);
  }, [responses, selectedDepartment]);

  // Calculate averages
  const averages = useMemo(() => calculateAverages(filteredResponses), [filteredResponses]);

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
          <Button onClick={handleActivateSurvey} disabled={activateSurvey.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Aktiver ny pulsmåling
          </Button>
        </div>

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
          
          {departments.length > 0 && (
            <div className="w-48">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg afdeling" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle afdelinger</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                    {selectedDepartment === 'all' ? 'Total' : selectedDepartment}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{averages?.nps_score || '-'}</div>
                  <p className="text-xs text-muted-foreground">Gennemsnit</p>
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
                  <CardTitle className="text-sm font-medium">Afdelinger</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{departments.length || 1}</div>
                  <p className="text-xs text-muted-foreground">Med besvarelser</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Oversigt</TabsTrigger>
                <TabsTrigger value="details">Detaljer</TabsTrigger>
                <TabsTrigger value="comments">Kommentarer</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Gennemsnit pr. spørgsmål</CardTitle>
                    <CardDescription>
                      {selectedDepartment === 'all' ? 'Alle afdelinger' : selectedDepartment} - {filteredResponses.length} besvarelser
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

              <TabsContent value="details" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {averages && Object.entries(averages).map(([key, value]) => (
                    <Card key={key}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{QUESTION_LABELS[key]}</CardTitle>
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
                            {r.department && <Badge variant="secondary">{r.department}</Badge>}
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
                          {r.department && (
                            <Badge variant="secondary" className="mb-2">{r.department}</Badge>
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
