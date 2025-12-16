import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TeamHeatmapProps {
  responses: any[];
  teams: { id: string; name: string }[];
  questionData: Record<string, { label: string; fullQuestion: string }>;
}

function getHeatmapColor(value: number): string {
  // Scale from red (0) through yellow (5) to green (10)
  if (value < 4) {
    return `hsl(0 70% ${45 + value * 3}%)`;
  } else if (value < 7) {
    return `hsl(${(value - 4) * 20} 70% 50%)`;
  } else {
    return `hsl(${60 + (value - 7) * 30} 70% ${45 - (value - 7) * 3}%)`;
  }
}

// Color scale for NPS (-100 to +100)
function getNpsColor(nps: number): string {
  if (nps < 0) {
    return `hsl(0 70% ${45 + Math.min(nps + 50, 50) * 0.2}%)`;
  } else if (nps < 30) {
    return `hsl(${nps * 2} 70% 50%)`;
  } else {
    return `hsl(${60 + Math.min(nps - 30, 70) * 0.85} 70% ${42 - Math.min(nps - 30, 70) * 0.1}%)`;
  }
}

function getTextColor(value: number): string {
  return value >= 4 && value <= 7 ? 'hsl(0 0% 10%)' : 'hsl(0 0% 100%)';
}

// Calculate NPS from individual scores (% promoters - % detractors)
function calculateNps(scores: number[]): number {
  if (scores.length === 0) return 0;
  const promoters = scores.filter(s => s >= 9).length;
  const detractors = scores.filter(s => s <= 6).length;
  const nps = ((promoters - detractors) / scores.length) * 100;
  return Math.round(nps);
}

