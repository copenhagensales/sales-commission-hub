import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useActiveEvent, useRulesForEvent, useScoresForEvent, computeStandings } from "@/hooks/usePowerdagData";
import { useAutoReload, isTvMode } from "@/utils/tvMode";
import { Trophy, Zap, Flame, ChevronDown } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";

const RANK_ICONS = [
  <Flame className="h-6 w-6 text-yellow-400 animate-pulse" />,
  <Zap className="h-5 w-5 text-blue-400" />,
  <Zap className="h-5 w-5 text-emerald-400" />,
];

const RANK_COLORS = [
  "from-yellow-500/20 to-orange-500/10 border-yellow-500/40",
  "from-blue-500/15 to-blue-500/5 border-blue-500/30",
  "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30",
];

export default function PowerdagBoard() {
  const tv = isTvMode();
  useAutoReload(tv, 5 * 60_000);
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("powerdag");

  const { data: event } = useActiveEvent();
  const { data: rules = [] } = useRulesForEvent(event?.id);
  const { data: scores = [] } = useScoresForEvent(event?.id);

  const standings = computeStandings(rules, scores);

  if (accessLoading) return <DashboardShell><div className="flex items-center justify-center h-64 text-muted-foreground">Indlæser...</div></DashboardShell>;
  if (!canView) return null;

  return (
    <DashboardShell>
      <div className={`${tv ? "p-6" : "p-4 md:p-6"} max-w-4xl mx-auto space-y-6`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <Trophy className="h-7 w-7 text-yellow-500" />
              {event?.name ?? "Powerdag"}
            </h1>
            {event && <p className="text-sm text-muted-foreground mt-1">{new Date(event.event_date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>}
          </div>
          {!tv && (
            <Link to="/dashboards/powerdag/input">
              <Button variant="outline" size="sm">Indtast salg</Button>
            </Link>
          )}
        </div>

        {/* Standings */}
        {standings.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Ingen data endnu — start med at indtaste salg.</p>
        ) : (
          <div className="space-y-3">
            {standings.map((team, i) => {
              const isComposite = team.sub_entries.length > 1 || team.sub_entries.some(e => e.sub_client_name);

              return (
                <div
                  key={team.team_name}
                  className={`rounded-xl border bg-gradient-to-r p-4 md:p-5 transition-all ${i < 3 ? RANK_COLORS[i] : "from-card to-card border-border"}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-background/60 flex items-center justify-center font-bold text-lg">
                      {i < 3 ? RANK_ICONS[i] : <span className="text-muted-foreground">{i + 1}</span>}
                    </div>

                    {/* Team name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg truncate">{team.team_name}</p>
                      {isComposite && (
                        <p className="text-xs text-muted-foreground">
                          {team.sub_entries.map(e => e.sub_client_name ?? team.team_name).join(" · ")}
                        </p>
                      )}
                    </div>

                    {/* Points */}
                    <div className="text-right">
                      <p className={`font-black ${tv ? "text-4xl" : "text-3xl"} tabular-nums`}>
                        {team.total_points % 1 === 0 ? team.total_points : team.total_points.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Point</p>
                    </div>
                  </div>

                  {/* Sub-entries for composite teams */}
                  {isComposite && !tv && (
                    <Accordion type="single" collapsible className="mt-2">
                      <AccordionItem value="details" className="border-0">
                        <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
                          Vis detaljer
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-3 gap-1 text-xs">
                            <span className="font-medium text-muted-foreground">Klient</span>
                            <span className="font-medium text-muted-foreground text-right">Salg</span>
                            <span className="font-medium text-muted-foreground text-right">Point</span>
                            {team.sub_entries.map((e, j) => (
                              <div key={j} className="contents">
                                <span>{e.sub_client_name ?? team.team_name}</span>
                                <span className="text-right tabular-nums">{e.sales_count}</span>
                                <span className="text-right tabular-nums">{e.points % 1 === 0 ? e.points : e.points.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
