import { BOTTOM_NAV_HEIGHT, useIsPhone } from "@/components/mobile";
import { lazy, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StorkbookMark } from "@/components/storkbook/StorkbookMark";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Samleside } from "@/components/layout/Samleside";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useStorkbookChatUnread } from "@/hooks/useStorkbookUnread";
import { ChevronDown, Lock, Sun, Users } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CelebrationLines } from "@/components/pulsen/CelebrationLine";
import { TodayMilestonesCard, milestoneNumber, milestoneUnit } from "@/components/pulsen/TodayMilestones";
import { fillMilestoneDay } from "@/lib/pulsen/format";
import { MilestoneHeroCard } from "@/components/pulsen/MilestoneHeroCard";
import { EventRsvpCard } from "@/components/home/EventRsvpCard";
import { EventDetailDialog } from "@/components/home/EventDetailDialog";
import { EditEventDialog } from "@/components/home/EditEventDialog";
import { AddEventDialog } from "@/components/home/AddEventDialog";
import { PulsenComposer, type Mode as ComposeMode } from "@/components/pulsen/PulsenComposer";
import { PulsenPostCard } from "@/components/pulsen/PulsenPostCard";
import { PulsenSidebar } from "@/components/pulsen/PulsenSidebar";
import { PulsenBegivenheder } from "@/components/pulsen/PulsenBegivenheder";
import { ReactButton } from "@/components/home/FeedReactionRow";
import { PulsenEmpty, PulsenError, PulsenPostSkeleton } from "@/components/pulsen/PulsenStates";
import { useCelebrations } from "@/hooks/useCelebrations";
import {
  useDeleteCompanyEvent, useEventAttendees, useToggleEventAttendance, useUpcomingCompanyEvents, type AttendanceStatus,
} from "@/hooks/useCompanyEvents";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import {
  formatUnread, milestoneTargetKey, postTargetKey, useMarkPulsenSeen, usePulsenFeed, usePulsenImageUrls, usePulsenMe,
  usePulsenMilestonesToday, usePulsenMutations,
  type PulsenPost, type PulsenScope,
} from "@/hooks/usePulsen";
import { cn } from "@/lib/utils";

type FeedItem =
  | { kind: "post"; at: number; post: PulsenPost }
  | { kind: "event"; at: number; eventId: string };