export function TeamHeatmap({ responses, teams, questionData }: TeamHeatmapProps) {
  const { heatmapData, teamsWithResponses, scoreKeys, overallAverages, responseCountByTeam, totalResponses } = useMemo(() => {
    if (!responses || responses.length === 0 || !teams || teams.length === 0) {
      return { heatmapData: {}, teamsWithResponses: [], scoreKeys: [], overallAverages: {}, responseCountByTeam: {}, totalResponses: 0 };
    }

    // Include NPS in the heatmap (put it first)
    const scoreKeys = ['nps_score', ...Object.keys(questionData).filter(k => k !== 'nps_score')];
    
    // Get teams with responses
    const teamsWithResponses = teams.filter(team => 
      responses.some(r => r.team_id === team.id)
    );

    // Calculate response count per team
    const responseCountByTeam: Record<string, number> = {};
    teamsWithResponses.forEach(team => {
      responseCountByTeam[team.id] = responses.filter(r => r.team_id === team.id).length;
    });

    // Calculate averages per team per question
    const heatmapData: Record<string, Record<string, number>> = {};
    const overallAverages: Record<string, number> = {};
    
    teamsWithResponses.forEach(team => {
      const teamResponses = responses.filter(r => r.team_id === team.id);
      heatmapData[team.id] = {};
      
      scoreKeys.forEach(key => {
        const values = teamResponses.map(r => r[key]).filter(v => typeof v === 'number');
        if (values.length > 0) {
          // For nps_score, calculate actual NPS instead of average
          if (key === 'nps_score') {
            heatmapData[team.id][key] = calculateNps(values);
          } else {
            heatmapData[team.id][key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
          }
        }
      });
    });

    // Calculate overall averages
    scoreKeys.forEach(key => {
      const values = responses.map(r => r[key]).filter(v => typeof v === 'number');
      if (values.length > 0) {
        // For nps_score, calculate actual NPS instead of average
        if (key === 'nps_score') {
          overallAverages[key] = calculateNps(values);
        } else {
          overallAverages[key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
        }
      }
    });

    return { heatmapData, teamsWithResponses, scoreKeys, overallAverages, responseCountByTeam, totalResponses: responses.length };
  }, [responses, teams, questionData]);

  if (teamsWithResponses.length === 0) {
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
        <CardTitle>Team heatmap</CardTitle>
        <CardDescription>Farvekodet oversigt - mørkere grøn = højere score</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 text-sm font-medium border-b">Team</th>
                  <th className="text-center p-2 text-xs font-medium border-b min-w-[50px]">n</th>
                  {scoreKeys.map(key => {
                    const isNps = key === 'nps_score';
                    const label = isNps ? 'eNPS' : (questionData[key]?.label || key);
                    const tooltip = isNps 
                      ? 'Net Promoter Score: % Promoters (9-10) minus % Detractors (0-6). Skala: -100 til +100'
                      : questionData[key]?.fullQuestion;
                    
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <th className="text-center p-2 text-xs font-medium border-b cursor-help min-w-[60px]">
                            {label}
                          </th>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">{tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <th className="text-center p-2 text-xs font-medium border-b min-w-[60px]">Snit</th>
                </tr>
              </thead>
              <tbody>
                {teamsWithResponses.map(team => {
                  const teamValues = Object.values(heatmapData[team.id] || {}).filter(v => typeof v === 'number');
                  const teamAvg = teamValues.length > 0 
                    ? Math.round((teamValues.reduce((a, b) => a + b, 0) / teamValues.length) * 10) / 10 
                    : 0;
                  
                    return (
                      <tr key={team.id}>
                        <td className="p-2 text-sm font-medium border-b">{team.name}</td>
                        <td className="text-center p-2 text-sm border-b text-muted-foreground">{responseCountByTeam[team.id]}</td>
                      {scoreKeys.map(key => {
                        const value = heatmapData[team.id]?.[key];
                        const isNps = key === 'nps_score';
                        const displayValue = value !== undefined ? value : '-';
                        
                        // Use different color scale for NPS
                        const bgColor = value !== undefined 
                          ? (isNps ? getNpsColor(value) : getHeatmapColor(value))
                          : 'transparent';
                        const textColor = value !== undefined 
                          ? 'hsl(0 0% 100%)'
                          : 'inherit';
                        
                        return (
                          <td 
                            key={key} 
                            className="text-center p-2 border-b transition-all"
                            style={{ 
                              backgroundColor: bgColor,
                              color: textColor
                            }}
                          >
                            <span className="font-semibold text-sm">{displayValue}</span>
                          </td>
                        );
                      })}
                      <td 
                        className="text-center p-2 border-b font-bold"
                        style={{ 
                          backgroundColor: getHeatmapColor(teamAvg),
                          color: getTextColor(teamAvg)
                        }}
                      >
                        {teamAvg}
                      </td>
                    </tr>
                  );
                })}
                {/* Overall average row */}
                <tr className="bg-muted/50">
                  <td className="p-2 text-sm font-bold border-t-2">Gennemsnit</td>
                  <td className="text-center p-2 text-sm border-t-2 font-bold">{totalResponses}</td>
                  {scoreKeys.map(key => {
                    const value = overallAverages[key];
                    const isNps = key === 'nps_score';
                    
                    // Use different color scale for NPS
                    const bgColor = value !== undefined 
                      ? (isNps ? getNpsColor(value) : getHeatmapColor(value))
                      : 'transparent';
                    
                    return (
                      <td 
                        key={key} 
                        className="text-center p-2 border-t-2"
                        style={{ 
                          backgroundColor: bgColor,
                          color: value !== undefined ? 'hsl(0 0% 100%)' : 'inherit'
                        }}
                      >
                        <span className="font-bold text-sm">{value ?? '-'}</span>
                      </td>
                    );
                  })}
                  <td 
                    className="text-center p-2 border-t-2 font-bold"
                    style={{ 
                      backgroundColor: getHeatmapColor(
                        Object.values(overallAverages).reduce((a, b) => a + b, 0) / Object.values(overallAverages).length || 0
                      ),
                      color: getTextColor(
                        Object.values(overallAverages).reduce((a, b) => a + b, 0) / Object.values(overallAverages).length || 0
                      )
                    }}
                  >
                    {Math.round(
                      (Object.values(overallAverages).reduce((a, b) => a + b, 0) / Object.values(overallAverages).length || 0) * 10
                    ) / 10}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
