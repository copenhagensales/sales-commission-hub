import { useIsPhone } from "@/components/mobile";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useActiveSeason, useEnrollmentCount } from "@/hooks/useLeagueData";
import { useSeasonStandings } from "@/hooks/useLeagueActiveData";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { useAvatarLookup } from "@/hooks/useAvatarLookup";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { ReactButton, ReactionBubbles } from "@/components/home/FeedReactionRow";
import { buildTargetKey, useFeedReactions } from "@/hooks/useFeedReactions";
import { PlayerProfileHoverCard } from "@/components/profile-card/PlayerProfileHoverCard";

export function CompactLeagueView() {
  const isPhone = useIsPhone();
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

  const { getReactions, setReaction, canInteract } = useFeedReactions(podiumKeys);

  const formatPoints = (points: number) =>
    `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(points)} pt`;

  const RANK_STYLES = [
    "bg-[#FCEFC7] text-[#7A5000]",
    "bg-[#E8ECEF] text-[#3F4A55]",
    "bg-[#F6E2D3] text-[#7F421A]",
  ];
  const roundsSet = new Set(pointsTop3.map((s) => s.rounds_played || 0));
  const sharedRounds = pointsTop3.length > 0 && roundsSet.size === 1 ? [...roundsSet][0] : null;
  const gapText = (index: number) => {
    const pts = (i: number) => pointsTop3[i]?.total_points || 0;
    if (index === 0) {
      return pointsTop3.length > 1 ? `${formatPoints(pts(0) - pts(1))} foran` : "";
    }
    return `${formatPoints(pts(index - 1) - pts(index))} efter nr. ${index}`;
  };

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
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <CardTitle className="flex items-center whitespace-nowrap gap-2.5 text-[15px] font-extrabold">
            <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[hsl(var(--cph-onyx))]" />
            Liga · samlet top 3
          </CardTitle>
          <span className="text-[13px] text-foreground/70">
            {enrollmentCount} tilmeldt
            {sharedRounds !== null && sharedRounds > 0 && ` · ${sharedRounds} runder spillet`}
          </span>
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
                <div key={standing.id} className="flex items-center gap-2.5 py-4 sm:gap-4">
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px] font-bold tabular-nums ${RANK_STYLES[index]}`}
                  >
                    {rank}
                  </span>
                  <PlayerProfileHoverCard employeeId={standing.employee_id}>
                    <span
                      className={`flex h-9 w-9 flex-none cursor-pointer items-center justify-center overflow-hidden rounded-full text-[12px] font-extrabold sm:h-10 sm:w-10 sm:text-[13px] ${
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
                    <p className="truncate text-[14px] font-extrabold text-foreground sm:text-[15px]">
                      {name}
                      {isMe && <span className="ml-1 font-normal text-foreground/70">(dig)</span>}
                    </p>
                    {sharedRounds === null && (
                      <p className="truncate text-[12px] text-foreground/70">
                        {standing.rounds_played ? `${standing.rounds_played} runder spillet` : "Ingen runder endnu"}
                      </p>
                    )}
                    {(() => {
                      const key = leagueTargetKey(standing.employee_id);
                      const summary = getReactions(key);
                      return (
                        <div className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden">
                          {summary.total > 0 && (
                            <span className="flex flex-none items-center gap-1 text-[12px] text-muted-foreground">
                              <ReactionBubbles summary={summary} size={20} />
                              <span className="tabular-nums">{summary.total}</span>
                              <span aria-hidden="true">·</span>
                            </span>
                          )}
                          <ReactButton
                            summary={summary}
                            disabled={!canInteract}
                            compact={isPhone}
                            className="-ml-1 [&_button]:text-[13px]"
                            onSet={(reaction) =>
                              setReaction.mutate({ targetType: "league_round", targetKey: key, reaction })
                            }
                          />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex-none pl-1 text-right">
                    <p className="whitespace-nowrap text-[20px] sm:text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums text-foreground">
                      {formatPoints(standing.total_points || 0)}
                    </p>
                    {gapText(index) && (
                      <p className="mt-1 whitespace-nowrap text-[12px] text-muted-foreground">{gapText(index)}</p>
                    )}
                  </div>
                </div>

              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Link
            to="/commission-league"
            className="flex min-h-[44px] items-center gap-1.5 text-[14px] font-extrabold text-foreground hover:opacity-70"
          >
            Se fuld liga
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

