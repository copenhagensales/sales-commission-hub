import { useEffect, useMemo, useRef, useState } from "react";
import { StorkbookMark } from "@/components/storkbook/StorkbookMark";
import { useSearchParams } from "react-router-dom";
import { Lock, Sun, Users } from "lucide-react";
import { startOfDay } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CelebrationStrip } from "@/components/home/CelebrationStrip";
import { EventRsvpCard } from "@/components/home/EventRsvpCard";
import { EventDetailDialog } from "@/components/home/EventDetailDialog";
import { EditEventDialog } from "@/components/home/EditEventDialog";
import { AddEventDialog } from "@/components/home/AddEventDialog";
import { PulsenComposer } from "@/components/pulsen/PulsenComposer";
import { PulsenPostCard } from "@/components/pulsen/PulsenPostCard";
import { PulsenSidebar } from "@/components/pulsen/PulsenSidebar";
import { PulsenMilestoneItem } from "@/components/pulsen/PulsenMilestoneItem";
import { ReactButton } from "@/components/home/FeedReactionRow";
import { PulsenEmpty, PulsenError, PulsenPostSkeleton } from "@/components/pulsen/PulsenStates";
import { useCelebrations } from "@/hooks/useCelebrations";
import {
  useDeleteCompanyEvent, useEventAttendees, useToggleEventAttendance, useUpcomingCompanyEvents, type AttendanceStatus,
} from "@/hooks/useCompanyEvents";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import {
  milestoneTargetKey, postTargetKey, useMarkPulsenSeen, usePulsenFeed, usePulsenImageUrls, usePulsenMe, usePulsenMilestones,
  usePulsenMilestonesYesterday, usePulsenMutations, usePulsenTopline,
  type PulsenMilestone, type PulsenPost, type PulsenScope,
} from "@/hooks/usePulsen";
import { cn } from "@/lib/utils";

type FeedItem =
  | { kind: "post"; at: number; post: PulsenPost }
  | { kind: "event"; at: number; eventId: string }
  | { kind: "celebrations"; at: number }
  | { kind: "milestone"; at: number; milestone: PulsenMilestone };

