import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface TeamRadarChartProps {
  responses: any[];
  teams: { id: string; name: string }[];
  questionData: Record<string, { label: string; fullQuestion: string }>;
}

export function TeamRadarChart({ responses, teams, questionData }: TeamRadarChartProps) {
  const chartData = useMemo(() => {
    if (!responses || responses.length === 0 || !teams || teams.length === 0) return [];

    const scoreKeys = Object.keys(questionData).filter(k => k !== 'nps_score');
    
    // Get teams with responses
    const teamsWithResponses = teams.filter(team => 
      responses.some(r => r.team_id === team.id)
    );

    // Calculate averages per team per question
    const teamAverages: Record<string, Record<string, number>> = {};
    
    teamsWithResponses.forEach(team => {
      const teamResponses = responses.filter(r => r.team_id === team.id);
      teamAverages[team.id] = {};
      
      scoreKeys.forEach(key => {
        const values = teamResponses.map(r => r[key]).filter(v => typeof v === 'number');
        if (values.length > 0) {
          teamAverages[team.id][key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
        }
      });
    });

    // Build radar data
    return scoreKeys.map(key => {
      const dataPoint: any = {
        subject: questionData[key]?.label || key,
        fullMark: 10,
      };
      
      teamsWithResponses.forEach(team => {
        dataPoint[team.name] = teamAverages[team.id]?.[key] || 0;
      });
      
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
        <CardTitle>Team profiler - radar</CardTitle>
        <CardDescription>Overblik over team-styrker og udviklingspunkter</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10 }} />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm mb-2">{payload[0]?.payload?.subject}</p>
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
              <Radar 
                key={team.id}
                name={team.name} 
                dataKey={team.name} 
                stroke={teamColors[index % teamColors.length]}
                fill={teamColors[index % teamColors.length]}
                fillOpacity={0.2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