function PulsenFeed() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Storkbook";
    return () => { document.title = prev; };
  }, []);
  const me = usePulsenMe();
  const [tab, setTab] = useState<"house" | "team">("house");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);

  const team = me.teams.find((t) => t.id === teamId) ?? me.teams[0] ?? null;
  const scope: PulsenScope = tab === "team" && team ? { kind: "team", teamId: team.id } : { kind: "house" };
  const isHouse = scope.kind === "house";

  const feed = usePulsenFeed(scope, !!me.employeeId);
  // Dubletfilter: et indlæg kan glide over i næste side, hvis der kommer nye til imellem to hentninger.
  const posts = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages.flat() ?? []).filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [feed.data]);
  const isPhone = useIsPhone();
  const composerRef = useRef<HTMLDivElement | null>(null);
  // Flydende »Nyt indlæg« skjules, mens skrivefeltet er synligt.
  const [composerSynlig, setComposerSynlig] = useState(true);
  useEffect(() => {
    const el = composerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setComposerSynlig(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  });
  const pull = usePullToRefresh(isPhone, () => feed.refetch());
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const composeParam = searchParams.get("compose");
  const initialCompose = (["post", "praise", "question", "image"].includes(composeParam ?? "") ? composeParam : null) as ComposeMode | "image" | null;
  // Gamle links /storkbook?post=<id> sendes videre til opslagets egen side.
  const deepPostId = searchParams.get("post");
  useEffect(() => {
    if (deepPostId) navigate(`/storkbook/indlaeg/${deepPostId}`, { replace: true });
  }, [deepPostId, navigate]);
  // ?team=<id> (fx tilbage fra et teamopslag) vælger Team-fanen.
  const teamParam = searchParams.get("team");
  const teamParamDone = useRef(false);
  useEffect(() => {
    if (!teamParam || teamParamDone.current || !me.teams.some((t) => t.id === teamParam)) return;
    teamParamDone.current = true;
    setTeamId(teamParam);
    setTab("team");
  }, [teamParam, me.teams]);
  const images = usePulsenImageUrls(posts.filter((p) => p.image_path && !p.localImageUrl).map((p) => p.image_path as string));

  const mut = usePulsenMutations(me.self);

  // Dagens højdepunkt: kun husrekord/teamrekord, højst ét (samme hook som højrekolonnen).
  const today = usePulsenMilestonesToday(scope, !!me.employeeId);
  const highlight = (today.data?.items ?? []).find((m) => m.milestone_type === "house_record" || m.milestone_type === "team_record") ?? null;
  // Indlæg har reaktioner i både Huset og team; milepæle kun i Huset.
  const reactionKeys = [
    ...posts.filter((p) => !p.pending).map((p) => postTargetKey(p.id)),
    ...(isHouse && highlight ? [milestoneTargetKey(highlight.id)] : []),
  ];
  const fr = useFeedReactions(reactionKeys);

  const { data: celebrations = [] } = useCelebrations();
  const todayCelebrations = celebrations.filter((c) => c.isToday);
  const { data: events = [] } = useUpcomingCompanyEvents();
  const { data: attendees = [] } = useEventAttendees(events.map((e) => e.id));
  const toggleAttendance = useToggleEventAttendance(me.employeeId);
  const deleteEvent = useDeleteCompanyEvent();
  // Ulæst-badge nulstilles, når siden åbnes.
  const markSeen = useMarkPulsenSeen();
  const seenDone = useRef(false);
  useEffect(() => {
    if (!me.employeeId || seenDone.current) return;
    seenDone.current = true;
    markSeen.mutate(me.employeeId);
  }, [me.employeeId, markSeen]);

  const items: FeedItem[] = useMemo(() => {
    const list: FeedItem[] = posts.map((p) => ({ kind: "post", at: new Date(p.created_at).getTime(), post: p }));
    const oldestPost = feed.hasNextPage && posts.length ? new Date(posts[posts.length - 1].created_at).getTime() : -Infinity;
    if (isHouse) {
      events.forEach((e) => {
        const at = new Date(e.created_at).getTime();
        if (at >= oldestPost) list.push({ kind: "event", at, eventId: e.id });
      });
    }
    return list.sort((a, b) => b.at - a.at);
  }, [posts, events, isHouse, feed.hasNextPage]);

  const attendingFor = (id: string) => attendees.filter((a) => a.event_id === id && a.status === "attending");
  const myStatus = (id: string) => (attendees.find((a) => a.event_id === id && a.employee_id === me.employeeId)?.status ?? null) as AttendanceStatus | null;
  const detailEvent = events.find((e) => e.id === detailEventId);

  const openPost = (id: string) => navigate(`/storkbook/indlaeg/${id}`);

  const contextFor = (p: PulsenPost) => {
    if (p.audience === "team") return [p.author?.job_title, me.teams.find((t) => t.id === p.team_id)?.name].filter(Boolean).join(" / ") || null;
    return p.author?.job_title ?? null;
  };

  const renderBody = () => {
    if (!me.isLoading && !me.employeeId) {
      return <PulsenEmpty icon={Lock} title="Ingen adgang til Storkbook" text="Din bruger er ikke koblet til et medarbejderkort. Kontakt din leder." />;
    }
    if (me.isLoading || feed.isLoading) {
      return <div className="flex flex-col gap-4"><PulsenPostSkeleton /><PulsenPostSkeleton /><PulsenPostSkeleton /></div>;
    }
    if (feed.isError) return <PulsenError onRetry={() => feed.refetch()} />;
    if (items.length === 0) {
      return isHouse
        ? <PulsenEmpty icon={Sun} title="Stille i Huset i dag" text="Der er ikke delt noget endnu. Giv en kollega ros, eller stil et spørgsmål." />
        : <PulsenEmpty icon={Users} title={`Intet i ${team?.name ?? "teamet"} endnu`} text="Vær den første til at dele noget med dit team." />;
    }
    return (
      <div className="flex flex-col gap-4">
        {items.map((item) => {
          if (item.kind === "event") {
            const e = events.find((x) => x.id === item.eventId);
            if (!e) return null;
            const att = attendingFor(e.id);
            return (
              <EventRsvpCard variant="flat"
                  key={`event-${e.id}`}
                  title={e.title}
                  eventDate={e.event_date}
                  eventTime={e.event_time}
                  location={e.location}
                  requiresRegistration={e.requires_registration}
                  attendeeCount={att.length}
                  attendees={att.map((a) => {
                    const emp = (a as { employee?: { id: string; first_name: string | null; last_name: string | null } | null }).employee;
                    return { id: emp?.id ?? a.employee_id, name: `${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`.trim() || "Ukendt" };
                  })}
                  myStatus={myStatus(e.id)}
                  disabled={toggleAttendance.isPending}
                  canManage={me.canManageEvents}
                  onRespond={(status) => toggleAttendance.mutate({ eventId: e.id, status })}
                  onOpenDetail={() => setDetailEventId(e.id)}
                  onEdit={() => setEditEventId(e.id)}
                  onDelete={() => deleteEvent.mutate(e.id)}
                />
            );
          }
          const p = item.post;
          const key = postTargetKey(p.id);
          return (
            <div key={p.id} id={`pulsen-post-${p.id}`}>
              <PulsenPostCard
                post={p}
                isMine={p.author_employee_id === me.employeeId}
                canModerate={me.canModerate(p)}
                contextLabel={contextFor(p)}
                imageUrl={p.image_path ? images.data?.get(p.image_path) : null}
                interactions={!p.pending ? {
                  summary: fr.getReactions(key),
                  comments: fr.getComments(key),
                  canInteract: fr.canInteract,
                  onReact: (reaction) => fr.setReaction.mutate({ targetType: "pulsen_post", targetKey: key, reaction }),
                  onComment: (body, mentions) => fr.addComment.mutateAsync({ targetType: "pulsen_post", targetKey: key, body, mentions }),
                  onDeleteComment: (id) => fr.deleteComment.mutateAsync(id),
                } : undefined}
                onEdit={(body, mentions) => mut.edit.mutateAsync({ id: p.id, body, mentions })}
                onDelete={() => mut.remove.mutate(p, { onError: () => toast.error("Kunne ikke slette opslaget", { description: "Prøv igen." }) })}
                onHide={(hidden) => mut.setHidden.mutate({ id: p.id, hidden }, { onError: () => toast.error("Kunne ikke ændre synligheden", { description: "Prøv igen." }) })}
                onBestAnswer={(commentId) => mut.setBestAnswer.mutate({ id: p.id, commentId }, { onError: () => toast.error("Kunne ikke markere bedste svar", { description: "Prøv igen." }) })}
              />
            </div>
          );
        })}

        {feed.hasNextPage ? (
          <>
          <AutoLoadSentinel active={!!feed.hasNextPage && !feed.isFetching} onVisible={() => { if (!feed.isFetching) feed.fetchNextPage(); }} />
          <button
            type="button"
            onClick={() => { if (!feed.isFetching) feed.fetchNextPage(); }}
            disabled={feed.isFetching}
            className="mx-auto min-h-[44px] rounded-full bg-card px-6 text-[14px] font-extrabold text-foreground hover:bg-[hsl(var(--cph-onyx))] hover:text-[hsl(var(--cph-light-blue))] disabled:opacity-60"
          >
            {feed.isFetching ? "Henter …" : "Indlæs flere"}
          </button>
          </>
        ) : (
          <div className="py-6 text-center">
            <p className="text-[15px] font-extrabold text-foreground">Du er opdateret</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <EventDetailDialog
        event={detailEvent ? { id: detailEvent.id, title: detailEvent.title, event_date: detailEvent.event_date, event_time: detailEvent.event_time, location: detailEvent.location, description: detailEvent.description, requires_registration: detailEvent.requires_registration } : null}
        open={!!detailEventId}
        onOpenChange={(o) => !o && setDetailEventId(null)}
        attendees={attendees.filter((a) => a.event_id === detailEventId).map((a) => {
          const emp = (a as { employee?: { id: string; first_name: string | null; last_name: string | null } | null }).employee;
          return { id: a.id, event_id: a.event_id, employee_id: a.employee_id, status: a.status, employee: emp ? { id: emp.id, first_name: emp.first_name, last_name: emp.last_name } : null };
        })}
        myStatus={detailEventId ? myStatus(detailEventId) : null}
        onToggleAttendance={(status) => detailEventId && toggleAttendance.mutate({ eventId: detailEventId, status })}
        isLoading={toggleAttendance.isPending}
      />
      <EditEventDialog event={editEventId ? events.find((e) => e.id === editEventId) ?? null : null} open={!!editEventId} onOpenChange={(o) => !o && setEditEventId(null)} />
      <AddEventDialog open={addEventOpen} onOpenChange={setAddEventOpen} />

      <div className={cn("min-h-screen bg-background px-4 pt-6 md:px-8", isPhone ? "pb-[76px]" : "pb-16")}>
        <div className="mx-auto grid w-full max-w-[1004px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,680px)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <header className={cn("flex items-center", isPhone ? "flex-nowrap gap-2" : "flex-wrap gap-4")}>
              <div className="flex min-w-0 flex-none items-center gap-2">
                <StorkbookMark variant="full" tone="light" size={isPhone ? 28 : 44} />
                <h1 aria-label="Storkbook" className={cn("font-['Figtree'] font-black lowercase leading-none tracking-[-0.045em]", isPhone ? "text-[18px]" : "text-[32px]")}>
                  <span aria-hidden="true" className="text-[hsl(var(--cph-onyx))]">stork</span>
                  <span aria-hidden="true" className="text-[#146c3c]">book</span>
                </h1>
              </div>
              <div role="tablist" aria-label="Feed" className="flex min-w-0 overflow-hidden rounded-full bg-card p-1">
                <button type="button" role="tab" aria-selected={isHouse} onClick={() => setTab("house")}
                  className={cn("min-h-[40px] rounded-full px-4 text-[14px] font-extrabold", isHouse ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "text-foreground")}>
                  Huset
                </button>
                {team && me.teams.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" role="tab" aria-selected={!isHouse} aria-label={`Team: ${team.name}. Vælg team`}
                        className={cn("flex min-w-0 overflow-hidden min-h-[40px] max-w-[45%] md:max-w-[220px] items-center gap-1 rounded-full px-4 text-[14px] font-extrabold", !isHouse ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "text-foreground")}>
                        <span className="truncate">{team.name}</span><ChevronDown className="h-4 w-4 flex-none" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="rounded-2xl">
                      {me.teams.map((t) => (
                        <DropdownMenuItem key={t.id} className="min-h-[44px] font-extrabold" onSelect={() => { setTeamId(t.id); setTab("team"); }}>{t.name}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : team && (
                  <button type="button" role="tab" aria-selected={!isHouse} onClick={() => setTab("team")}
                    className={cn("min-w-0 overflow-hidden min-h-[40px] max-w-[45%] md:max-w-[200px] truncate rounded-full px-4 text-[14px] font-extrabold", !isHouse ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "text-foreground")}>
                    {team.name}
                  </button>
                )}
              </div>
            </header>

            {isPhone && pull.offset > 0 && (
              <div className="flex justify-center" style={{ height: pull.offset }} aria-live="polite">
                <span className="self-end text-[14px] font-semibold text-muted-foreground">
                  {pull.refreshing ? "Opdaterer …" : pull.offset >= PULL_THRESHOLD ? "Slip for at opdatere" : "Træk for at opdatere"}
                </span>
              </div>
            )}

            {me.employeeId && (
              <div ref={composerRef} className="scroll-mt-20">
              <PulsenComposer
                myEmployeeId={me.employeeId}
                canPostHouse={me.canPostHouse}
                canManageEvents={me.canManageEvents}
                defaultAudience={isHouse ? "house" : "team"}
                team={team}
                onSubmit={(input, localUrl) => mut.create.mutateAsync({ input, id: crypto.randomUUID(), localUrl: localUrl ?? undefined })}
                onOpenEvent={() => setAddEventOpen(true)}
                initialMode={initialCompose}
                onOpenChange={setComposerOpen}
              />
              </div>
            )}
            {me.employeeId && isPhone && !composerOpen && !composerSynlig && (
              <button type="button" onClick={() => {
                  composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  composerRef.current?.querySelector<HTMLElement>("textarea, [contenteditable=true], button")?.focus({ preventScroll: true });
                }}
                style={{ bottom: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 16px)` }}
                className="fixed right-4 z-30 min-h-[44px] w-auto rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[16px] font-extrabold text-[hsl(var(--cph-light-blue))] shadow-lg active:opacity-80">
                Nyt indlæg
              </button>
            )}

            {me.employeeId && (
              <TodayMilestonesCard layout="strip" isHouse={isHouse} teamId={team?.id ?? null} teamName={team?.name ?? null} enabled />
            )}

            {isHouse && <CelebrationLines celebrations={todayCelebrations} />}

            {highlight && (
              <MilestoneHeroCard
                value={milestoneNumber(highlight)}
                unit={milestoneUnit(highlight)}
                eyebrow={`Dagens højdepunkt · ${highlight.milestone_type === "house_record" ? "Husrekord" : "Teamrekord"}`}
                title={highlight.milestone_type === "house_record" ? (highlight.level === 1 ? "Ny husrekord i provision" : "Ny husrekord på én dag") : fillMilestoneDay(highlight.payload?.text ?? "Ny teamrekord", highlight.payload?.day).replace(/\*\*/g, "").replace(/:.*$/, "")}
                subtitle={highlight.payload?.previous != null ? `Før: ${Math.round(Number(highlight.payload.previous)).toLocaleString("da-DK")} ${milestoneUnit(highlight)}` : undefined}
                footer={isHouse && highlight.shown_in_house ? (
                  <ReactButton compact summary={fr.getReactions(milestoneTargetKey(highlight.id))} disabled={!fr.canInteract}
                    onSet={(reaction) => fr.setReaction.mutate({ targetType: "milestone", targetKey: milestoneTargetKey(highlight.id), reaction })} />
                ) : undefined}
              />
            )}

            {renderBody()}

            <PulsenSidebar className="lg:hidden" showUnanswered={isHouse} employeeId={me.employeeId} onOpenQuestion={openPost} />
          </div>

          <div className="hidden lg:block">
            <PulsenSidebar
              className="sticky top-6"
              showUnanswered={isHouse}
              employeeId={me.employeeId}
              onOpenQuestion={openPost}
              top={me.employeeId ? <TodayMilestonesCard layout="card" isHouse={isHouse} teamId={team?.id ?? null} teamName={team?.name ?? null} enabled /> : null}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}


/** Henter næste side, når bunden af feedet nærmer sig skærmen (uendelig rulning; knappen bliver som reserve). */
function AutoLoadSentinel({ onVisible, active }: { onVisible: () => void; active: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Genoptager også en afbrudt hentning, når sentinel'en stadig er i syne.
  useEffect(() => {
    if (visible && active) cb.current();
  }, [visible, active]);
  return <div ref={ref} aria-hidden="true" className="h-px" />;
}

const PULL_THRESHOLD = 64;

/** Træk-ned for at opdatere på telefon. Kun når siden står helt øverst; bruger feedets eksisterende refetch. */
function usePullToRefresh(enabled: boolean, onRefresh: () => Promise<unknown>) {
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;
  useEffect(() => {
    if (!enabled) return;
    let startY: number | null = null;
    let current = 0;
    const onStart = (e: TouchEvent) => { startY = window.scrollY <= 0 ? e.touches[0].clientY : null; };
    const onMove = (e: TouchEvent) => {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      current = dy > 0 && window.scrollY <= 0 ? Math.min(96, dy * 0.5) : 0;
      setOffset(current);
    };
    const onEnd = () => {
      if (startY != null && current >= PULL_THRESHOLD) {
        setRefreshing(true);
        setOffset(40);
        cb.current().finally(() => { setRefreshing(false); setOffset(0); });
      } else setOffset(0);
      startY = null; current = 0;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [enabled]);
  return { offset, refreshing };
}

const Beskeder = lazy(() => import("@/pages/Messages"));

/** Storkbook: Feed · Begivenheder · Beskeder (?tab=). Uden tab åbner Feed, så ?post=/?compose= virker. */
export default function Storkbook() {
  const { canViewMessagesPersonal } = usePermissions();
  const chatUnread = useStorkbookChatUnread();
  return (
    <Samleside
      titel="Storkbook"
      faner={[
        { id: "feed", label: "Feed", synlig: true, element: <PulsenFeed /> },
        { id: "begivenheder", label: "Begivenheder", synlig: true, element: <PulsenBegivenheder /> },
        {
          id: "beskeder",
          label: (
            <span className="inline-flex items-center gap-1.5">
              Beskeder
              {chatUnread > 0 && (
                <span aria-label={`${chatUnread} ulæste beskeder`} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-black tabular-nums text-destructive-foreground">
                  {formatUnread(chatUnread)}
                </span>
              )}
            </span>
          ),
          synlig: !!canViewMessagesPersonal,
          element: <Beskeder />,
        },
      ]}
    />
  );
}
