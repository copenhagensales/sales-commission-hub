import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

interface TeamComparisonLineChartProps {
  responses: any[];
  teams: { id: string; name: string }[];
  questionData: Record<string, { label: string; fullQuestion: string }>;
}

export function TeamComparisonLineChart({ responses, teams, questionData }: TeamComparisonLineChartProps) {
  const { chartData, teamsWithResponses, overallAverage } = useMemo(() => {
    if (!responses || responses.length === 0 || !teams || teams.length === 0) {
      return { chartData: [], teamsWithResponses: [], overallAverage: 0 };
    }

    const scoreKeys = Object.keys(questionData).filter(k => k !== 'nps_score');
    
    // Get teams with responses
    const teamsWithResponses = teams.filter(team => 
      responses.some(r => r.team_id === team.id)
    );

    // Calculate averages per team per question
    const teamAverages: Record<string, Record<string, number>> = {};
    const allValues: number[] = [];
    
    teamsWithResponses.forEach(team => {
      const teamResponses = responses.filter(r => r.team_id === team.id);
      teamAverages[team.id] = {};
      
      scoreKeys.forEach(key => {
        const values = teamResponses.map(r => r[key]).filter(v => typeof v === 'number');
        if (values.length > 0) {
          const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
          teamAverages[team.id][key] = avg;
          allValues.push(avg);
        }
      });
    });

    // Calculate overall average
    const overallAverage = allValues.length > 0 
      ? Math.round((allValues.reduce((a, b) => a + b, 0) / allValues.length) * 10) / 10
      : 0;

    // Build chart data
    const chartData = scoreKeys.map(key => {
      const dataPoint: any = {
        name: questionData[key]?.label || key,
        fullQuestion: questionData[key]?.fullQuestion || '',
      };
      
      teamsWithResponses.forEach(team => {
        dataPoint[team.name] = teamAverages[team.id]?.[key] || 0;
      });
      
      return dataPoint;
    });

    return { chartData, teamsWithResponses, overallAverage };
  }, [responses, teams, questionData]);

  // Color palette for teams
  const teamColors = [
    'hsl(var(--primary))',
    'hsl(142 76% 36%)',
    'hsl(38 92% 50%)',
    'hsl(280 68% 60%)',
    'hsl(199 89% 48%)',
    'hsl(346 77% 49%)',
    'hsl(173 58% 39%)',
    'hsl(12 76% 61%)',
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
        <CardTitle>Team sammenligning - linjediagram</CardTitle>
        <CardDescription>Sammenlign teams på tværs af alle dimensioner. Den stiplede linje viser gennemsnittet ({overallAverage})</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ left: 0, right: 20, top: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11 }} 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg max-w-sm">
                      <p className="font-medium text-sm mb-2">{label}</p>
                      <p className="text-xs text-muted-foreground mb-2">{data?.fullQuestion}</p>
                      <div className="space-y-1">
                        {payload
                          .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
                          .map((entry: any, index: number) => (
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
            <ReferenceLine 
              y={overallAverage} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="5 5" 
              label={{ 
                value: `Gns: ${overallAverage}`, 
                position: 'right',
                fontSize: 11,
                fill: 'hsl(var(--muted-foreground))'
              }} 
            />
            {teamsWithResponses.map((team, index) => (
              <Line 
                key={team.id}
                type="monotone"
                dataKey={team.name} 
                stroke={teamColors[index % teamColors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
