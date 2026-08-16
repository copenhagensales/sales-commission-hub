import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useLeagueTeamCompetition } from "@/hooks/useLeagueTeamCompetition";
import type { LeagueSeason } from "@/hooks/useLeagueData";
import { TeamPodium } from "./TeamPodium";
import { TeamDistanceChart } from "./TeamDistanceChart";
import { TeamStandingsTable } from "./TeamStandingsTable";

const TEAM_PALETTE = [
  "hsl(45 93% 58%)",
  "hsl(213 94% 68%)",
  "hsl(160 84% 55%)",
  "hsl(272 87% 70%)",
  "hsl(350 89% 66%)",
  "hsl(190 90% 60%)",
  "hsl(30 90% 62%)",
];

interface Props {
  season: LeagueSeason;
}

export function TeamCompetitionView({ season }: Props) {
  const { data, isLoading } = useLeagueTeamCompetition(season);

  const colors = useMemo(() => {
    const map: Record<string, string> = {};
    (data?.teams ?? []).forEach((t, i) => {
      map[t.team_id] = TEAM_PALETTE[i % TEAM_PALETTE.length];
    });
    return map;
  }, [data?.teams]);

  if (isLoading) {
    return (
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="py-16 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.hasStarted) {
    const start = new Date(`${season.start_date}T00:00:00`);
    return (
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="py-16 text-center space-y-2">
          <Users className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="text-sm font-semibold">
            Holdkonkurrencen starter {format(start, "d. MMMM", { locale: da })}
          </p>
          <p className="text-xs text-muted-foreground">
            Alle hold deltager automatisk. Kun holdets 5 bedste sælgere tæller — først når
            kvalifikationsrunden er slut.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.teams.length === 0) {
    return (
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Ingen hold med salg i perioden endnu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      <TeamPodium teams={data.teams} colors={colors} />
      <TeamDistanceChart teams={data.teams} colors={colors} />
      <TeamStandingsTable teams={data.teams} colors={colors} />
    </div>
  );
}