export default function Pulsen() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Storkbook";
    return () => { document.title = prev; };
  }, []);
  const me = usePulsenMe();
  const [tab, setTab] = useState<"house" | "team">("house");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);

  const team = me.teams.find((t) => t.id === teamId) ?? me.teams[0] ?? null;
  const scope: PulsenScope = tab === "team" && team ? { kind: "team", teamId: team.id } : { kind: "house" };
  const isHouse = scope.kind === "house";

  const feed = usePulsenFeed(scope, !!me.employeeId);
  const posts = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);
  // Link fra forsiden: /storkbook?post=<id> ruller til indlægget, når det er indlæst.
  const [searchParams] = useSearchParams();
  const deepPostId = searchParams.get("post");
  const deepDone = useRef(false);
  useEffect(() => {
    if (!deepPostId || deepDone.current || !posts.some((p) => p.id === deepPostId)) return;
    deepDone.current = true;
    requestAnimationFrame(() => document.getElementById(`pulsen-post-${deepPostId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [deepPostId, posts]);
  const images = usePulsenImageUrls(posts.filter((p) => p.image_path && !p.localImageUrl).map((p) => p.image_path as string));

  const mut = usePulsenMutations(me.self);

  // Kun Huset-indlæg har reaktioner/kommentarer (databasen afviser team-indhold).
  const milestones = usePulsenMilestones(scope, !!me.employeeId);
  const houseKeys = isHouse
    ? [...posts.filter((p) => !p.pending).map((p) => postTargetKey(p.id)), ...(milestones.data ?? []).map((m) => milestoneTargetKey(m.id))]
    : [];
  const fr = useFeedReactions(houseKeys);

  const { data: celebrations = [] } = useCelebrations();
  const todayCelebrations = celebrations.filter((c) => c.isToday);
  const { data: events = [] } = useUpcomingCompanyEvents();
  const { data: attendees = [] } = useEventAttendees(events.map((e) => e.id));
  const toggleAttendance = useToggleEventAttendance(me.employeeId);
  const deleteEvent = useDeleteCompanyEvent();
  const topline = usePulsenTopline(!!me.employeeId);
  const milestonesYesterday = usePulsenMilestonesYesterday(!!me.employeeId);
  // Ulæst-badge nulstilles, når siden åbnes.
  const markSeen = useMarkPulsenSeen();
  const seenDone = useRef(false);
  useEffect(() => {
    if (!me.employeeId || seenDone.current) return;
    seenDone.current = true;
    markSeen.mutate(me.employeeId);
  }, [me.employeeId, markSeen]);
  const yesterdayWinner = topline.data?.teams.reduce<{ name: string; yesterday: number } | null>(
    (best, t) => (t.yesterday > (best?.yesterday ?? 0) ? t : best), null);

  const items: FeedItem[] = useMemo(() => {
    const list: FeedItem[] = posts.map((p) => ({ kind: "post", at: new Date(p.created_at).getTime(), post: p }));
    const oldestPost = feed.hasNextPage && posts.length ? new Date(posts[posts.length - 1].created_at).getTime() : -Infinity;
    (milestones.data ?? []).forEach((m) => {
      const at = new Date(m.occurred_at).getTime();
      if (at >= oldestPost) list.push({ kind: "milestone", at, milestone: m });
    });
    if (isHouse) {
      const oldest = feed.hasNextPage && posts.length ? new Date(posts[posts.length - 1].created_at).getTime() : -Infinity;
      events.forEach((e) => {
        const at = new Date(e.created_at).getTime();
        if (at >= oldest) list.push({ kind: "event", at, eventId: e.id });
      });
      if (todayCelebrations.length) list.push({ kind: "celebrations", at: startOfDay(new Date()).getTime() });
    }
    return list.sort((a, b) => b.at - a.at);
  }, [posts, events, isHouse, todayCelebrations.length, feed.hasNextPage, milestones.data]);

  const attendingFor = (id: string) => attendees.filter((a) => a.event_id === id && a.status === "attending");
  const myStatus = (id: string) => (attendees.find((a) => a.event_id === id && a.employee_id === me.employeeId)?.status ?? null) as AttendanceStatus | null;
  const detailEvent = events.find((e) => e.id === detailEventId);

  const scrollToPost = (id: string) => {
    setTab("house");
    requestAnimationFrame(() => document.getElementById(`pulsen-post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

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
          if (item.kind === "milestone") {
            const m = item.milestone;
            const key = milestoneTargetKey(m.id);
            return (
              <PulsenMilestoneItem
                key={`ms-${m.id}`}
                milestone={m}
                reaction={isHouse && m.shown_in_house ? (
                  <ReactButton compact summary={fr.getReactions(key)} disabled={!fr.canInteract}
                    onSet={(reaction) => fr.setReaction.mutate({ targetType: "milestone", targetKey: key, reaction })} />
                ) : undefined}
              />
            );
          }
          if (item.kind === "celebrations") return <CelebrationStrip key="celebrations" variant="flat" celebrations={todayCelebrations} />;
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
                interactions={isHouse ? {
                  summary: fr.getReactions(key),
                  comments: fr.getComments(key),
                  canInteract: fr.canInteract,
                  onReact: (reaction) => fr.setReaction.mutate({ targetType: "pulsen_post", targetKey: key, reaction }),
                  onComment: (body) => fr.addComment.mutateAsync({ targetType: "pulsen_post", targetKey: key, body }),
                  onDeleteComment: (id) => fr.deleteComment.mutateAsync(id),
                } : undefined}
                onEdit={(body) => mut.edit.mutateAsync({ id: p.id, body })}
                onDelete={() => mut.remove.mutate(p)}
                onHide={(hidden) => mut.setHidden.mutate({ id: p.id, hidden })}
                onBestAnswer={(commentId) => mut.setBestAnswer.mutate({ id: p.id, commentId })}
              />
            </div>
          );
        })}

        {feed.hasNextPage ? (
          <button
            type="button"
            onClick={() => feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
            className="mx-auto min-h-[44px] rounded-full bg-card px-6 text-[14px] font-extrabold text-foreground hover:bg-[hsl(var(--cph-onyx))] hover:text-[hsl(var(--cph-light-blue))] disabled:opacity-60"
          >
            {feed.isFetchingNextPage ? "Henter …" : "Indlæs flere"}
          </button>
        ) : (
          <div className="py-6 text-center">
            {topline.data ? (
              <p className="text-[15px] font-extrabold tabular-nums text-foreground">
                I går: {topline.data.house.yesterday.toLocaleString("da-DK")} salg
                {milestonesYesterday.data != null && ` · ${milestonesYesterday.data} milepæle`}
                {yesterdayWinner && ` · ${yesterdayWinner.name} vandt dagen`}
              </p>
            ) : (
              <p className="text-[15px] font-extrabold text-foreground">Du er opdateret</p>
            )}
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

      <div className="min-h-screen bg-background px-4 pb-16 pt-6 md:px-8">
        <div className="mx-auto grid w-full max-w-[1004px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,680px)_300px] 2xl:max-w-[1164px] 2xl:grid-cols-[minmax(0,680px)_460px]">
          <div className="flex min-w-0 flex-col gap-4">
            <header className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <StorkbookMark variant="full" tone="light" size={44} />
                <h1 aria-label="Storkbook" className="font-['Figtree'] text-[32px] font-black lowercase leading-none tracking-[-0.045em]">
                  <span aria-hidden="true" className="text-[hsl(var(--cph-onyx))]">stork</span>
                  <span aria-hidden="true" className="text-[#146c3c]">book</span>
                </h1>
              </div>
              <div role="tablist" aria-label="Feed" className="flex rounded-full bg-card p-1">
                <button type="button" role="tab" aria-selected={isHouse} onClick={() => setTab("house")}
                  className={cn("min-h-[40px] rounded-full px-4 text-[14px] font-extrabold", isHouse ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "text-foreground")}>
                  Huset
                </button>
                {team && (
                  <button type="button" role="tab" aria-selected={!isHouse} onClick={() => setTab("team")}
                    className={cn("min-h-[40px] max-w-[200px] truncate rounded-full px-4 text-[14px] font-extrabold", !isHouse ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "text-foreground")}>
                    {team.name}
                  </button>
                )}
              </div>
              {me.teams.length > 1 && (
                <Select value={team?.id} onValueChange={(v) => { setTeamId(v); setTab("team"); }}>
                  <SelectTrigger aria-label="Vælg team" className="h-11 w-[200px] rounded-full border-0 bg-card font-extrabold">
                    <SelectValue placeholder="Vælg team" />
                  </SelectTrigger>
                  <SelectContent>
                    {me.teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </header>

            {me.employeeId && (
              <PulsenComposer
                myEmployeeId={me.employeeId}
                canPostHouse={me.canPostHouse}
                canManageEvents={me.canManageEvents}
                defaultAudience={isHouse ? "house" : "team"}
                team={team}
                onSubmit={(input, localUrl) => mut.create.mutateAsync({ input, id: crypto.randomUUID(), localUrl: localUrl ?? undefined })}
                onOpenEvent={() => setAddEventOpen(true)}
              />
            )}

            {renderBody()}
          </div>

          <PulsenSidebar employeeId={me.employeeId} onOpenQuestion={scrollToPost} />
        </div>
      </div>
    </MainLayout>
  );
}

