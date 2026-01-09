import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, TrendingDown, Users } from "lucide-react";
import { QualificationStanding } from "@/hooks/useLeagueData";
import { cn } from "@/lib/utils";

interface MyQualificationStatusProps {
  standing: QualificationStanding | null;
  totalPlayers: number;
  playersPerDivision: number;
}

export function MyQualificationStatus({
  standing,
  totalPlayers,
  playersPerDivision,
}: MyQualificationStatusProps) {
  if (!standing) {
    return (
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
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

  // Calculate progress within division
  const progressInDivision = ((playersPerDivision - standing.projected_rank + 1) / playersPerDivision) * 100;

  // Determine zone message
  const getZoneInfo = () => {
    if (standing.projected_division === 1 && standing.projected_rank <= 2) {
      return { text: "🔥 Top 2 i Topligaen!", color: "text-yellow-400" };
    }
    if (standing.projected_rank <= 2) {
      return { text: "✅ Oprykningszone", color: "text-green-400" };
    }
    if (standing.projected_rank === playersPerDivision - 2) {
      return { text: "⚔️ Duelzone", color: "text-orange-400" };
    }
    if (standing.projected_rank >= playersPerDivision - 1) {
      return { text: "⚠️ Nedrykningszone", color: "text-red-400" };
    }
    return { text: "🛡️ Sikker zone", color: "text-slate-400" };
  };

  const zoneInfo = getZoneInfo();

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-slate-900 border-primary/30">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Din nuværende placering</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold">#{standing.overall_rank}</span>
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
                standing.projected_division === 1 ? "text-yellow-500" : "text-slate-400"
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

        {/* Progress bar showing position in division */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Position i division</span>
            <span>#{standing.projected_rank} af {playersPerDivision}</span>
          </div>
          <Progress value={progressInDivision} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
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
