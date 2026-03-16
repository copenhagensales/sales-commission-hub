import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Swords, Trophy } from "lucide-react";
import { LeagueRoundStanding, LeagueRound } from "@/hooks/useLeagueActiveData";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RoundResultsCardProps {
  round: LeagueRound;
  standings: LeagueRoundStanding[];
  playersPerDivision: number;
  currentEmployeeId?: string;
}

const movementConfig: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  promoted: { icon: ArrowUp, label: "Oprykket", className: "bg-green-500/20 text-green-500 border-green-500/30" },
  relegated: { icon: ArrowDown, label: "Nedrykket", className: "bg-red-500/20 text-red-500 border-red-500/30" },
  playoff_won: { icon: Swords, label: "Playoff vundet", className: "bg-green-500/20 text-green-500 border-green-500/30" },
  playoff_lost: { icon: Swords, label: "Playoff tabt", className: "bg-red-500/20 text-red-500 border-red-500/30" },
};

export function RoundResultsCard({ round, standings, playersPerDivision, currentEmployeeId }: RoundResultsCardProps) {
  // Group by division
  const divisions: Record<number, LeagueRoundStanding[]> = {};
  for (const s of standings) {
    if (!divisions[s.division]) divisions[s.division] = [];
    divisions[s.division].push(s);
  }
  
  const sortedDivs = Object.keys(divisions).map(Number).sort((a, b) => a - b);
  const totalDivisions = sortedDivs.length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Runde {round.round_number}</span>
          <Badge variant="outline" className="text-[10px]">
            {format(new Date(round.start_date), "d. MMM", { locale: da })} – {format(new Date(round.end_date), "d. MMM", { locale: da })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sortedDivs.map((div) => {
          const players = divisions[div].sort((a, b) => a.rank_in_division - b.rank_in_division);
          const isTopDiv = div === sortedDivs[0];

          return (
            <div key={div}>
              <div className="px-3 py-1.5 bg-muted/30 border-y border-border/50 flex items-center gap-2">
                {isTopDiv ? (
                  <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                ) : null}
                <span className="text-xs font-semibold text-muted-foreground">
                  {isTopDiv ? "Salgsligaen" : `${div - 1}. Division`}
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {players.map((s) => {
                  const isMe = s.employee_id === currentEmployeeId;
                  const mov = movementConfig[s.movement];
                  const points = calculatePointsDisplay(div, s.rank_in_division, totalDivisions, playersPerDivision);

                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-sm",
                        isMe && "bg-primary/10"
                      )}
                    >
                      <span className="w-6 text-center font-bold text-muted-foreground text-xs">
                        {s.rank_in_division}
                      </span>
                      <span className={cn("flex-1 truncate text-sm", isMe && "text-primary font-semibold")}>
                        {formatPlayerName(s.employee)}
                      </span>
                      {mov && (
                        <Badge className={cn("text-[10px] px-1 py-0", mov.className)}>
                          <mov.icon className="h-3 w-3 mr-0.5" />{mov.label}
                        </Badge>
                      )}
                      <span className="font-mono text-xs text-muted-foreground w-16 text-right">
                        {Number(s.weekly_provision).toLocaleString("da-DK")} kr
                      </span>
                      <span className="font-mono text-xs font-semibold w-10 text-right">
                        +{points}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function calculatePointsDisplay(
  division: number,
  rank: number,
  totalDivisions: number,
  playersPerDivision: number
): number {
  return (totalDivisions - division) * playersPerDivision + (playersPerDivision - rank + 1);
}
