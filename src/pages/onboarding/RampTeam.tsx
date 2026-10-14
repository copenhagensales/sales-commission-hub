import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Loader2, Check, X, Plus, Search, Lock, EyeOff } from "lucide-react";
import {
  RAMP_WEEKLY_ABSENCE,
  RAMP_WEEKLY_COACHING,
  formatRiskStatShort,
  useCanViewRampTeam,
  useLogRampAction,
  useRampRiskStats,
  useRampFullTeam,
  useRampFeedbackExclusions,
  useRampTeamOverview,
  useSetRampFeedbackExclusion,
  useSendRampSessionFeedback,
  type RampAction,
  type RampFullTeamMember,
  type RampTeamMember,
  type RampWeekPoint,
} from "@/hooks/useRampTeam";
import { useRampMinTargets } from "@/hooks/useRampTeam";
import { DEFAULT_WEEKLY_MIN_TARGETS } from "@/lib/rampMinTarget";
import { RampMinTargetsEditor } from "./RampMinTargetsEditor";
import { getInitials } from "@/utils/formatting";
import { useAuth } from "@/hooks/useAuth";
import {
  RampKpiFilters,
  RampWeekBoard,
  WeekOverviewChart,
  expectationTrend,
  groupOf,
  missingSales,
  oneOnOneOf,
  supportGroup,
  type BoardFilter,
  type BoardItem,
  type SupportGroup,
} from "./RampOverviewMatrix";
import { RampSellerPanel } from "./RampSellerPanel";
import { RampEstablishedSection } from "./RampEstablished";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { WEEKDAY_NAME, displayWeek, isMondayView, isoWeekOf } from "@/lib/rampWeek";

const UNDO_MS = 8000;

/**
 * Opstart — lederrettet side ("Ekstra støtte"-design).
 *
 * Al adgang haandhaeves i databasen. Siden viser kun det lederen selv kan se,
 * og et forloeb kan aldrig vinges af uden feedback: klik aabner altid dialogen,
 * og registreringen sker paa serveren efter mailen er lagt i koen.
 */

type FilterMode = "all" | "danger" | "missing" | SupportGroup;
/** Opstartere har en norm; hele holdet har ikke. Alt faelles arbejder paa begge. */
type AnyMember = RampTeamMember | RampFullTeamMember;


const RED = "#d4453c";
const RED_TEXT = "#c13b32";
const AMBER = "#e0b64a";
const AMBER_STRIP = "#e08a2e";
const AMBER_TEXT = "#9a6216";
const GREEN = "#177a4d";
/** Saelgerstatus: roed = start her, gul = hold fast, groen = paa sporet. */
const RED_FLAT = "#fbe4e1";
const YELLOW = "#d9a21b";
const GREY_PILL = "#f1f4f3";

/** Fokusomraader lederen kan vaelge til ugens fokus. */
const FOCUS_AREAS = [
  "Åbningen",
  "Behovsafdækning",
  "Værdiargumentation",
  "Indvendingshåndtering",
  "Lukkefasen",
  "Brug af delaccepter",
  "Mersalg",
  "Tonen i samtalen",
  "Struktur og disciplin",
  "Aktivitet og opkald",
] as const;
const NEUTRAL = "#b9c4bf";

interface Derived {
  gap: number;
  /** Antal 1-1 sessioner holdt i den indevaerende uge (kravet er 1). */
  sessionsThisWeek: number;
  /** Sammenhaengende uger bagud helt uden en session. */
  missedWeeks: number;
  trend: "up" | "down" | "flat" | "unknown";
  urgency: number;
  stripColor: string;
  weekActions: Map<string, { sessions: number; absence: boolean }>;
  feedbackLog: RampAction[];
}

function weekKey(year: number, week: number) {
  return `${year}-${week}`;
}

