import { useEffect, useRef, useState } from "react";
import { ArrowRight, Flag, Flame, Hand, Medal, TrendingUp, Trophy, Users, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import { milestoneTargetKey, usePulsenMilestonesToday, type PulsenMilestone, type PulsenMilestoneType } from "@/hooks/usePulsen";
import { fillMilestoneDay } from "@/lib/pulsen/format";
import { cn } from "@/lib/utils";

const ICON: Record<PulsenMilestoneType, LucideIcon> = {
  first_sale: Flag, record_day: TrendingUp, record_week: TrendingUp, record_pay_period: TrendingUp,
  club: Medal, team_day_sales: Users, team_record: Trophy, streak: Flame, house_record: Trophy,
};
const TYPE: Record<PulsenMilestoneType, string> = {
  first_sale: "første salg", record_day: "dagsrekord", record_week: "ugerekord", record_pay_period: "lønperioderekord",
  club: "klub", team_day_sales: "teamfejring", team_record: "teamrekord", streak: "stribe", house_record: "husrekord",
};
const UNIT: Record<PulsenMilestoneType, string> = {
  first_sale: "salg", record_day: "kr", record_week: "kr", record_pay_period: "kr",
  club: "kr", team_day_sales: "salg", team_record: "salg", streak: "dage", house_record: "salg",
};
const EMERALD = new Set<PulsenMilestoneType>(["streak", "first_sale"]);

/** Navnet er første fed del af jobbets tekst ("**Aslak L.** …"). */
export function milestoneName(m: PulsenMilestone): string {
  const text = fillMilestoneDay(m.payload?.text ?? "", m.payload?.day);
  return text.match(/\*\*([^*]+)\*\*/)?.[1] ?? (m.milestone_type === "house_record" ? "Huset" : "Kollega");
}
export const milestoneValue = (m: PulsenMilestone) => `${Math.round(Number(m.value ?? 0)).toLocaleString("da-DK")} ${UNIT[m.milestone_type]}`;
export const milestoneUnit = (m: PulsenMilestone) => UNIT[m.milestone_type];
const clock = (iso: string) => new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });

type Reactions = ReturnType<typeof useFeedReactions>;

export function HighFiveButton({ m, fr, dark = false }: { m: PulsenMilestone; fr: Reactions; dark?: boolean }) {
  const key = milestoneTargetKey(m.id);
  const s = fr.getReactions(key);
  const active = !!s.myReaction;
  const name = milestoneName(m);
  return (
    <button
      type="button"
      disabled={!fr.canInteract || fr.setReaction.isPending}
      aria-pressed={active}
      aria-label={active ? `Fjern high five til ${name}` : `Giv high five til ${name}`}
      onClick={() => fr.setReaction.mutate({ targetType: "milestone", targetKey: key, reaction: s.myReaction ?? "clap" })}
      className="-my-1 flex min-h-[44px] flex-none items-center py-1"
    >
      <span className={cn(
        "flex h-9 min-w-[52px] items-center justify-center gap-1 rounded-full px-2.5 text-[12px] font-extrabold tabular-nums transition-colors disabled:opacity-50",
        active ? "bg-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-onyx))]"
          : dark ? "bg-[hsl(var(--cph-light-blue)/0.12)] text-[hsl(var(--cph-light-blue))]" : "bg-[hsl(var(--cph-light-blue))] text-foreground",
      )}>
        <Hand className="h-4 w-4" aria-hidden="true" />{s.total > 0 && s.total}
      </span>
    </button>
  );
}

