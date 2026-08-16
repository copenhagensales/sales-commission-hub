import { Card, CardContent } from "@/components/ui/card";
import type { TeamCompetitionRow } from "@/hooks/useLeagueTeamCompetition";

function formatKr(value: number) {
  return `${Math.round(value).toLocaleString("da-DK")} kr`;
}

interface Props {
  teams: TeamCompetitionRow[];
  colors: Record<string, string>;
}

export function TeamDistanceChart({ teams, colors }: Props) {
  if (teams.length === 0) return null;
  const leader = teams[0].provision;
  const max = Math.max(leader, 1);

  return (
    <Card className="bg-slate-800/30 border-slate-700">
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Provision</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Til #1</span>
        </div>
        <div className="space-y-3">
          {teams.map((team) => {
            const pct = (team.provision / max) * 100;
            const diff = team.provision - leader;
            return (
              <div key={team.team_id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-right truncate">{team.team_name}</span>
                <div className="relative flex-1 h-4">
                  <div
                    className="absolute top-1/2 left-0 h-px -translate-y-1/2"
                    style={{ width: `${pct}%`, backgroundColor: colors[team.team_id] }}
                  />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full ring-2 ring-slate-900"
                    style={{ left: `${pct}%`, backgroundColor: colors[team.team_id] }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs font-mono">
                  {team.rank === 1 ? (
                    <span className="text-yellow-400 font-bold">fører</span>
                  ) : (
                    <span className="text-muted-foreground">−{formatKr(Math.abs(diff))}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
