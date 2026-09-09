import { Link } from "react-router-dom";
import { Trophy, ArrowRight, Users, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  useActiveSeason, 
  useMyEnrollment, 
  useQualificationStandings,
  useEnrollmentCount,
  type QualificationStanding 
} from "@/hooks/useLeagueData";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { formatPlayerName } from "@/lib/formatPlayerName";

function getNeighborStandings(
  allStandings: QualificationStanding[],
  myEmployeeId: string | null
): { visibleStandings: QualificationStanding[]; myIndex: number } {
  if (!myEmployeeId || allStandings.length === 0) {
    return { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };
  }

  const myIndex = allStandings.findIndex(s => s.employee_id === myEmployeeId);
  
  if (myIndex === -1) {
    return { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };
  }

  const total = allStandings.length;
  
  if (total <= 5) {
    return { visibleStandings: allStandings, myIndex };
  }

  let start = myIndex - 2;
  let end = myIndex + 3;

  if (start < 0) {
    start = 0;
    end = Math.min(5, total);
  }
  
  if (end > total) {
    end = total;
    start = Math.max(0, total - 5);
  }

  return { 
    visibleStandings: allStandings.slice(start, end), 
    myIndex: myIndex - start
  };
}

export function CompactLeagueView() {
  const { data: season } = useActiveSeason();
  const { data: enrollment } = useMyEnrollment(season?.id);
  const isEnrolled = !!enrollment;
  const { data: currentEmployeeId } = useCurrentEmployeeId();
  const { data: allStandings = [] } = useQualificationStandings(season?.id);
  const { data: enrollmentCount = 0 } = useEnrollmentCount(season?.id);

  const formatProvision = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  const isPodium = (rank: number) => rank >= 1 && rank <= 3;

  if (!season) return null;

  const { visibleStandings, myIndex } = isEnrolled
    ? getNeighborStandings(allStandings, currentEmployeeId || null)
    : { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };

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
            Liga · denne periode
          </CardTitle>
          <span className="text-[13px] text-foreground/70">{enrollmentCount} tilmeldt</span>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {visibleStandings.length > 0 && (
          <div className="divide-y divide-[hsl(var(--cph-onyx)/0.1)] border-t border-[hsl(var(--cph-onyx)/0.1)]">
            {visibleStandings.map((standing, index) => {
              const isMe = standing.employee_id === currentEmployeeId;
              const rank = standing.overall_rank || index + 1;
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
                  <span
                    className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] font-extrabold ${
                      rank === 1
                        ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-emerald))] ring-2 ring-[hsl(var(--cph-emerald))]"
                        : "bg-[hsl(var(--cph-light-blue))] text-[hsl(var(--cph-onyx))]"
                    }`}
                  >
                    {getInitials(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-extrabold text-foreground">
                      {name}
                      {isMe && <span className="ml-1 font-normal text-foreground/70">(dig)</span>}
                    </p>
                    <p className="text-[13px] text-foreground/70">
                      {standing.sales_count ? `${standing.sales_count} salg` : "Ingen salg endnu"}
                    </p>
                  </div>
                  <span className="text-[20px] font-extrabold tracking-[-0.02em] tabular-nums text-foreground">
                    {formatProvision(standing.current_provision || 0)}
                  </span>
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

