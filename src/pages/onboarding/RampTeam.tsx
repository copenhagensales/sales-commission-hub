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

function Pill({
  children,
  bg,
  color,
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
}) {
  return (
    <span
      className="rounded-full px-[13px] py-[7px] text-[13px] font-extrabold"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[12px] font-extrabold uppercase"
      style={{ color: "#57635e", letterSpacing: ".1em" }}
    >
      {children}
    </p>
  );
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

/** Markerer den indevaerende uge i ugelabels, saa "nu" er tydelig. */
function WeekLabels({
  weeks,
  currentWeek,
}: {
  weeks: { iso_year: number; iso_week: number }[];
  currentWeek: number;
}) {
  return (
    <div className="mt-2 flex gap-2">
      {weeks.map((w) => {
        const isNow = w.iso_week === currentWeek;
        return (
          <span
            key={`lbl-${weekKey(w.iso_year, w.iso_week)}`}
            className="flex-1 text-center text-[11px] font-bold tabular-nums"
            style={{ color: isNow ? "#0f5a38" : "#57635e" }}
          >
            {isNow ? (
              <span
                className="inline-block rounded-[6px] px-1.5 py-0.5 font-extrabold"
                style={{ background: "#e7f4ed" }}
              >
                u{w.iso_week} · nu
              </span>
            ) : (
              `u${w.iso_week}`
            )}
          </span>
        );
      })}
    </div>
  );
}

function ProgramRow({
  sessions,
  member,
  missedWeeks,
  onOpen,
}: {
  sessions: number;
  member: AnyMember;
  missedWeeks: number;
  onOpen: () => void;
}) {
  const done = sessions > 0;
  const status = done
    ? sessions > 1
      ? `Holdt i uge ${member.iso_week} · ${sessions} gange`
      : `Holdt i uge ${member.iso_week}`
    : missedWeeks >= 2
      ? `Mangler ${missedWeeks} uger i træk`
      : "Skal holdes denne uge";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-[13px] border px-[15px] py-[13px] text-left transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,.07)]"
      style={{
        background: done ? "#e7f4ed" : "#ffffff",
        borderColor: done ? "#a9dcc3" : "#e0e7e4",
      }}
    >
      <span
        className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-[8px] border-2"
        style={{
          background: done ? GREEN : "#ffffff",
          borderColor: done ? GREEN : "#c3ccc8",
        }}
      >
        {done && <Check className="h-3.5 w-3.5" style={{ color: "#fff" }} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold" style={{ color: "#1b1f1d" }}>
          1-1
        </span>
        <span className="mt-px block text-[12px] font-semibold" style={{ color: "#57635e" }}>
          {status}
        </span>
      </span>
    </button>
  );
}

