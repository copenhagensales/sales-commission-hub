import { Link } from "react-router-dom";
import { Trophy, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeCard, HomeCardEmpty } from "@/components/home/HomeCard";
import {
  useActiveSeason,
  useMyEnrollment,
  useQualificationStandings,
  useEnrollmentCount,
  type QualificationStanding,
} from "@/hooks/useLeagueData";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { cn } from "@/lib/utils";

function formatProvision(amount: number) {
  return (
    new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount)) + " kr"
  );
}

interface StandingRowProps {
  rank: number;
  name: string;
  provision: number;
  isMe?: boolean;
}

function StandingRow({ rank, name, provision, isMe }: StandingRowProps) {
  return (
    <div
      className={cn(
        "flex h-9 items-center justify-between gap-2 rounded-md px-2 text-sm",
        isMe ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "w-6 shrink-0 text-center text-xs tabular-nums",
            rank <= 3 ? "font-semibold text-primary" : "text-muted-foreground"
          )}
        >
          {rank}
        </span>
        <span className="truncate">
          {name}
          {isMe && <span className="ml-1 text-primary">(dig)</span>}
        </span>
      </div>
      <span className="shrink-0 tabular-nums">{formatProvision(provision)}</span>
    </div>
  );
}

export function CompactLeagueView() {
  const { data: season } = useActiveSeason();
  const { data: enrollment } = useMyEnrollment(season?.id);
  const isEnrolled = !!enrollment;
  const { data: currentEmployeeId } = useCurrentEmployeeId();
  const { data: allStandings = [] } = useQualificationStandings(season?.id);
  const { data: enrollmentCount = 0 } = useEnrollmentCount(season?.id);

  if (!season) return null;

  const topThree = allStandings.slice(0, 3);
  const myIndex = currentEmployeeId
    ? allStandings.findIndex((s: QualificationStanding) => s.employee_id === currentEmployeeId)
    : -1;
  const myStanding = myIndex >= 0 ? allStandings[myIndex] : null;
  const showMyRow = isEnrolled && myStanding && myIndex > 2;

  return (
    <HomeCard
      icon={Trophy}
      title="Din liga-position"
      action={
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span className="tabular-nums">{enrollmentCount}</span> tilmeldt
        </span>
      }
      contentClassName="flex flex-col gap-3 p-3 md:p-4"
    >
      {allStandings.length === 0 ? (
        <HomeCardEmpty
          icon={Trophy}
          title="Ingen stilling endnu"
          hint="Stillingen opdateres når der er registreret salg i sæsonen"
        />
      ) : (
        <div className="flex-1 space-y-0.5">
          {topThree.map((standing: QualificationStanding, index: number) => (
            <StandingRow
              key={standing.id}
              rank={standing.overall_rank || index + 1}
              name={formatPlayerName(standing.employee)}
              provision={standing.current_provision || 0}
              isMe={standing.employee_id === currentEmployeeId}
            />
          ))}

          {showMyRow && myStanding && (
            <div className="mt-1 border-t border-border/40 pt-1">
              <StandingRow
                rank={myStanding.overall_rank || myIndex + 1}
                name={formatPlayerName(myStanding.employee)}
                provision={myStanding.current_provision || 0}
                isMe
              />
            </div>
          )}

          {isEnrolled && !myStanding && (
            <p className="pt-1 text-xs text-muted-foreground">
              Du er tilmeldt — din placering vises efter dit første salg i sæsonen.
            </p>
          )}
        </div>
      )}

      <Button asChild variant="outline" size="sm" className="h-9 w-full gap-2">
        <Link to="/commission-league">
          Se fuld liga
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    </HomeCard>
  );
}
