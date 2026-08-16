import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { formatPlayerName } from "@/lib/formatPlayerName";
import type { TeamCompetitionRow } from "@/hooks/useLeagueTeamCompetition";

function formatKr(value: number) {
  return `${Math.round(value).toLocaleString("da-DK")} kr`;
}

interface Props {
  teams: TeamCompetitionRow[];
  colors: Record<string, string>;
}

export function TeamStandingsTable({ teams, colors }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card className="bg-slate-800/30 border-slate-700 overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-[40px_1fr_120px_120px_44px] items-center px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-slate-700/60">
          <span>#</span>
          <span>Hold</span>
          <span className="text-right">Provision</span>
          <span className="text-right">I dag</span>
          <span />
        </div>
        {teams.map((team) => {
          const isOpen = expanded === team.team_id;
          return (
            <div key={team.team_id} className="border-b border-slate-700/40 last:border-0">
              <div className="grid grid-cols-[40px_1fr_120px_120px_44px] items-center px-4 py-3">
                <span className="text-sm font-bold text-yellow-500/90">{team.rank}</span>
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: colors[team.team_id] }}
                  />
                  <span className="text-sm font-bold truncate">{team.team_name}</span>
                </span>
                <span className="text-right text-sm font-mono font-bold">
                  {formatKr(team.provision)}
                </span>
                <span className="text-right leading-tight">
                  <span className="block text-xs font-mono text-emerald-400">
                    +{formatKr(team.today_provision)}
                  </span>
                  <span
                    className={`block text-[10px] ${
                      team.rank_change > 0
                        ? "text-emerald-400"
                        : team.rank_change < 0
                          ? "text-red-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {team.rank_change > 0
                      ? `+${team.rank_change} plads${team.rank_change > 1 ? "er" : ""}`
                      : team.rank_change < 0
                        ? `−${Math.abs(team.rank_change)} plads${Math.abs(team.rank_change) > 1 ? "er" : ""}`
                        : "uændret"}
                  </span>
                </span>
                <span className="flex justify-end">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-slate-600"
                    aria-label={`Vis top 5 for ${team.team_name}`}
                    onClick={() => setExpanded(isOpen ? null : team.team_id)}
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </span>
              </div>
              {isOpen && (
                <div className="px-4 pb-3">
                  <div className="rounded-lg bg-slate-900/50 p-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Tællende top 5
                    </p>
                    {team.counting_players.length === 0 && (
                      <p className="text-xs text-muted-foreground">Ingen salg i perioden.</p>
                    )}
                    {team.counting_players.map((p, i) => (
                      <div key={p.employee_id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {i + 1}. {formatPlayerName(p)}
                        </span>
                        <span className="font-mono">{formatKr(p.provision)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
