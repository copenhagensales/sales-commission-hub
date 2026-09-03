import { motion } from "framer-motion";

export interface TvTeamCompetitionTeam {
  teamId: string;
  name: string;
  provision: number;
  rank: number;
}

export interface TvTeamCompetitionData {
  hasStarted: boolean;
  teams: TvTeamCompetitionTeam[];
}

const TEAM_PALETTE = [
  "hsl(45 93% 58%)",
  "hsl(213 94% 68%)",
  "hsl(160 84% 55%)",
  "hsl(272 87% 70%)",
  "hsl(350 89% 66%)",
  "hsl(190 90% 60%)",
  "hsl(30 90% 62%)",
];

function formatKr(value: number): string {
  return `${Math.round(value).toLocaleString("da-DK")} kr`;
}

interface Props {
  data: TvTeamCompetitionData | null | undefined;
}

/** Holdkonkurrencens placering — lollipop-graf med afstand til #1 (TV-board) */
export function TvTeamCompetitionBars({ data }: Props) {
  const teams = data?.teams ?? [];

  return (
    <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-3 2xl:p-4">
      <div className="flex items-center justify-between mb-2 2xl:mb-3">
        <span className="text-[9px] 2xl:text-[11px] uppercase tracking-wider text-slate-500">
          Provision
        </span>
        <span className="text-[9px] 2xl:text-[11px] uppercase tracking-wider text-slate-500">
          Til #1
        </span>
      </div>

      {teams.length === 0 ? (
        <p className="text-slate-600 text-xs 2xl:text-sm italic py-2">
          {data?.hasStarted === false
            ? "Holdkonkurrencen er ikke startet endnu"
            : "Ingen hold med provision i perioden endnu"}
        </p>
      ) : (
        <div className="space-y-2 2xl:space-y-3">
          {teams.map((team, i) => {
            const leader = teams[0].provision;
            const max = Math.max(leader, 1);
            const pct = Math.max((team.provision / max) * 100, 1);
            const diff = Math.abs(team.provision - leader);
            const color = TEAM_PALETTE[i % TEAM_PALETTE.length];
            return (
              <div key={team.teamId} className="flex items-center gap-2 2xl:gap-3">
                <span
                  className="w-20 2xl:w-28 shrink-0 text-[11px] 2xl:text-sm text-right truncate font-medium"
                  style={{ color }}
                >
                  {team.name}
                </span>
                <div className="relative flex-1 h-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.08 }}
                    className="absolute top-1/2 left-0 h-px -translate-y-1/2"
                    style={{ backgroundColor: color }}
                  />
                  <motion.div
                    initial={{ left: 0 }}
                    animate={{ left: `${pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.08 }}
                    className="absolute top-1/2 h-3 w-3 2xl:h-3.5 2xl:w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full ring-2 ring-slate-900"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <span className="w-20 2xl:w-28 shrink-0 text-right text-[11px] 2xl:text-sm font-mono tabular-nums">
                  {team.rank === 1 ? (
                    <span className="text-yellow-400 font-bold">fører</span>
                  ) : (
                    <span className="text-slate-400">−{formatKr(diff)}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
