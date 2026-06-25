import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useActiveEvent, useRulesForEvent, useScoresForEvent, computeStandings, useUpdateEvent } from "@/hooks/usePowerdagData";
import { useAutoReload, isTvMode } from "@/utils/tvMode";
import { Trophy, Crown, Star, Pencil, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { TvBoardQuickGenerator } from "@/components/dashboard/TvBoardQuickGenerator";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { useCachedLeaderboard, formatDisplayName } from "@/hooks/useCachedLeaderboard";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Suspense window: from 15:00 on event day the points are hidden behind a
// "???" placeholder. From 16:30 a reveal button appears (only for users with
// edit access) — pressing it flips `is_revealed` on the event and the points
// re-appear for everyone.
const HIDE_HOUR = 15;
const HIDE_MIN = 0;
const REVEAL_HOUR = 16;
const REVEAL_MIN = 30;

function eventDayAt(eventDate: string, hour: number, minute: number): Date {
  // event_date is "YYYY-MM-DD". Construct in local (Danish) time.
  const [y, m, d] = eventDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0);
}


const PODIUM_TONES = [
  // index 0 = 1st (gold)
  { ring: "ring-yellow-400/60", text: "text-yellow-400", badge: "bg-yellow-400 text-black", glow: "shadow-[0_0_60px_-10px_rgba(250,204,21,0.45)]", border: "border-yellow-400/50" },
  // index 1 = 2nd (silver)
  { ring: "ring-slate-300/30", text: "text-slate-200", badge: "bg-slate-300 text-black", glow: "", border: "border-white/5" },
  // index 2 = 3rd (bronze)
  { ring: "ring-orange-400/30", text: "text-orange-300", badge: "bg-orange-400 text-black", glow: "", border: "border-white/5" },
];

// Display order: 2nd, 1st (center), 3rd
const PODIUM_ORDER = [1, 0, 2];

const REST_BAR_COLORS = ["bg-emerald-400", "bg-violet-400", "bg-rose-400", "bg-sky-400", "bg-amber-400"];

function formatPoints(n: number) {
  return n.toLocaleString("da-DK", { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 });
}

function useNowClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PowerdagBoard() {
  const tv = isTvMode();
  useAutoReload(tv, 5 * 60_000);
  const { canView } = useUnifiedPermissions();
  const hasEditAccess = canView("menu_powerdag_input");
  const now = useNowClock();

  const { data: event } = useActiveEvent();
  const { data: rules = [] } = useRulesForEvent(event?.id);
  const { data: scores = [] } = useScoresForEvent(event?.id);
  const updateEvent = useUpdateEvent();

  const standings = computeStandings(rules, scores);
  const leaderPoints = standings[0]?.total_points ?? 1;
  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);

  // Suspense / reveal phase
  const hideAt = event ? eventDayAt(event.event_date, HIDE_HOUR, HIDE_MIN) : null;
  const revealAt = event ? eventDayAt(event.event_date, REVEAL_HOUR, REVEAL_MIN) : null;
  const isSuspense = !!event && !event.is_revealed && !!hideAt && now >= hideAt;
  const canRevealNow = isSuspense && !!revealAt && now >= revealAt && hasEditAccess;
  const msUntilReveal = revealAt ? revealAt.getTime() - now.getTime() : 0;

  const handleReveal = async () => {
    if (!event) return;
    try {
      await updateEvent.mutateAsync({ id: event.id, patch: { is_revealed: true } });
      toast.success("Vinderen er afsløret!");
    } catch (e: any) {
      toast.error("Kunne ikke afsløre: " + (e?.message ?? "ukendt fejl"));
    }
  };

  const updatedAt = now.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");



  return (
    <DashboardShell>
      <div className={`${tv ? "p-8" : "p-4 md:p-8"} max-w-[1600px] mx-auto`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-4 min-w-0">
            <div className="rounded-2xl bg-yellow-400/10 border border-yellow-400/20 p-3 flex-shrink-0">
              <Trophy className="h-7 w-7 text-yellow-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {event && !tv && hasEditAccess ? (
                  <EditableEventName event={event} />
                ) : (
                  <h1 className={`${tv ? "text-5xl" : "text-3xl md:text-4xl"} font-black tracking-tight`}>{event?.name ?? "Powerdag"}</h1>
                )}
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>
              {event && (
                !tv && hasEditAccess ? (
                  <EditableEventDate event={event} />
                ) : (
                  <p className="text-sm text-muted-foreground mt-1 capitalize">
                    {new Date(event.event_date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Opdateret</p>
              <p className={`tabular-nums font-light ${tv ? "text-3xl" : "text-2xl"}`}>{updatedAt}</p>
            </div>
            {!tv && hasEditAccess && (
              <div className="flex items-center gap-2">
                <TvBoardQuickGenerator dashboardSlug="powerdag" />
                <Link to="/dashboards/powerdag/input">
                  <Button variant="outline" size="sm">Indtast salg</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {standings.length === 0 ? (
          <p className="text-muted-foreground text-center py-20">Ingen data endnu – start med at indtaste salg.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: team competition */}
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-baseline gap-3">
                <h2 className={`${tv ? "text-2xl" : "text-lg"} font-bold`}>Holdkonkurrencen</h2>
                <span className="text-xs text-muted-foreground">
                  {isSuspense ? "· lukket – afsløres kl. 16.30" : "· point i dag"}
                </span>
              </div>

              {isSuspense ? (
                <SuspensePanel
                  teams={standings.map(s => s.team_name)}
                  tv={tv}
                  canRevealNow={canRevealNow}
                  msUntilReveal={msUntilReveal}
                  onReveal={handleReveal}
                  isRevealing={updateEvent.isPending}
                />
              ) : (
                <>
                  {/* Podium */}
                  {top3.length >= 3 && (
                    <div className="grid grid-cols-3 gap-3 md:gap-4 items-end">
                      {PODIUM_ORDER.map((rankIdx, displayIdx) => {
                        const team = top3[rankIdx];
                        const cfg = PODIUM_TONES[rankIdx];
                        const isFirst = rankIdx === 0;
                        return (
                          <div
                            key={team.team_name}
                            className={`relative rounded-2xl border ${cfg.border} bg-card/40 backdrop-blur px-4 py-6 text-center ${isFirst ? `${cfg.glow} ring-2 ${cfg.ring}` : ""}`}
                            style={{
                              animation: `fade-in 0.5s ease-out ${displayIdx * 0.12}s both`,
                              minHeight: isFirst ? (tv ? 320 : 270) : (tv ? 260 : 220),
                            }}
                          >
                            {isFirst && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                <span className="text-[10px] font-black tracking-[0.25em] text-yellow-400 mb-0.5">FØRER</span>
                                <Crown className="h-7 w-7 text-yellow-400 fill-yellow-400" />
                              </div>
                            )}
                            <div className={`mx-auto mb-3 h-10 w-10 rounded-full flex items-center justify-center font-black text-base ${cfg.badge} shadow-lg`}>
                              {rankIdx + 1}
                            </div>
                            <p className={`font-black tabular-nums leading-none ${cfg.text} ${tv ? "text-7xl" : "text-5xl md:text-6xl"}`}>
                              {formatPoints(team.total_points)}
                            </p>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-2">Point</p>
                            <p className={`font-bold mt-4 truncate ${tv ? "text-xl" : "text-base"}`}>{team.team_name}</p>
                            {team.sub_entries.length > 1 && team.sub_entries.some(e => e.sub_client_name) && (
                              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                {team.sub_entries.map(e => e.sub_client_name ?? team.team_name).join(" · ")}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {top3.length < 3 && top3.length > 0 && (
                    <div className="space-y-3">
                      {top3.map((team, i) => (
                        <RestTeamRow key={team.team_name} team={team} rank={i + 1} leaderPoints={leaderPoints} barColor={REST_BAR_COLORS[i % REST_BAR_COLORS.length]} tv={tv} />
                      ))}
                    </div>
                  )}

                  {/* Rest */}
                  {rest.length > 0 && (
                    <div className="space-y-3 pt-2">
                      {rest.map((team, i) => (
                        <RestTeamRow
                          key={team.team_name}
                          team={team}
                          rank={i + 4}
                          leaderPoints={leaderPoints}
                          barColor={REST_BAR_COLORS[i % REST_BAR_COLORS.length]}
                          tv={tv}
                          delay={i * 0.08}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>


            {/* RIGHT: Top 5 sellers */}
            <div className="space-y-5">
              <div className="flex items-baseline gap-3">
                <h2 className={`${tv ? "text-2xl" : "text-lg"} font-bold flex items-center gap-2`}>
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  Top 10
                </h2>
                <span className="text-xs text-muted-foreground">· i dag</span>
              </div>
              <TopSellersList tv={tv} />
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

const SELLER_AVATAR_COLORS = [
  "bg-yellow-400 text-black",
  "bg-emerald-400 text-black",
  "bg-yellow-300 text-black",
  "bg-sky-400 text-black",
  "bg-orange-400 text-black",
];

const SELLER_RANK_COLORS = [
  "bg-yellow-400 text-black",
  "bg-slate-300 text-black",
  "bg-orange-400 text-black",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
];

function RestTeamRow({ team, rank, leaderPoints, barColor, tv, delay = 0 }: {
  team: ReturnType<typeof computeStandings>[number];
  rank: number;
  leaderPoints: number;
  barColor: string;
  tv: boolean;
  delay?: number;
}) {
  const pct = leaderPoints > 0 ? Math.min(100, (team.total_points / leaderPoints) * 100) : 0;
  const subs = team.sub_entries.filter(e => e.sub_client_name).map(e => e.sub_client_name!);

  return (
    <div
      className="rounded-2xl border border-white/5 bg-card/40 backdrop-blur px-4 py-3.5"
      style={{ animation: `fade-in 0.4s ease-out ${delay}s both` }}
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted/40 border border-white/5 flex items-center justify-center font-bold text-muted-foreground">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
              <p className={`font-bold truncate ${tv ? "text-xl" : "text-base"}`}>{team.team_name}</p>
              {subs.length > 0 && (
                <p className="text-[11px] text-muted-foreground truncate">{subs.join(" · ")}</p>
              )}
            </div>
            <p className={`font-black tabular-nums flex-shrink-0 ${tv ? "text-3xl" : "text-2xl"}`}>
              {formatPoints(team.total_points)}
              <span className="text-xs font-normal text-muted-foreground ml-1">pt</span>
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TopSellersList({ tv }: { tv: boolean }) {
  const { data: topSellers = [] } = useCachedLeaderboard("today", { type: "global" }, { limit: 10 });

  if (topSellers.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Ingen sælgerdata endnu.</p>;
  }

  return (
    <div className="space-y-3">
      {topSellers.map((seller, idx) => {
        const isFirst = idx === 0;
        return (
          <div
            key={seller.employeeId}
            className={`flex items-center gap-3 rounded-2xl border bg-card/40 backdrop-blur px-3.5 py-3 ${isFirst ? "border-yellow-400/40 ring-1 ring-yellow-400/30 shadow-[0_0_40px_-15px_rgba(250,204,21,0.5)]" : "border-white/5"}`}
            style={{ animation: `fade-in 0.4s ease-out ${idx * 0.08}s both` }}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${SELLER_RANK_COLORS[idx] ?? SELLER_RANK_COLORS[3]}`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold truncate ${tv ? "text-lg" : "text-sm"}`}>
                {formatDisplayName(seller.employeeName)}
              </p>
              {seller.teamName && (
                <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                  {seller.teamName}
                </span>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`font-black tabular-nums ${isFirst ? "text-yellow-400" : ""} ${tv ? "text-2xl" : "text-xl"}`}>
                {seller.commission.toLocaleString("da-DK")}
                <span className="text-xs font-normal text-muted-foreground ml-1">kr.</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EditableEventName({ event }: { event: { id: string; name: string } }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(event.name);
  const update = useUpdateEvent();

  const save = async () => {
    const trimmed = value.trim();
    setEditing(false);
    if (!trimmed || trimmed === event.name) { setValue(event.name); return; }
    try {
      await update.mutateAsync({ id: event.id, patch: { name: trimmed } });
      toast.success("Titel opdateret");
    } catch (e: any) {
      toast.error("Kunne ikke gemme: " + (e?.message ?? "ukendt fejl"));
      setValue(event.name);
    }
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setValue(event.name); setEditing(false); }
        }}
        className="h-auto py-1 text-3xl md:text-4xl font-black w-auto min-w-[280px]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-muted/50 transition-colors"
      title="Klik for at redigere"
    >
      <h1 className="text-3xl md:text-4xl font-black tracking-tight">{event.name}</h1>
      <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function EditableEventDate({ event }: { event: { id: string; event_date: string } }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(event.event_date);
  const update = useUpdateEvent();

  const formatted = new Date(event.event_date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const save = async () => {
    setEditing(false);
    if (!value || value === event.event_date) { setValue(event.event_date); return; }
    try {
      await update.mutateAsync({ id: event.id, patch: { event_date: value } });
      toast.success("Dato opdateret");
    } catch (e: any) {
      toast.error("Kunne ikke gemme: " + (e?.message ?? "ukendt fejl"));
      setValue(event.event_date);
    }
  };

  if (editing) {
    return (
      <Input
        autoFocus
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setValue(event.event_date); setEditing(false); }
        }}
        className="h-auto py-1 text-sm w-auto mt-1"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group mt-1 inline-flex items-center gap-2 rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
      title="Klik for at redigere"
    >
      <span className="text-sm text-muted-foreground capitalize">{formatted}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function SuspensePanel({
  teams,
  tv,
  canRevealNow,
  msUntilReveal,
  onReveal,
  isRevealing,
}: {
  teams: string[];
  tv: boolean;
  canRevealNow: boolean;
  msUntilReveal: number;
  onReveal: () => void;
  isRevealing: boolean;
}) {
  return (
    <div className="space-y-5">
      <div
        className="relative overflow-hidden rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 via-amber-500/5 to-rose-500/10 px-6 py-10 text-center"
        style={{ animation: "fade-in 0.5s ease-out both" }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-yellow-400/30 blur-3xl animate-pulse" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-rose-400/30 blur-3xl animate-pulse" />
        </div>
        <div className="relative">
          <div className="mx-auto mb-4 inline-flex items-center justify-center h-14 w-14 rounded-full bg-yellow-400/20 border border-yellow-400/40">
            <Lock className="h-6 w-6 text-yellow-400" />
          </div>
          <h3 className={`font-black tracking-tight ${tv ? "text-4xl" : "text-2xl md:text-3xl"}`}>
            Pointene er låst
          </h3>
          <p className={`mt-2 text-muted-foreground ${tv ? "text-xl" : "text-base"}`}>
            Sidste heat er i gang. Vinderen afsløres kl. 16.30.
          </p>

          {canRevealNow ? (
            <Button
              size="lg"
              onClick={onReveal}
              disabled={isRevealing}
              className="mt-6 bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase tracking-wider shadow-[0_0_40px_-5px_rgba(250,204,21,0.6)]"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              {isRevealing ? "Afslører…" : "Afslør vinderen"}
            </Button>
          ) : (
            <div className="mt-6 inline-flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Tid til afsløring
              </span>
              <span className={`tabular-nums font-black text-yellow-400 ${tv ? "text-5xl" : "text-4xl"}`}>
                {formatCountdown(msUntilReveal)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Team list without points */}
      <div className="space-y-2.5">
        {teams.map((name, i) => (
          <div
            key={name}
            className="flex items-center gap-4 rounded-2xl border border-white/5 bg-card/40 backdrop-blur px-4 py-3.5"
            style={{ animation: `fade-in 0.4s ease-out ${i * 0.06}s both` }}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted/40 border border-white/5 flex items-center justify-center">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className={`flex-1 font-bold truncate ${tv ? "text-xl" : "text-base"}`}>{name}</p>
            <p
              className={`font-black tabular-nums text-muted-foreground/60 ${tv ? "text-3xl" : "text-2xl"}`}
              aria-label="Skjult"
            >
              ???
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

