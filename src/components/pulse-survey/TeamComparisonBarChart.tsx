import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

interface TeamComparisonBarChartProps {
  responses: any[];
  teams: { id: string; name: string }[];
  questionData: Record<string, { label: string; fullQuestion: string }>;
}

export function TeamComparisonBarChart({ responses, teams, questionData }: TeamComparisonBarChartProps) {
  const chartData = useMemo(() => {
    if (!responses || responses.length === 0 || !teams || teams.length === 0) return [];

    const scoreKeys = Object.keys(questionData).filter(k => k !== 'nps_score');
    
    // Calculate averages per team per question
    const teamAverages: Record<string, Record<string, number>> = {};
    const overallAverages: Record<string, number[]> = {};
    
    // Get teams with responses
    const teamsWithResponses = teams.filter(team => 
      responses.some(r => r.team_id === team.id)
    );

    teamsWithResponses.forEach(team => {
      const teamResponses = responses.filter(r => r.team_id === team.id);
      teamAverages[team.id] = {};
      
      scoreKeys.forEach(key => {
        const values = teamResponses.map(r => r[key]).filter(v => typeof v === 'number');
        if (values.length > 0) {
          const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
          teamAverages[team.id][key] = avg;
          
          if (!overallAverages[key]) overallAverages[key] = [];
          overallAverages[key].push(avg);
        }
      });
    });

    // Build chart data
    return scoreKeys.map(key => {
      const dataPoint: any = {
        name: questionData[key]?.label || key,
        fullQuestion: questionData[key]?.fullQuestion || '',
      };
      
      teamsWithResponses.forEach(team => {
        dataPoint[team.name] = teamAverages[team.id]?.[key] || 0;
      });
      
      // Calculate overall average
      if (overallAverages[key] && overallAverages[key].length > 0) {
        dataPoint.Gennemsnit = Math.round((overallAverages[key].reduce((a, b) => a + b, 0) / overallAverages[key].length) * 10) / 10;
      }
      
      return dataPoint;
    });
  }, [responses, teams, questionData]);

  const teamsWithResponses = useMemo(() => {
    if (!teams || !responses) return [];
    return teams.filter(team => responses.some(r => r.team_id === team.id));
  }, [teams, responses]);

  // Color palette for teams
  const teamColors = [
    'hsl(var(--primary))',
    'hsl(142 76% 36%)',
    'hsl(38 92% 50%)',
    'hsl(280 68% 60%)',
    'hsl(199 89% 48%)',
    'hsl(346 77% 49%)',
  ];

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Ingen data til sammenligning</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team sammenligning - søjlediagram</CardTitle>
        <CardDescription>Gennemsnit pr. spørgsmål fordelt på teams</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 10]} />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg max-w-sm">
                      <p className="font-medium text-sm mb-2">{label}</p>
                      <p className="text-xs text-muted-foreground mb-2">{data?.fullQuestion}</p>
                      <div className="space-y-1">
                        {payload.map((entry: any, index: number) => (
                          <div key={index} className="flex justify-between gap-4 text-sm">
                            <span style={{ color: entry.color }}>{entry.name}:</span>
                            <span className="font-medium">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            {teamsWithResponses.map((team, index) => (
              <Bar 
                key={team.id} 
                dataKey={team.name} 
                fill={teamColors[index % teamColors.length]} 
                radius={[0, 4, 4, 0]} 
              />
            ))}
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
