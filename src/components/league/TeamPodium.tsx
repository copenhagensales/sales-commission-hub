import { Card, CardContent } from "@/components/ui/card";
import type { TeamCompetitionRow } from "@/hooks/useLeagueTeamCompetition";

const MEDALS = ["🥇", "🥈", "🥉"];

function formatKr(value: number) {
  return `${Math.round(value).toLocaleString("da-DK")} kr`;
}

interface Props {
  teams: TeamCompetitionRow[];
  colors: Record<string, string>;
}

export function TeamPodium({ teams, colors }: Props) {
  const top3 = teams.slice(0, 3);
  if (top3.length === 0) return null;

  // Visuel rækkefølge: 2 · 1 · 3
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights: Record<number, string> = { 1: "h-48", 2: "h-36", 3: "h-32" };
  const textColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-sky-300",
    3: "text-emerald-300",
  };

  return (
    <Card className="bg-slate-800/30 border-slate-700">
      <CardContent className="py-6">
        <div className="grid grid-cols-3 items-end gap-3">
          {order.map((team) => (
            <div key={team.team_id} className="flex flex-col items-center gap-1.5">
              <span className="text-2xl">{MEDALS[team.rank - 1]}</span>
              <span className="text-sm font-bold text-center">{team.team_name}</span>
              <span className={`text-sm font-mono font-bold ${textColors[team.rank] ?? "text-foreground"}`}>
                {formatKr(team.provision)}
              </span>
              <div
                className={`w-full ${heights[team.rank] ?? "h-28"} rounded-t-lg flex items-start justify-center pt-3 bg-gradient-to-b from-slate-700/60 to-slate-900/10 ring-1 ring-inset`}
                style={{ boxShadow: `inset 0 2px 0 0 ${colors[team.team_id]}` }}
              >
                <span className="text-3xl font-extrabold text-slate-600">{team.rank}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