function derive(member: AnyMember): Derived {
  const weekActions = new Map<string, { sessions: number; absence: boolean }>();
  for (const action of member.actions) {
    const { year, week } = isoWeekOf(new Date(action.performed_at));
    const key = weekKey(year, week);
    const entry = weekActions.get(key) ?? { sessions: 0, absence: false };
    if (action.action_type === RAMP_WEEKLY_COACHING) {
      entry.sessions += 1;
    }
    if (action.action_type === RAMP_WEEKLY_ABSENCE) entry.absence = true;
    weekActions.set(key, entry);
  }

  const gap = missingSales(member);
  const countedThisWeek = weekActions.get(weekKey(member.iso_year, member.iso_week))?.sessions ?? 0;
  const sessionsThisWeek =
    member.has_coaching ? Math.max(1, countedThisWeek) : countedThisWeek;

  // Sammenhaengende uger bagud uden en session (den aktuelle uge taelles med).
  // Uger foer ordningens startdato taeller ikke som manglende.
  let missedWeeks = 0;
  if (member.weekly_program_active && member.weekly_program_start_date) {
    const start = isoWeekOf(new Date(`${member.weekly_program_start_date}T00:00:00`));
    const startRank = start.year * 100 + start.week;
    for (let i = member.weeks.length - 1; i >= 0; i--) {
      const w = member.weeks[i];
      if (w.iso_year * 100 + w.iso_week < startRank) break;
      const entry = weekActions.get(weekKey(w.iso_year, w.iso_week));
      if (entry?.absence) break;
      if ((entry?.sessions ?? 0) > 0) break;
      missedWeeks += 1;
    }
  }

  // Trend: ugens salg ift. ugens forventning, seneste uge mod ugen foer.
  const trend: Derived["trend"] = expectationTrend(member);

  const urgency =
    (missedWeeks >= 2 ? 100 : 0) +
    (member.week_required && sessionsThisWeek === 0 ? 40 : 0) +
    gap * 3 +
    (trend === "down" ? 10 : 0);

  return {
    gap,
    sessionsThisWeek,
    missedWeeks,
    trend,
    urgency,
    stripColor:
      supportGroup(member) === "start"
        ? RED
        : supportGroup(member) === "hold"
          ? YELLOW
          : supportGroup(member) === "track"
            ? GREEN
            : NEUTRAL,
    weekActions,
    feedbackLog: member.actions.filter((a) => a.note && a.note.trim().length > 0),
  };
}

/** Knap der tager saelgeren ud af feedback-oversigten (kan altid aktiveres igen). */
function ExcludeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-[12px] font-bold"
      style={{ borderColor: "#e0e6e3", color: "#57635e", background: "#fff" }}
    >
      Skal ikke have feedback
    </button>
  );
}

/** Linje i bunden for en saelger der er sat paa pause. */
function PausedRow({
  member,
  onActivate,
  isPending,
}: {
  member: AnyMember;
  onActivate: (member: AnyMember) => void;
  isPending: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-white px-5 py-3.5"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-extrabold"
          style={{ background: "#f1f4f3", color: "#7b857f" }}
        >
          {getInitials(member.employee_name)}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold" style={{ color: "#4a5651" }}>
            {member.employee_name}
          </p>
          <p className="text-[12px] font-semibold" style={{ color: "#8b958f" }}>
            {[member.team_name, member.campaign_name].filter(Boolean).join(" · ") ||
              "Ingen feedback"}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => onActivate(member)}
        className="rounded-full px-3.5 py-1.5 text-[12px] font-bold disabled:opacity-50"
        style={{ background: "#e7f4ed", color: "#0f5a38" }}
      >
        Aktivér igen
      </button>
    </div>
  );
}