function HistoryBars({ member, d }: { member: AnyMember; d: Derived }) {
  return (
    <div className="mt-3 flex items-center gap-2.5">
      <span
        className="whitespace-nowrap text-[11px] font-extrabold"
        style={{ color: "#57635e" }}
      >
        6 uger
      </span>
      <div className="flex flex-1 gap-1">
        {member.weeks.map((w) => {
          const entry = d.weekActions.get(weekKey(w.iso_year, w.iso_week));
          const count = entry?.sessions ?? 0;
          const color = entry?.absence ? "#e7eeeb" : count >= 1 ? GREEN : "#c9d2dc";
          const label = entry?.absence
            ? `Uge ${w.iso_week}: fravær hele ugen`
            : count === 1
              ? `Uge ${w.iso_week}: 1-1 holdt`
              : `Uge ${w.iso_week}: ${count} × 1-1 holdt`;
          return (
            <span
              key={`hist-${weekKey(w.iso_year, w.iso_week)}`}
              title={label}
              aria-label={label}
              className="h-[9px] flex-1 rounded-[3px]"
              style={{ background: color }}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlainWeeklyBars({
  weeks,
  currentWeek,
}: {
  weeks: RampFullTeamMember["weeks"];
  currentWeek: number;
}) {
  const max = Math.max(1, ...weeks.map((w) => w.sales)) * 1.12;
  const H = 72;

  return (
    <div>
      <SectionLabel>Produkter pr. uge</SectionLabel>
      <div className="mt-3.5 flex items-end gap-2" style={{ height: H }}>
        {weeks.map((w) => (
          <div
            key={weekKey(w.iso_year, w.iso_week)}
            className="flex flex-1 flex-col items-center gap-[5px]"
          >
            <span
              className="text-[12px] font-extrabold tabular-nums"
              style={{ color: "#57635e" }}
            >
              {w.sales}
            </span>
            <span
              className="w-full"
              style={{
                height: Math.max(2, Math.round((w.sales / max) * H)),
                background: w.sales > 0 ? GREEN : "#d7e2dd",
                borderRadius: "5px 5px 0 0",
              }}
            />
          </div>
        ))}
      </div>
      <WeekLabels weeks={weeks} currentWeek={currentWeek} />
      <p className="mt-2.5 text-[12px] font-semibold" style={{ color: "#57635e" }}>
        Ingen norm på hele holdet — tallene står som de er.
      </p>
    </div>
  );
}

/** Kort for hele holdet: tal + ugens faste forloeb, ingen kurve og ingen flag. */
function FullTeamMemberCard({
  member,
  onOpen,
  onExclude,
  onAbsence,
  absencePending,
  discreet,
}: {
  member: RampFullTeamMember;
  onOpen: (member: RampFullTeamMember, done: boolean) => void;
  onAbsence: (member: RampFullTeamMember) => void;
  absencePending: boolean;
  onExclude: (member: RampFullTeamMember) => void;
  discreet: boolean;
}) {
  const d = derive(member);
  const weekSum = member.weeks.reduce((sum, w) => sum + w.sales, 0);

  return (
    <article
      className="relative overflow-hidden rounded-[20px] bg-white"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
    >
      <span
        className="absolute bottom-0 left-0 top-0 w-[5px]"
        style={{ background: d.sessionsThisWeek >= 1 || member.has_absence ? GREEN : NEUTRAL }}
      />

      <div className="px-5 pt-5 sm:px-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[15px] font-extrabold"
              style={{ background: "#f1f4f3", color: "#4a5651" }}
            >
              {getInitials(member.employee_name)}
            </span>
            <div className="min-w-0">
              <p
                className="text-[18px] font-extrabold leading-tight"
                style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}
              >
                {member.employee_name}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                {[member.team_name, `${member.day_no} arbejdsdage i alt`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!discreet && (
              <Pill bg="#f1f4f3" color="#1b1f1d">
                {weekSum} produkter på 6 uger
              </Pill>
            )}
            <ExcludeButton onClick={() => onExclude(member)} />
          </div>
        </div>
      </div>

      <div
        className="mt-[18px] grid gap-[22px] border-t px-5 py-[18px] sm:px-[26px] lg:grid-cols-2"
        style={{ borderColor: "#eef2f0" }}
      >
        {discreet ? (
          <p className="text-[13px] font-semibold" style={{ color: "#57635e" }}>
            Produktgrafen er skjult i diskret visning.
          </p>
        ) : (
          <PlainWeeklyBars weeks={member.weeks} currentWeek={member.iso_week} />
        )}

        <div
          className="rounded-[16px] border px-5 py-[18px]"
          style={{ background: "#f6f9f8", borderColor: "#e7eeeb" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Ugens 1-1</SectionLabel>
            <span
              className="text-[12px] font-extrabold"
              style={{ color: d.sessionsThisWeek >= 1 ? "#0f5a38" : AMBER_TEXT }}
            >
              {d.sessionsThisWeek >= 1
                ? d.sessionsThisWeek > 1
                  ? `Ugen er klaret · ${d.sessionsThisWeek} × 1-1`
                  : "Ugen er klaret"
                : "0 af 1 holdt"}
            </span>
          </div>

          {member.has_absence ? (
            <p className="mt-3 text-[12px] font-semibold" style={{ color: "#57635e" }}>
              Der er registreret fravær hele ugen — 1-1 er ikke krævet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <ProgramRow
                sessions={d.sessionsThisWeek}
                member={member}
                missedWeeks={d.missedWeeks}
                onOpen={() => onOpen(member, d.sessionsThisWeek > 0)}
              />
              {d.sessionsThisWeek > 0 && (
                <button
                  type="button"
                  onClick={() => onOpen(member, true)}
                  className="flex w-full items-center gap-2 rounded-[13px] border border-dashed px-[15px] py-[11px] text-left text-[13px] font-bold"
                  style={{ borderColor: "#c3ccc8", color: "#0f5a38", background: "#ffffff" }}
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ekstra 1-1 i uge {member.iso_week}
                </button>
              )}
              {!member.week_required && (
                <p className="text-[12px] font-semibold" style={{ color: "#57635e" }}>
                  {member.weekly_program_active
                    ? "Under 2 arbejdsdage i ugen — 1-1 er ikke krævet."
                    : "Ordningen er endnu ikke trådt i kraft — ugen tælles ikke som manglende."}
                </p>
              )}
              <button
                type="button"
                disabled={absencePending}
                onClick={() => onAbsence(member)}
                className="text-[12px] font-semibold underline disabled:opacity-50"
                style={{ color: "#57635e" }}
              >
                Registrér fravær hele ugen
              </button>
            </div>
          )}

          <HistoryBars member={member} d={d} />

          <FeedbackLogList member={member} d={d} limit={2} bordered />
        </div>
      </div>
    </article>
  );
}

/**
 * Sendt feedback pr. kort. Feedback fra den indevaerende uge staar aaben;
 * aeldre uger foldes sammen til en linje med ugenummer, saa det er tydeligt
 * at de ikke daekker ugens krav.
 */
function FeedbackLogList({
  member,
  d,
  limit,
  bordered = false,
}: {
  member: AnyMember;
  d: Derived;
  limit: number;
  bordered?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (d.feedbackLog.length === 0) return null;

  const currentRank = member.iso_year * 100 + member.iso_week;
  const ranks = member.weeks.map((w) => w.iso_year * 100 + w.iso_week);

  const entries = d.feedbackLog.slice(0, limit).map((a, index) => {
    const { year, week } = isoWeekOf(new Date(a.performed_at));
    const rank = year * 100 + week;
    const idx = ranks.indexOf(rank);
    const weeksAgo = idx >= 0 ? ranks.length - 1 - idx : rank < currentRank ? -1 : 0;
    return { a, key: `${a.performed_at}-${index}`, week, isCurrent: rank >= currentRank, weeksAgo };
  });

  const weekLabel = (week: number, weeksAgo: number) => {
    if (weeksAgo <= 0) return `uge ${week}`;
    if (weeksAgo === 1) return `uge ${week} (sidste uge)`;
    return `uge ${week} (${weeksAgo} uger siden)`;
  };

  const latest = entries[0];
  const anyCurrent = entries.some((e) => e.isCurrent);

  return (
    <div
      className={bordered ? "mt-3 space-y-2 border-t pt-3" : "mt-3 space-y-2"}
      style={bordered ? { borderColor: "#e7eeeb" } : undefined}
    >
      <SectionLabel>Sendt feedback</SectionLabel>
      {!anyCurrent && latest && (
        <p className="text-[11px] font-semibold" style={{ color: AMBER_TEXT }}>
          Ingen feedback sendt i uge {member.iso_week} — seneste er fra{" "}
          {weekLabel(latest.week, latest.weeksAgo)}
        </p>
      )}
      {entries.map(({ a, key, week, isCurrent, weeksAgo }) => {
        const meta = `${a.performed_by_name ? `Af ${a.performed_by_name} · ` : ""}Sendt til ${a.recipients.length} · ${weekLabel(week, weeksAgo)}`;
        const open = openKey === key;

        return (
          <div
            key={key}
            className="rounded-[13px] border bg-white"
            style={{ borderColor: isCurrent ? "#cfe6da" : "#e7eeeb" }}
          >
            <button
              type="button"
              onClick={() => setOpenKey(open ? null : key)}
              className="flex w-full items-start justify-between gap-2 p-3 text-left"
            >
              <span className="min-w-0">
                <span
                  className="block text-[12px] font-bold"
                  style={{ color: "#1b1f1d", textWrap: "pretty" }}
                >
                  {a.action_type} · {weekLabel(week, weeksAgo)}
                </span>
                <span className="block text-[11px] font-semibold" style={{ color: "#57635e" }}>
                  {a.performed_by_name ? `Af ${a.performed_by_name}` : `Sendt til ${a.recipients.length}`}
                </span>
              </span>
              <span
                className="shrink-0 text-[11px] font-extrabold"
                style={{ color: "#57635e" }}
                aria-hidden
              >
                {open ? "▲" : "▼"}
              </span>
            </button>
            {open && (
              <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: "#eef2f0" }}>
                <p className="text-[11px] font-semibold" style={{ color: "#57635e" }}>
                  {meta}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[12px]" style={{ color: "#1b1f1d" }}>
                  {a.note}
                </p>
              </div>
            )}
          </div>
        );
      })}
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
  const { data: allFullTeam = [], isLoading: fullTeamLoading } = useRampFullTeam();
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

  const [view, setView] = useState<"new" | "team">("new");
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
  const counts = useMemo(() => {
    const c: Record<SupportGroup, number> = { start: 0, hold: 0, track: 0 };
    for (const i of items) if (i.g) c[i.g] += 1;
    return c;
  }, [items]);
  const missing = items.filter((i) => i.one.kind === "missing").length;
  const requiredCount = items.filter((i) => i.m.week_required).length;
  const heldCount = items.filter((i) => i.m.week_required && i.one.kind === "held").length;

  const shownItems = items.filter((i) => matchesSearch(i.m));
  const chartItems = shownItems.filter((i) =>
    !filter ? true : filter === "missing" ? i.one.kind === "missing" : i.g === filter,
  );
  const panelItem = items.find((i) => i.m.employee_id === panelId) ?? null;

  const fullTeamList = useMemo(
    () =>
      [...fullTeam].sort(
        (a, b) =>
          Number(derive(b).missedWeeks > 0) - Number(derive(a).missedWeeks > 0) ||
          a.employee_name.localeCompare(b.employee_name, "da"),
      ),
    [fullTeam],
  );

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
  const filteredFullTeam = fullTeamList.filter(matchesSearch);

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
          Under tempo og ikke bedre end sidste uge = Start her. Under tempo men bedre end sidste uge = Hold fast.
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
        <div className="mx-auto max-w-[1180px] p-4 sm:p-6" style={{ display: "grid", gap: 18 }}>
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
              {view === "new" && (
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
              <div className="flex rounded-full bg-white p-1" role="tablist" style={{ boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
                {(
                  [
                    { v: "new" as const, label: `Nye i opstart · ${members.length}` },
                    { v: "team" as const, label: "Hele holdet" },
                  ]
                ).map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    role="tab"
                    aria-selected={view === t.v}
                    onClick={() => setView(t.v)}
                    className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold"
                    style={{ background: view === t.v ? "#1b1f1d" : "transparent", color: view === t.v ? "#ffffff" : "#1b1f1d" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
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

          {view === "new" ? (
            <>
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
                          emptyText={items.every((i) => !i.g) ? "Ny uge · første status i morgen" : null}
                          onSelect={(id) => {
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
            </>
          ) : (
            <section style={{ display: "grid", gap: 12 }}>
              <div>
                <p className="text-[19px] font-extrabold" style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}>
                  Hele holdet · {fullTeamList.length}
                </p>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                  Alle øvrige aktive sælgere på {campaignLabel}. Ingen norm og ingen status — kun tallene og ugens 1-1.
                </p>
              </div>
              {fullTeamLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#57635e" }} />
                </div>
              ) : filteredFullTeam.length === 0 ? (
                <div className="rounded-[20px] bg-white p-6 text-center" style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
                  <p className="text-[15px] font-extrabold" style={{ color: "#1b1f1d" }}>
                    Ingen øvrige sælgere på holdet lige nu
                  </p>
                </div>
              ) : (
                filteredFullTeam.map((member) => (
                  <FullTeamMemberCard
                    key={member.employee_id}
                    member={member}
                    discreet={discreet}
                    absencePending={pendingAbsence.has(member.employee_id)}
                    onOpen={(m, done) => setDialog({ employeeId: m.employee_id, done })}
                    onAbsence={registerAbsence}
                    onExclude={exclude}
                  />
                ))
              )}
            </section>
          )}

          {pausedList.length > 0 && (
            <section style={{ display: "grid", gap: 8 }}>
              <div className="mt-1.5">
                <p className="text-[17px] font-extrabold" style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}>
                  Skal ikke have feedback · {pausedList.length}
                </p>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                  Disse sælgere er taget ud af oversigten og tælles ikke med i manglende 1-1. De kan aktiveres igen når
                  som helst.
                </p>
              </div>
              {pausedList.filter(matchesSearch).map((member) => (
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
        onHold={(m, done) => setDialog({ employeeId: m.employee_id, done })}
        onAbsence={registerAbsence}
        onExclude={exclude}
      />

      {dialog && dialogMember && (
        <FeedbackDialog member={dialogMember} alreadyDone={dialog.done} onClose={() => setDialog(null)} />
      )}
    </MainLayout>
  );
}
