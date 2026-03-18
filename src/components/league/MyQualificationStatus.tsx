import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, TrendingDown, Users, Sparkles } from "lucide-react";
import { QualificationStanding } from "@/hooks/useLeagueData";
import { cn } from "@/lib/utils";
import { getRandomQuote, getPerformanceStatus } from "@/lib/gamification-quotes";

interface MyQualificationStatusProps {
  standing: QualificationStanding | null;
  totalPlayers: number;
  playersPerDivision: number;
  standings?: QualificationStanding[];
}

export function MyQualificationStatus({
  standing,
  totalPlayers,
  playersPerDivision,
  standings,
}: MyQualificationStatusProps) {
  if (!standing) {
    return (
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-border">
        <CardContent className="py-6 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            Tilmeld dig for at se din placering
          </p>
        </CardContent>
      </Card>
    );
  }

  const rankChange = standing.previous_overall_rank !== null
    ? standing.previous_overall_rank - standing.overall_rank
    : 0;

  const progressInDivision = ((playersPerDivision - standing.projected_rank + 1) / playersPerDivision) * 100;

  const getZoneInfo = () => {
    if (standing.projected_division === 1 && standing.projected_rank <= 3) {
      return { text: "🔥 Top 3 i Salgsligaen!", color: "text-yellow-400", gradient: "from-yellow-500/15 via-slate-900 to-slate-900" };
    }
    if (standing.projected_rank <= 3) {
      return { text: "✅ Oprykningszone", color: "text-green-400", gradient: "from-green-500/15 via-slate-900 to-slate-900" };
    }
    if (standing.projected_rank === playersPerDivision - 2) {
      return { text: "⚔️ Duelzone", color: "text-orange-400", gradient: "from-orange-500/10 via-slate-900 to-slate-900" };
    }
    if (standing.projected_rank >= playersPerDivision - 1) {
      return { text: "⚠️ Nedrykningszone", color: "text-red-400", gradient: "from-red-500/10 via-slate-900 to-slate-900" };
    }
    return { text: "🛡️ Sikker zone", color: "text-slate-400", gradient: "from-primary/10 via-slate-900 to-slate-900" };
  };

  const zoneInfo = getZoneInfo();

  // Motivational quote based on zone
  const isAhead = standing.projected_rank <= 3;
  const isOnTrack = standing.projected_rank <= Math.ceil(playersPerDivision / 2);
  const progressPercent = progressInDivision;
  const status = getPerformanceStatus(progressPercent, isAhead, isOnTrack);
  const motivation = getRandomQuote(status);

  // Rival info
  const rivalInfo = useMemo(() => {
    if (!standings || standings.length === 0) return null;
    const myIndex = standings.findIndex(s => s.employee_id === standing.employee_id);
    if (myIndex <= 0) return null;
    const rival = standings[myIndex - 1];
    const gap = rival.current_provision - standing.current_provision;
    if (gap <= 0) return null;
    return {
      gap: gap.toLocaleString("da-DK", { maximumFractionDigits: 0 }),
    };
  }, [standings, standing]);

  return (
    <Card className={cn("border-primary/30 overflow-hidden", `bg-gradient-to-br ${zoneInfo.gradient}`)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Din nuværende placering</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold number-animate">#{standing.overall_rank}</span>
              {rankChange !== 0 && (
                <Badge
                  variant={rankChange > 0 ? "default" : "destructive"}
                  className={cn(
                    "flex items-center gap-1",
                    rankChange > 0 && "bg-green-500/20 text-green-400 border-green-500/30"
                  )}
                >
                  {rankChange > 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3" />
                      +{rankChange}
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3" />
                      {rankChange}
                    </>
                  )}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              af {totalPlayers} tilmeldte
            </p>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className={cn(
                "h-5 w-5",
                standing.projected_division === 1 ? "text-yellow-500" : "text-muted-foreground"
              )} />
              <span className="font-semibold">
                Division {standing.projected_division}
                {standing.projected_division === 1 && " (Topliga)"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Rank #{standing.projected_rank} i divisionen
            </p>
          </div>
        </div>

        {/* Zone indicator */}
        <div className={cn("text-center py-2 rounded-lg bg-slate-800/50 mb-4", zoneInfo.color)}>
          {zoneInfo.text}
        </div>

        {/* Motivational quote */}
        <div className="flex items-center gap-2 justify-center mb-4 px-2">
          <Sparkles className="h-3.5 w-3.5 text-yellow-400/70 shrink-0" />
          <p className="text-sm italic text-muted-foreground text-center">{motivation.quote}</p>
        </div>

        {/* Progress bar showing position in division */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Position i division</span>
            <span>#{standing.projected_rank} af {playersPerDivision}</span>
          </div>
          <Progress value={progressInDivision} className="h-2" />
        </div>

        {/* Rival info */}
        {rivalInfo && (
          <div className="mt-3 text-center">
            <p className="text-xs text-muted-foreground">
              📊 Næste plads: <span className="font-semibold text-foreground">{rivalInfo.gap} kr</span> foran dig
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
          <div>
            <p className="text-sm text-muted-foreground">Provision</p>
            <p className="text-xl font-bold">
              {standing.current_provision.toLocaleString("da-DK")} kr
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Antal salg</p>
            <p className="text-xl font-bold">{standing.deals_count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