function FeedbackDialog({
  member,
  alreadyDone,
  onClose,
}: {
  member: AnyMember;
  alreadyDone: boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [focusNote, setFocusNote] = useState("");
  const [strengthNote, setStrengthNote] = useState("");
  const send = useSendRampSessionFeedback();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ready = note.trim().length >= 10 && focusArea.trim().length > 0;
  const d = derive(member);
  const previous = d.feedbackLog.filter((a) => a.action_type === RAMP_WEEKLY_COACHING);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = () => {
    if (!ready || send.isPending) return;
    send.mutate(
      {
        employeeId: member.employee_id,
        kind: "coaching",
        note: note.trim(),
        focusArea: focusArea.trim(),
        focusNote: focusNote.trim() || null,
        strengthNote: strengthNote.trim() || null,
        flagId: member.flag_id,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:items-center sm:p-4"
      style={{ background: "rgba(20,28,25,.45)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] bg-white sm:max-h-[calc(100dvh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 p-5">
          <div>
            <p
              className="text-[11px] font-extrabold uppercase"
              style={{ color: "#57635e", letterSpacing: ".12em" }}
            >
              1-1
            </p>
            <p className="text-[22px] font-extrabold leading-tight" style={{ color: "#1b1f1d" }}>
              {member.employee_name}
            </p>
            <p className="text-[12px]" style={{ color: "#57635e" }}>
              {[member.campaign_name, `arbejdsdag ${member.day_no}`, `uge ${member.iso_week}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Luk">
            <X className="h-5 w-5" style={{ color: "#57635e" }} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4">
          {alreadyDone && (
            <p
              className="rounded-2xl border p-3 text-[12px]"
              style={{ background: "#e7f4ed", borderColor: "#a9dcc3", color: "#0f5a38" }}
            >
              Ugens 1-1 er allerede holdt i uge {member.iso_week}. Du kan sende en ekstra 1-1.
            </p>
          )}

          <div>
            <p className="text-[13px] font-bold" style={{ color: "#1b1f1d" }}>
              Feedback og aftaler
            </p>
            <p className="text-[12px]" style={{ color: "#57635e" }}>
              Sendes ordret til sælgeren og de andre ledere i teamet.
            </p>
            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Hvad blev gennemgået, og hvad er aftalt til næste uge?"
              className="mt-2 w-full rounded-2xl border p-3 text-[13px] outline-none"
              style={{ minHeight: 140, background: "#f9fbfa", borderColor: "#e7eeeb", color: "#1b1f1d" }}
            />
          </div>

          <div>
            <p className="text-[13px] font-bold" style={{ color: "#1b1f1d" }}>
              Ugens fokus
            </p>
            <p className="text-[12px]" style={{ color: "#57635e" }}>
              Én ting sælgeren skal arbejde med i næste uge.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FOCUS_AREAS.map((area) => {
                const active = focusArea === area;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setFocusArea(active ? "" : area)}
                    className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
                    style={{
                      background: active ? GREEN : "#f6f9f8",
                      borderColor: active ? GREEN : "#e7eeeb",
                      color: active ? "#14352a" : "#57635e",
                    }}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
            <input
              value={focusNote}
              onChange={(e) => setFocusNote(e.target.value.slice(0, 200))}
              placeholder="Skriv fokus helt konkret, fx: husk at behovsafdække før du nævner prisen"
              className="mt-2 w-full rounded-2xl border p-3 text-[13px] outline-none"
              style={{ background: "#f9fbfa", borderColor: "#e7eeeb", color: "#1b1f1d" }}
            />
          </div>

          <div>
            <p className="text-[13px] font-bold" style={{ color: "#1b1f1d" }}>
              Her er du stærk
            </p>
            <p className="text-[12px]" style={{ color: "#57635e" }}>
              Fremhæv noget der virker. Det står i en grøn boks i sælgerens mail.
            </p>
            <textarea
              value={strengthNote}
              onChange={(e) => setStrengthNote(e.target.value.slice(0, 400))}
              placeholder="Fx: din åbning er blevet skarp, og du holder tempoet hele vejen igennem samtalen"
              className="mt-2 w-full rounded-2xl border p-3 text-[13px] outline-none"
              style={{ minHeight: 84, background: "#f9fbfa", borderColor: "#e7eeeb", color: "#1b1f1d" }}
            />
          </div>



          <div className="space-y-2">
            <p className="text-[13px] font-bold" style={{ color: "#1b1f1d" }}>
              Modtagere
            </p>
            <div
              className="flex items-center gap-2 rounded-2xl border p-3"
              style={{ background: "#f6f9f8", borderColor: "#e7eeeb" }}
            >
              <Check className="h-4 w-4 shrink-0" style={{ color: GREEN }} />
              <span className="text-[12px]" style={{ color: "#1b1f1d" }}>
                {member.employee_name} · sælger
              </span>
            </div>
            <div
              className="flex items-center gap-2 rounded-2xl border p-3"
              style={{ background: "#f6f9f8", borderColor: "#e7eeeb" }}
            >
              <Check className="h-4 w-4 shrink-0" style={{ color: GREEN }} />
              <span className="text-[12px]" style={{ color: "#1b1f1d" }}>
                Øvrige ledere i {member.team_name ?? "teamet"}
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "#57635e" }}>
              Modtagerne slås op på serveren og kan ikke fravælges — dokumentationen er formålet.
            </p>
          </div>

          {previous.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-bold" style={{ color: "#1b1f1d" }}>
                Tidligere feedback
              </p>
              {previous.slice(0, 3).map((a, index) => (
                <p
                  key={`${a.performed_at}-${index}`}
                  className="whitespace-pre-wrap rounded-2xl border p-3 text-[12px]"
                  style={{ borderColor: "#e7eeeb", color: "#57635e" }}
                >
                  {a.note}
                </p>
              ))}
            </div>
          )}
        </div>

        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 p-4"
          style={{ background: "#f6f9f8" }}
        >
          <p className="text-[12px] font-semibold" style={{ color: ready ? "#0f5a38" : AMBER_TEXT }}>
            {ready
              ? "Sendes til sælgeren og teamets ledere"
              : note.trim().length < 10
                ? "Skriv feedback før du sender"
                : "Vælg ugens fokus før du sender"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border bg-white px-4 py-2 text-[13px] font-bold"
              style={{ borderColor: "#e7eeeb", color: "#1b1f1d" }}
            >
              Annullér
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!ready || send.isPending}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold text-white"
              style={{ background: ready && !send.isPending ? GREEN : NEUTRAL }}
            >
              {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send og markér som holdt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RampTeam() {
  const { data: canView, isLoading: accessLoading } = useCanViewRampTeam();
  const { data: allMembers = [], isLoading } = useRampTeamOverview();
  const { data: allFullTeam = [], } = useRampFullTeam();
  const { data: stats = [] } = useRampRiskStats();
  const { data: exclusions = [] } = useRampFeedbackExclusions();
  const { data: minTargets = DEFAULT_WEEKLY_MIN_TARGETS } = useRampMinTargets();
  const setExclusion = useSetRampFeedbackExclusion();
  const logAction = useLogRampAction();

  const excludedIds = useMemo(() => new Set(exclusions.map((e) => e.employee_id)), [exclusions]);
  const members = useMemo(() => allMembers.filter((m) => !excludedIds.has(m.employee_id)), [allMembers, excludedIds]);
  const fullTeam = useMemo(() => allFullTeam.filter((m) => !excludedIds.has(m.employee_id)), [allFullTeam, excludedIds]);
  const pausedList = useMemo(
    () =>
      ([...allMembers, ...allFullTeam] as AnyMember[])
        .filter((m) => excludedIds.has(m.employee_id))
        .sort((a, b) => a.employee_name.localeCompare(b.employee_name, "da")),
    [allMembers, allFullTeam, excludedIds],
  );

  const [filter, setFilter] = useState<BoardFilter | null>(null);
  const [search, setSearch] = useState("");
  const searchTerm = search.trim().toLocaleLowerCase("da");
  const matchesSearch = (m: { employee_name: string }) =>
    !searchTerm || m.employee_name.toLocaleLowerCase("da").includes(searchTerm);

  const { user } = useAuth();
  const discreetKey = `ramp-discreet:${user?.id ?? "anon"}`;
  const chartKey = `ramp-chart-open:${user?.id ?? "anon"}`;
  const [discreet, setDiscreet] = useState(false);
  const [chartOpen, setChartOpen] = useState(true);
  const [pausedOpen, setPausedOpen] = useState(false);
  useEffect(() => {
    setDiscreet(window.localStorage.getItem(discreetKey) === "1");
  }, [discreetKey]);
  useEffect(() => {
    const saved = window.localStorage.getItem(chartKey);
    setChartOpen(saved === null ? window.innerWidth >= 768 : saved === "1");
  }, [chartKey]);
  const toggleDiscreet = () =>
    setDiscreet((v) => {
      window.localStorage.setItem(discreetKey, !v ? "1" : "0");
      return !v;
    });
  const toggleChart = () =>
    setChartOpen((v) => {
      window.localStorage.setItem(chartKey, !v ? "1" : "0");
      return !v;
    });

  const [dialog, setDialog] = useState<{ employeeId: string; done: boolean } | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<{ id: string; nonce: number } | null>(null);
  const [pendingAbsence, setPendingAbsence] = useState<Set<string>>(new Set());
  const absenceTimers = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const timers = absenceTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const isoWeek = members[0]?.iso_week ?? null;
  const campaignLabel = useMemo(() => {
    const names = Array.from(new Set(members.map((m) => m.campaign_name).filter((n): n is string => Boolean(n))));
    return names.length > 0 ? names.join(" · ") : "Eesy TM Products";
  }, [members]);
  const programStart = members[0]?.weekly_program_start_date ?? null;
  const programActive = members[0]?.weekly_program_active ?? false;
  const programStartLabel = programStart
    ? new Date(`${programStart}T00:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Visningsuge: mandag = sidste uges slutresultat. Statusberegningen er uændret (databasen).
  const ref = members.map((m) => m.week_status).find((w) => w && !w.partial_start) ?? members[0]?.week_status ?? null;
  const monday = isMondayView(ref);
  const lastIso = members.map((m) => m.last_week_status?.iso_week).find((n) => n != null) ?? null;
  const done = ref?.done_days ?? 0;
  const total = ref?.workdays ?? 5;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const yesterday = WEEKDAY_NAME[((new Date().getDay() + 6) % 7) || 7];

  const items: BoardItem[] = useMemo(
    () =>
      members.map((m) => {
        const w = displayWeek(m, monday);
        return { m, w, g: groupOf(w), one: oneOnOneOf(m, pendingAbsence.has(m.employee_id)) };
      }),
    [members, monday, pendingAbsence],
  );
  // Etablerede maales med samme ugemodel (krav = sidste opstartskrav) og taeller med i tal og graf.
  const establishedItems: BoardItem[] = useMemo(
    () =>
      fullTeam.map((m) => {
        const w = displayWeek(m, monday);
        return {
          m: m as unknown as RampTeamMember,
          w,
          g: groupOf(w),
          one: oneOnOneOf(m, pendingAbsence.has(m.employee_id)),
          established: true,
        };
      }),
    [fullTeam, monday, pendingAbsence],
  );
  const allItems = useMemo(() => [...items, ...establishedItems], [items, establishedItems]);
  const counts = useMemo(() => {
    const c: Record<SupportGroup, number> = { start: 0, hold: 0, track: 0 };
    for (const i of allItems) if (i.g) c[i.g] += 1;
    return c;
  }, [allItems]);
  const missing = allItems.filter((i) => i.one.kind === "missing").length;
  const requiredCount = allItems.filter((i) => i.m.week_required).length;
  const heldCount = allItems.filter((i) => i.m.week_required && i.one.kind === "held").length;

  const shownItems = items.filter((i) => matchesSearch(i.m));
  const chartItems = allItems.filter((i) => matchesSearch(i.m)).filter((i) =>
    !filter ? true : filter === "missing" ? i.one.kind === "missing" : i.g === filter,
  );
  const panelItem = allItems.find((i) => i.m.employee_id === panelId) ?? null;

  const dialogMember: AnyMember | undefined = dialog
    ? (members.find((m) => m.employee_id === dialog.employeeId) as AnyMember | undefined) ??
      fullTeam.find((m) => m.employee_id === dialog.employeeId)
    : undefined;

  const registerAbsence = (m: AnyMember) => {
    const id = m.employee_id;
    setPendingAbsence((s) => new Set(s).add(id));
    const timer = window.setTimeout(() => {
      absenceTimers.current.delete(id);
      logAction.mutate(
        { employeeId: id, actionType: RAMP_WEEKLY_ABSENCE, flagId: null },
        {
          onSettled: () =>
            setPendingAbsence((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            }),
        },
      );
    }, UNDO_MS);
    absenceTimers.current.set(id, timer);
    toast("Fravær registreret", {
      duration: UNDO_MS,
      action: {
        label: "Fortryd",
        onClick: () => {
          window.clearTimeout(absenceTimers.current.get(id));
          absenceTimers.current.delete(id);
          setPendingAbsence((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        },
      },
    });
  };

  const exclude = (m: AnyMember) => {
    setPanelId(null);
    setExclusion.mutate(
      { employeeId: m.employee_id, excluded: true },
      {
        onSuccess: () =>
          toast("Taget ud af oversigten", {
            duration: UNDO_MS,
            action: {
              label: "Fortryd",
              onClick: () => setExclusion.mutate({ employeeId: m.employee_id, excluded: false }),
            },
          }),
      },
    );
  };

  if (accessLoading || isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!canView) {
    return (
      <MainLayout>
        <div className="py-16 text-center text-muted-foreground">Du har ikke adgang til Opstart.</div>
      </MainLayout>
    );
  }

  const day10 = stats.find((s) => s.day_no === 10);
  const weekLine = monday
    ? `Sidste uge (uge ${lastIso ?? "-"}) · slutresultat · ny status i morgen`
    : `Uge ${isoWeek ?? "-"} · målt til og med i går (${yesterday}) · ${done} af ${total} arbejdsdage gået · ${Math.max(0, total - done)} dage tilbage`;

  const aboutButton = (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: "#f1f4f3", color: "#1b1f1d" }}>
          Om modellen
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] space-y-3 text-[13px]" align="end">
        <p className="font-semibold" style={{ color: "#1b1f1d" }}>
          Status måles på den indeværende kalenderuge til og med i går: ugens salg mod hvor man burde være nu.
          Under tempo og ikke flere salg pr. arbejdsdag end sidste uge = Start her. Under tempo men flere salg pr. arbejdsdag end sidste uge = Hold fast.
          I første opstartsuge findes ingen forrige uge, så under tempo = Hold fast.
        </p>
        <div className="rounded-[12px] p-3" style={{ background: "#f6f8f7" }}>
          <p className="text-[11px] font-extrabold uppercase" style={{ color: "#57635e", letterSpacing: ".1em" }}>
            Historik · målt mod typisk niveau
          </p>
          <p className="mt-1 font-semibold" style={{ color: "#3c4743" }}>
            {day10 && day10.n_below > 0 && day10.n_above > 0
              ? `Lå en ny under typisk på dag 10, stoppede ${Math.round((day10.n_below_stopped / day10.n_below) * 100)} % inden dag 40 — mod ${Math.round((day10.n_above_stopped / day10.n_above) * 100)} % af dem på eller over.`
              : "Grundlaget er endnu for tyndt til en sammenligning på dag 10."}
          </p>
          {stats.map((s) => {
            const line = formatRiskStatShort(s);
            return line ? (
              <p key={s.day_no} className="text-[12px]" style={{ color: "#57635e" }}>
                {line}
              </p>
            ) : null;
          })}
          <p className="mt-1 text-[12px]" style={{ color: "#57635e" }}>
            Lille grundlag · gælder grupper, ikke enkeltpersoner.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <MainLayout>
      <div className="ramp-page" style={{ background: "#e6efec" }}>
        <div className="mx-auto max-w-[1180px] p-4 sm:p-6" style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)" }}>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[30px] font-extrabold leading-tight sm:text-[34px]" style={{ color: "#1b1f1d", letterSpacing: "-.03em" }}>
                  Opstart
                </h1>
                <span
                  className="rounded-full px-[11px] py-[5px] text-[12px] font-extrabold uppercase"
                  style={{ background: "#1b1f1d", color: "#ffffff", letterSpacing: ".06em" }}
                >
                  {campaignLabel}
                </span>
                <span className="flex items-center gap-1 rounded-full px-[10px] py-[5px] text-[12px] font-bold" style={{ background: "#ffffff", color: "#4a5651" }}>
                  <Lock className="h-3 w-3" />
                  Kun for teamledere
                </span>
              </div>
              {(
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <p className="text-[15px] font-semibold" style={{ color: "#3c4743" }}>
                    {weekLine}
                  </p>
                  {!monday && (
                    <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "#57635e" }}>
                      <span className="inline-block h-1.5 w-20 rounded-full" style={{ background: "#d7e0dc" }}>
                        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "#1b1f1d" }} />
                      </span>
                      Ugen er {pct} % gået
                    </span>
                  )}
                </div>
              )}
              <p className="mt-1 text-[12px] font-semibold" style={{ color: "#7b857f" }}>
                Forsøgsordning på {campaignLabel}
                {programStartLabel && !programActive ? ` · ugens 1-1 registreres fra ${programStartLabel}` : ""}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#57635e" }} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Søg sælger"
                  aria-label="Søg sælger"
                  className="w-48 rounded-full bg-white py-2.5 pl-9 pr-4 text-[14px] font-semibold outline-none"
                  style={{ color: "#1b1f1d", boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}
                />
              </div>
              <button
                type="button"
                aria-pressed={discreet}
                onClick={toggleDiscreet}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-[12px] font-bold"
                style={{
                  background: discreet ? "#1b1f1d" : "#ffffff",
                  color: discreet ? "#ffffff" : "#1b1f1d",
                  borderColor: discreet ? "#1b1f1d" : "#d7e0dc",
                }}
              >
                <EyeOff className="h-3.5 w-3.5" />
                Diskret visning
              </button>
            </div>
          </header>

              <RampKpiFilters
                counts={counts}
                missing={missing}
                held={heldCount}
                required={requiredCount}
                active={filter}
                onSelect={(f) => setFilter(filter === f ? null : f)}
                discreet={discreet}
              />

              {!discreet && (
                <section className="rounded-[20px] bg-white p-5 sm:p-7" style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[18px] font-extrabold" style={{ color: "#1b1f1d" }}>
                      Overblik: hvem ligger hvor?
                    </p>
                    <button
                      type="button"
                      onClick={toggleChart}
                      aria-expanded={chartOpen}
                      className="rounded-full px-3 py-1 text-[12px] font-bold"
                      style={{ background: "#f1f4f3", color: "#1b1f1d" }}
                    >
                      {chartOpen ? "Skjul" : "Vis"}
                    </button>
                  </div>
                  {chartOpen && (
                    <>
                      <div className="mt-3">
                        <WeekOverviewChart
                          items={chartItems}
                          targets={minTargets}
                          emptyText={allItems.every((i) => !i.g) ? "Ny uge · første status i morgen" : null}
                          onSelect={(id) => {
                            if (establishedItems.some((i) => i.m.employee_id === id)) {
                              setPanelId(id);
                              return;
                            }
                            setFilter(null);
                            setFocusId({ id, nonce: Date.now() });
                          }}
                        />
                      </div>
                      <p className="mt-3 text-[12px] font-semibold" style={{ color: "#57635e" }}>
                        Vandret: opstartsuge. Lodret: {monday ? "sidste uges salg ift. ugens krav" : "ugens salg til og med i går ift. hvor man burde være nu"} (100 % = på tempo).
                        Tidligere uger tæller ikke med. Over 200 % vises øverst.
                      </p>
                    </>
                  )}
                </section>
              )}

              <RampWeekBoard
                items={shownItems}
                activeFilter={filter}
                discreet={discreet}
                monday={monday}
                focusId={focusId}
                onRowClick={(m) => setPanelId(m.employee_id)}
                onHold={(m) => setDialog({ employeeId: m.employee_id, done: false })}
                aboutButton={discreet ? null : aboutButton}
                footer={<RampMinTargetsEditor targets={minTargets} />}
              />
            <RampEstablishedSection
              members={fullTeam}
              items={establishedItems}
              discreet={discreet}
              target={minTargets[minTargets.length - 1] ?? 0}
              matches={matchesSearch}
              pendingAbsence={pendingAbsence}
              onHold={(m, done) => setDialog({ employeeId: m.employee_id, done })}
              onAbsence={registerAbsence}
              onExclude={exclude}
            />

          {pausedList.length > 0 && (
            <section style={{ display: "grid", gap: 8 }}>
              <div className="mt-1.5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[17px] font-extrabold" style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}>
                    Skal ikke have feedback · {pausedList.length}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                    Disse sælgere er taget ud af oversigten og tælles ikke med i manglende 1-1. De kan aktiveres igen når
                    som helst.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPausedOpen((v) => !v)}
                  aria-expanded={pausedOpen || !!searchTerm}
                  className="rounded-full px-3 py-1 text-[12px] font-bold"
                  style={{ background: "#ffffff", color: "#1b1f1d" }}
                >
                  {pausedOpen || searchTerm ? "Skjul" : "Vis"}
                </button>
              </div>
              {(pausedOpen || !!searchTerm) &&
                pausedList.filter(matchesSearch).map((member) => (
                  <PausedRow
                    key={member.employee_id}
                    member={member}
                    isPending={setExclusion.isPending}
                    onActivate={(m) => setExclusion.mutate({ employeeId: m.employee_id, excluded: false })}
                  />
                ))}
            </section>
          )}
        </div>
      </div>

      <RampSellerPanel
        item={panelItem}
        monday={monday}
        discreet={discreet}
        targets={minTargets}
        onClose={() => setPanelId(null)}
        onHold={(m, done) => {
          setPanelId(null);
          setDialog({ employeeId: m.employee_id, done });
        }}
        onAbsence={registerAbsence}
        onExclude={exclude}
      />

      {dialog && dialogMember && (
        <FeedbackDialog member={dialogMember} alreadyDone={dialog.done} onClose={() => setDialog(null)} />
      )}
    </MainLayout>
  );
}