export function MilestoneRow({ m, fr, interactive, isNew, compact = false, dark = false }: {
  m: PulsenMilestone; fr: Reactions; interactive: boolean; isNew?: boolean; compact?: boolean; dark?: boolean;
}) {
  const Icon = ICON[m.milestone_type];
  return (
    <div className={cn("flex items-center gap-3 py-2.5", isNew && "animate-pulsen-in")}>
      <span className={cn(
        "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px]",
        EMERALD.has(m.milestone_type) ? "bg-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-onyx))]"
          : dark ? "bg-[hsl(var(--cph-light-blue)/0.12)] text-[hsl(var(--cph-emerald))]" : "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-emerald))]",
      )}>
        <Icon className="h-4 w-4" aria-label={TYPE[m.milestone_type]} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[14px] leading-tight", compact ? "truncate" : "line-clamp-2")}>
          <b className="font-extrabold">{milestoneName(m)}</b> · {TYPE[m.milestone_type]}
          {compact && <span className="opacity-70"> · {milestoneValue(m)}</span>}
        </p>
        {!compact && (
          <p className={cn("mt-0.5 text-[12px]", dark ? "opacity-70" : "text-muted-foreground")}>
            <b className={dark ? "" : "text-foreground"}>{milestoneValue(m)}</b> · {clock(m.occurred_at)}
          </p>
        )}
      </div>
      {interactive && <HighFiveButton m={m} fr={fr} dark={dark} />}
    </div>
  );
}

export function LiveDot({ flash = 0, className }: { flash?: number; className?: string }) {
  return (
    <span key={flash} className={cn("relative flex h-2 w-2 flex-none", flash > 0 && "animate-pulsen-blink", className)} aria-hidden="true">
      <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--cph-emerald))] opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--cph-emerald))]" />
    </span>
  );
}

/** Husker hvilke milepæle der allerede er vist, så kun nye glider ind. */
function useNewIds(items: PulsenMilestone[] | undefined) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (!items) return;
    if (!seen.current) { seen.current = new Set(items.map((m) => m.id)); return; }
    const added = items.filter((m) => !seen.current!.has(m.id)).map((m) => m.id);
    if (added.length) {
      added.forEach((id) => seen.current!.add(id));
      setFresh(new Set(added));
      setFlash((n) => n + 1);
    }
  }, [items]);
  return { fresh, flash };
}

interface CardProps { isHouse: boolean; teamId: string | null; teamName: string | null; enabled: boolean }

/** "Dagens milepæle" i Storkbooks højrekolonne (desktop) eller som vandret række (mobil). */
export function TodayMilestonesCard({ isHouse, teamId, teamName, enabled, layout }: CardProps & { layout: "card" | "strip" }) {
  const scope = isHouse || !teamId ? { kind: "house" as const } : { kind: "team" as const, teamId };
  const q = usePulsenMilestonesToday(scope, enabled);
  const items = q.data?.items ?? [];
  const fr = useFeedReactions(isHouse ? items.map((m) => milestoneTargetKey(m.id)) : []);
  const { fresh, flash } = useNewIds(q.data?.items);
  const [open, setOpen] = useState(false);
  const count = q.data?.count ?? 0;

  const sheet = (
    <MilestonesSheet open={open} onOpenChange={setOpen} houseItems={isHouse ? items : null} teamId={teamId} teamName={teamName} enabled={enabled} />
  );

  if (layout === "strip") {
    if (!q.isLoading && items.length === 0) return null;
    return (
      <section aria-label="Dagens milepæle" className="-mx-4 lg:hidden">
        <div className="mb-2 flex items-center gap-2 px-4">
          <LiveDot flash={flash} />
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Dagens milepæle</h2>
          <button type="button" onClick={() => setOpen(true)} className="ml-auto min-h-[44px] text-[12px] font-extrabold">{count} i dag →</button>
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {items.slice(0, 10).map((m) => (
            <div key={m.id} className="w-[220px] flex-none snap-start rounded-[20px] bg-card px-3">
              <MilestoneRow m={m} fr={fr} interactive={isHouse} isNew={fresh.has(m.id)} />
            </div>
          ))}
        </div>
        {sheet}
      </section>
    );
  }

  return (
    <section aria-label="Dagens milepæle" className="rounded-[24px] bg-card p-5">
      <div className="flex items-center gap-2">
        <LiveDot flash={flash} />
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Dagens milepæle</h2>
        <span className="ml-auto text-[12px] font-extrabold tabular-nums">{count} i dag</span>
      </div>
      {q.isLoading ? (
        <p className="mt-3 text-[14px] text-muted-foreground">Henter …</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted-foreground">Ingen milepæle endnu i dag – de dukker op her, når de sker.</p>
      ) : (
        <>
          <div className="mt-1 divide-y divide-border">
            {items.slice(0, 5).map((m) => <MilestoneRow key={m.id} m={m} fr={fr} interactive={isHouse} isNew={fresh.has(m.id)} />)}
          </div>
          <button type="button" onClick={() => setOpen(true)} className="mt-1 flex min-h-[44px] items-center gap-1 text-[13px] font-extrabold hover:text-primary">
            Se alle {count} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      )}
      {sheet}
    </section>
  );
}

