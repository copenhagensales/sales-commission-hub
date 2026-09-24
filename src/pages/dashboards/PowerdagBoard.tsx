import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useActiveEvent, useRulesForEvent, useScoresForEvent, computeStandings, useUpdateEvent } from "@/hooks/usePowerdagData";
import { useAutoReload, isTvMode } from "@/utils/tvMode";
import { Trophy, Crown, Star, Pencil, Sparkles, Lock, Plus, Play, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { TvBoardQuickGenerator } from "@/components/dashboard/TvBoardQuickGenerator";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { useCachedLeaderboard, formatDisplayName, type LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
import { useDisplayNameOverrides } from "@/hooks/useDisplayNameOverrides";
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


// Display order: 2nd, 1st (center), 3rd
const PODIUM_ORDER = [1, 0, 2];


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
  useDisplayNameOverrides();
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



  const { data: topSellers = [] } = useCachedLeaderboard("today", { type: "global" }, { limit: 10 });

  const tickerItems: string[] = [];
  topSellers.slice(0, 3).forEach((s) => tickerItems.push(`${formatDisplayName(s.employeeName)} · ${s.commission.toLocaleString("da-DK")} kr.`));
  if (standings.length > 0) {
    if (!isSuspense && standings.every((s) => s.total_points === 0)) {
      tickerItems.push("Alle hold står på 0 point – første salg tager føringen");
    }
    if (!isSuspense) tickerItems.push(`${standings[0].team_name} fører holdkonkurrencen`);
    else tickerItems.push("Pointene er låst – vinderen afsløres kl. 16.30");
  }
  if (tickerItems.length === 0) tickerItems.push("Powerdag er i gang – kom så!");

  const nameParts = (event?.name ?? "Powerdag").split(" ");
  const titleHead = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0];
  const titleTail = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

  return (
    <DashboardShell>
      <div className={`pd-board ${tv ? "p-10" : "p-4 md:p-8"}`}>
        <div className="pd-rays" aria-hidden />
        <div className="relative max-w-[1700px] mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
            <div className="flex items-center gap-5 min-w-0">
              <div className="pd-trophy flex-shrink-0">
                <Trophy className={tv ? "h-10 w-10" : "h-8 w-8"} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-4 flex-wrap">
                  {event && !tv && hasEditAccess ? (
                    <EditableEventName event={event} head={titleHead} tail={titleTail} tv={tv} />
                  ) : (
                    <PowerTitle head={titleHead} tail={titleTail} tv={tv} />
                  )}
                  <span className="pd-live">
                    <span className="pd-live-dot" />
                    Live
                  </span>
                </div>
                {event && (
                  !tv && hasEditAccess ? (
                    <EditableEventDate event={event} />
                  ) : (
                    <p className="pd-sub mt-1 first-letter:uppercase">
                      {new Date(event.event_date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="text-center">
                <p className="pd-eyebrow flex items-center gap-1.5 justify-center"><RefreshCw className="h-3 w-3" />Opdateret</p>
                <p className={`pd-num leading-none mt-1 ${tv ? "text-6xl" : "text-4xl md:text-5xl"}`}>{updatedAt}</p>
              </div>
              {!tv && hasEditAccess && (
                <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                  <TvBoardQuickGenerator dashboardSlug="powerdag" />
                  <Link to="/dashboards/powerdag/input">
                    <Button variant="outline" className="pd-btn-ghost"><Plus className="h-4 w-4 mr-1.5" />Indtast salg</Button>
                  </Link>
                  <Link to="/dashboards/powerdag/admin">
                    <Button className="pd-btn-primary"><Play className="h-4 w-4 mr-1.5 fill-current" />Start nyt spil</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {standings.length === 0 ? (
            <p className="pd-sub text-center py-20">Ingen data endnu – start med at indtaste salg.</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-8">
              {/* LEFT: team competition */}
              <div className="space-y-5 min-w-0">
                <div className="flex items-baseline gap-3">
                  <h2 className={`pd-h2 ${tv ? "text-4xl" : "text-2xl md:text-3xl"}`}>Holdkonkurrencen</h2>
                  <span className="pd-sub">{isSuspense ? "· lukket – afsløres kl. 16.30" : "· point i dag"}</span>
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
                    {top3.length >= 3 && (
                      <div className="grid grid-cols-3 gap-4 md:gap-7 items-end pt-10">
                        {PODIUM_ORDER.map((rankIdx, displayIdx) => {
                          const team = top3[rankIdx];
                          const tone = ["gold", "silver", "bronze"][rankIdx];
                          const isFirst = rankIdx === 0;
                          const subs = team.sub_entries.filter(e => e.sub_client_name).map(e => e.sub_client_name!);
                          return (
                            <div key={team.team_name} style={{ animation: `fade-in 0.5s ease-out ${displayIdx * 0.12}s both` }}>
                              <div
                                className={`pd-podium pd-${tone} relative text-center px-4 ${isFirst ? "pt-14 pb-8" : "pt-8 pb-7"}`}
                                style={{ minHeight: isFirst ? (tv ? 420 : 340) : rankIdx === 1 ? (tv ? 340 : 270) : (tv ? 300 : 240) }}
                              >
                                {isFirst && (
                                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                    <span className="pd-eyebrow pd-accent mb-1">Fører</span>
                                    <Crown className="h-9 w-9 pd-accent fill-current" />
                                  </div>
                                )}
                                <div className={`pd-rank-badge mx-auto mb-4 ${isFirst ? "h-16 w-16 text-2xl" : "h-12 w-12 text-xl"}`}>{rankIdx + 1}</div>
                                <p className={`pd-num pd-tone-text leading-none ${isFirst ? (tv ? "text-[9rem]" : "text-8xl") : (tv ? "text-8xl" : "text-7xl")}`}>
                                  {formatPoints(team.total_points)}
                                </p>
                                <p className="pd-eyebrow mt-4">Point</p>
                                <p className={`pd-team mt-4 truncate ${isFirst ? (tv ? "text-4xl" : "text-3xl") : (tv ? "text-3xl" : "text-2xl")}`}>{team.team_name}</p>
                                {subs.length > 1 && <p className="pd-eyebrow mt-2 truncate">{subs.join(" · ")}</p>}
                              </div>
                              <div className={`pd-plinth pd-${tone} ${isFirst ? "h-24" : rankIdx === 1 ? "h-16" : "h-10"}`}>
                                <span className="pd-num">{rankIdx + 1}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {top3.length < 3 && top3.length > 0 && (
                      <div className="space-y-3">
                        {top3.map((team, i) => (
                          <RestTeamRow key={team.team_name} team={team} rank={i + 1} leaderPoints={leaderPoints} tv={tv} />
                        ))}
                      </div>
                    )}

                    {rest.length > 0 && (
                      <div className="space-y-3 pt-2">
                        {rest.map((team, i) => (
                          <RestTeamRow key={team.team_name} team={team} rank={i + 4} leaderPoints={leaderPoints} tv={tv} delay={i * 0.08} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT: Top 10 sellers */}
              <div className="space-y-5 min-w-0">
                <div className="flex items-baseline gap-3">
                  <h2 className={`pd-h2 flex items-center gap-3 ${tv ? "text-4xl" : "text-2xl md:text-3xl"}`}>
                    <Star className="h-6 w-6 pd-accent fill-current" />
                    Top 10
                  </h2>
                  <span className="pd-sub">· i dag</span>
                </div>
                <TopSellersList tv={tv} topSellers={topSellers} />
              </div>
            </div>
          )}

          {/* Ticker */}
          <div className="pd-ticker mt-8">
            <div className="pd-ticker-label"><Zap className="h-4 w-4 fill-current" />Powerdag</div>
            <div className="pd-ticker-track">
              <div className="pd-ticker-move">
                {[0, 1].map((dup) => (
                  <div key={dup} className="flex items-center" aria-hidden={dup === 1}>
                    {tickerItems.map((t, i) => (
                      <span key={i} className="flex items-center">
                        <span className="px-8 whitespace-nowrap">{t}</span>
                        <Star className="h-4 w-4 pd-accent fill-current" />
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function PowerTitle({ head, tail, tv }: { head: string; tail: string; tv: boolean }) {
  return (
    <h1 className={`pd-title ${tv ? "text-8xl" : "text-5xl md:text-7xl"}`}>
      {head}
      {tail && <> <span className="pd-title-accent">{tail}</span></>}
    </h1>
  );
}

type Standing = ReturnType<typeof computeStandings>[number];

function RestTeamRow({ team, rank, leaderPoints, tv, delay = 0 }: {
  team: Standing;
  rank: number;
  leaderPoints: number;
  tv: boolean;
  delay?: number;
}) {
  const pct = leaderPoints > 0 ? Math.min(100, (team.total_points / leaderPoints) * 100) : 0;
  const subs = team.sub_entries.filter(e => e.sub_client_name).map(e => e.sub_client_name!);

  return (
    <div className="pd-row px-6 py-5" style={{ animation: `fade-in 0.4s ease-out ${delay}s both` }}>
      <div className="flex items-center gap-6">
        <div className="pd-rank-ring h-14 w-14 text-xl flex-shrink-0">{rank}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-4 min-w-0">
            <p className={`pd-team truncate ${tv ? "text-3xl" : "text-2xl"}`}>{team.team_name}</p>
            {subs.length > 0 && <p className="pd-eyebrow truncate">{subs.join(" · ")}</p>}
          </div>
          <div className="pd-bar mt-3">
            <div className="pd-bar-fill" style={{ width: `${Math.max(pct, 0)}%` }} />
          </div>
        </div>
        <p className={`pd-num flex-shrink-0 ${tv ? "text-6xl" : "text-5xl"}`}>
          {formatPoints(team.total_points)}
          <span className="pd-unit ml-1.5">pt</span>
        </p>
      </div>
    </div>
  );
}


function TopSellersList({ tv, topSellers }: { tv: boolean; topSellers: LeaderboardEntry[] }) {
  if (topSellers.length === 0) {
    return <p className="pd-sub py-8 text-center">Ingen sælgerdata endnu.</p>;
  }
  const lead = topSellers.length > 1 ? topSellers[0].commission - topSellers[1].commission : 0;

  return (
    <div className="space-y-3">
      {topSellers.map((seller, idx) => {
        const isFirst = idx === 0;
        const tone = idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : "plain";
        return (
          <div
            key={seller.employeeId}
            className={`pd-seller pd-${tone} flex items-center gap-5 ${isFirst ? "px-6 py-6" : "px-6 py-3.5"}`}
            style={{ animation: `fade-in 0.4s ease-out ${idx * 0.06}s both` }}
          >
            <div className={`${idx < 3 ? "pd-rank-badge" : "pd-rank-ring"} flex-shrink-0 ${isFirst ? "h-20 w-20 text-3xl" : "h-12 w-12 text-lg"}`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`flex items-center gap-3 min-w-0 ${isFirst ? "" : "flex-wrap"}`}>
                <p className={`pd-name truncate ${isFirst ? (tv ? "text-4xl" : "text-3xl") : (tv ? "text-2xl" : "text-xl")}`}>
                  {formatDisplayName(seller.employeeName)}
                </p>
                {isFirst && <Crown className="h-6 w-6 pd-accent fill-current flex-shrink-0" />}
                {!isFirst && seller.teamName && <span className="pd-chip">{seller.teamName}</span>}
              </div>
              {isFirst && (
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {seller.teamName && <span className="pd-chip">{seller.teamName}</span>}
                  {lead > 0 && <span className="pd-accent text-sm font-semibold">+{lead.toLocaleString("da-DK")} kr. foran #2</span>}
                </div>
              )}
            </div>
            <p className={`pd-num pd-tone-text flex-shrink-0 ${isFirst ? (tv ? "text-8xl" : "text-6xl") : (tv ? "text-5xl" : "text-4xl")}`}>
              {seller.commission.toLocaleString("da-DK")}
              <span className="pd-unit ml-1.5">kr.</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

function EditableEventName({ event, head, tail, tv }: { event: { id: string; name: string }; head: string; tail: string; tv: boolean }) {
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
      <PowerTitle head={head} tail={tail} tv={tv} />
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
      <span className="pd-sub first-letter:uppercase">{formatted}</span>
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

