import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useActiveSeason, useEnrollmentCount } from "@/hooks/useLeagueData";
import { useSeasonStandings } from "@/hooks/useLeagueActiveData";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { useAvatarLookup } from "@/hooks/useAvatarLookup";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { FeedReactionRow } from "@/components/home/FeedReactionRow";
import { buildTargetKey, useFeedReactions } from "@/hooks/useFeedReactions";
import { PlayerProfileHoverCard } from "@/components/profile-card/PlayerProfileHoverCard";

export function CompactLeagueView() {
  const { data: season } = useActiveSeason();
  const { data: currentEmployeeId } = useCurrentEmployeeId();
  const { data: seasonStandings = [] } = useSeasonStandings(season?.id);
  const { data: enrollmentCount = 0 } = useEnrollmentCount(season?.id);
  const lookupAvatar = useAvatarLookup();

  // Samlet top 3 i sæsonen — samme pointstilling som ligasiden viser
  const pointsTop3 = [...seasonStandings]
    .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
    .slice(0, 3);

  const leagueTargetKey = (employeeId: string) =>
    buildTargetKey("league_round", [season?.id ?? "none", employeeId]);

  const podiumKeys = pointsTop3.map((standing) => leagueTargetKey(standing.employee_id));

  const { getReactions, toggleReaction, canInteract } = useFeedReactions(podiumKeys);

  const formatProvision = (amount: number) =>
    `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(amount)} kr`;

  const isPodium = (rank: number) => rank >= 1 && rank <= 3;

  if (!season) return null;

  const visibleStandings = pointsTop3;


  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <Card className="h-full border-0 bg-card rounded-3xl">
      <CardHeader className="px-6 pb-2 pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
            <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[hsl(var(--cph-onyx))]" />
            Liga · samlet top 3
          </CardTitle>
          <span className="text-[13px] text-foreground/70">{enrollmentCount} tilmeldt</span>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {visibleStandings.length > 0 && (
          <div className="divide-y divide-[hsl(var(--cph-onyx)/0.1)] border-t border-[hsl(var(--cph-onyx)/0.1)]">
            {visibleStandings.map((standing, index) => {
              const isMe = standing.employee_id === currentEmployeeId;
              const rank = index + 1;
              const name = formatPlayerName(standing.employee);

              return (
                <div key={standing.id} className="flex items-center gap-4 py-4">
                  <span
                    className={`w-6 text-[20px] font-extrabold tracking-[-0.02em] tabular-nums ${
                      rank === 1 ? "text-foreground" : "text-foreground/70"
                    }`}
                  >
                    {rank}
                  </span>
                  <PlayerProfileHoverCard employeeId={standing.employee_id}>
                    <span
                      className={`flex h-10 w-10 flex-none cursor-pointer items-center justify-center overflow-hidden rounded-full text-[13px] font-extrabold ${
                        rank === 1
                          ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-emerald))] ring-2 ring-[hsl(var(--cph-emerald))]"
                          : "bg-[hsl(var(--cph-light-blue))] text-[hsl(var(--cph-onyx))]"
                      }`}
                    >
                      {lookupAvatar({ employeeId: standing.employee_id, name }) ? (
                        <img
                          src={lookupAvatar({ employeeId: standing.employee_id, name }) as string}
                          alt={name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials(name)
                      )}
                    </span>
                  </PlayerProfileHoverCard>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-extrabold text-foreground">
                      {name}
                      {isMe && <span className="ml-1 font-normal text-foreground/70">(dig)</span>}
                    </p>
                    <p className="text-[13px] text-foreground/70">
                      {standing.rounds_played
                        ? `${standing.rounds_played} runder spillet`
                        : "Ingen runder endnu"}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    {isPodium(rank) && (
                      <FeedReactionRow
                        targetType="league_round"
                        targetKey={leagueTargetKey(standing.employee_id)}
                        reactions={getReactions(leagueTargetKey(standing.employee_id))}
                        disabled={!canInteract}
                        onToggle={(args) => toggleReaction.mutate(args)}
                      />
                    )}
                    <span className="text-[20px] font-extrabold tracking-[-0.02em] tabular-nums text-foreground">
                      {formatPoints(standing.total_points || 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Link
            to="/commission-league"
            className="flex items-center gap-1.5 text-[14px] font-extrabold text-foreground hover:opacity-70"
          >
            Se fuld liga
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