function MilestonesSheet({ open, onOpenChange, houseItems, teamId, teamName, enabled }: {
  open: boolean; onOpenChange: (o: boolean) => void; houseItems: PulsenMilestone[] | null; teamId: string | null; teamName: string | null; enabled: boolean;
}) {
  const house = usePulsenMilestonesToday({ kind: "house" }, enabled && open && !houseItems);
  const team = usePulsenMilestonesToday(teamId ? { kind: "team", teamId } : { kind: "house" }, enabled && open && !!teamId);
  const hItems = houseItems ?? house.data?.items ?? [];
  const tItems = teamId ? team.data?.items ?? [] : [];
  const fr = useFeedReactions(open ? hItems.map((m) => milestoneTargetKey(m.id)) : []);
  const Group = ({ title, list, interactive }: { title: string; list: PulsenMilestone[]; interactive: boolean }) => (
    <div className="mt-5">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">{title} · {list.length}</h3>
      {list.length === 0 ? <p className="mt-2 text-[14px] text-muted-foreground">Ingen endnu i dag.</p> : (
        <div className="divide-y divide-border">{list.map((m) => <MilestoneRow key={m.id} m={m} fr={fr} interactive={interactive} />)}</div>
      )}
    </div>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[420px]">
        <SheetHeader><SheetTitle className="font-black">Dagens milepæle</SheetTitle></SheetHeader>
        <Group title="Huset" list={hItems} interactive />
        {teamId && <Group title={teamName ?? "Mit team"} list={tItems} interactive={false} />}
      </SheetContent>
    </Sheet>
  );
}

/** Lille onyx-version til forsiden: 3 rækker + antal. */
export function TodayMilestonesMini({ enabled }: { enabled: boolean }) {
  const q = usePulsenMilestonesToday({ kind: "house" }, enabled, 3);
  const items = q.data?.items ?? [];
  const fr = useFeedReactions(items.map((m) => milestoneTargetKey(m.id)));
  const count = q.data?.count ?? 0;
  return (
    <section aria-label="Dagens milepæle" className="flex flex-col rounded-[24px] bg-[hsl(var(--cph-onyx))] p-5 text-[hsl(var(--cph-light-blue))]">
      <div className="flex items-center gap-2">
        <LiveDot />
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[hsl(var(--cph-emerald))]">Dagens milepæle</h3>
        <span className="ml-auto text-[12px] font-extrabold tabular-nums">{count} i dag</span>
      </div>
      {q.isLoading ? (
        <div className="mt-3 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded-xl bg-[hsl(var(--cph-light-blue)/0.12)]" />)}</div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-[14px] opacity-75">Ingen milepæle endnu i dag.</p>
      ) : (
        <div className="mt-1 divide-y divide-[hsl(var(--cph-light-blue)/0.15)]">
          {items.map((m) => <MilestoneRow key={m.id} m={m} fr={fr} interactive compact dark />)}
        </div>
      )}
      <Link to="/storkbook" className="mt-auto flex min-h-[44px] items-center gap-1 pt-2 text-[13px] font-extrabold text-[hsl(var(--cph-emerald))]">
        Se alle {count} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
