import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Loader2, Check, X, Plus } from "lucide-react";
import {
  RAMP_WEEKLY_ABSENCE,
  RAMP_WEEKLY_COACHING,
  RAMP_WEEKLY_LISTEN,
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
import { getInitials } from "@/utils/formatting";

/**
 * Opstartshold — lederrettet side efter Kaspers Farezone-design.
 *
 * Al adgang haandhaeves i databasen. Siden viser kun det lederen selv kan se,
 * og et forloeb kan aldrig vinges af uden feedback: klik aabner altid dialogen,
 * og registreringen sker paa serveren efter mailen er lagt i koen.
 */

type FilterMode = "all" | "danger" | "missing";
/** Opstartere har en norm; hele holdet har ikke. Alt faelles arbejder paa begge. */
type AnyMember = RampTeamMember | RampFullTeamMember;
type SessionKind = "coaching" | "listen";

const KIND_LABEL: Record<SessionKind, string> = {
  coaching: "1-1 coaching",
  listen: "1-1 lyt",
};

const KIND_ACTION: Record<SessionKind, string> = {
  coaching: RAMP_WEEKLY_COACHING,
  listen: RAMP_WEEKLY_LISTEN,
};

const RED = "#d4453c";
const RED_TEXT = "#c13b32";
const AMBER = "#e0b64a";
const AMBER_STRIP = "#e08a2e";
const AMBER_TEXT = "#9a6216";
const GREEN = "#177a4d";

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

function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  };
}

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
    if (action.action_type === RAMP_WEEKLY_COACHING || action.action_type === RAMP_WEEKLY_LISTEN) {
      entry.sessions += 1;
    }
    if (action.action_type === RAMP_WEEKLY_ABSENCE) entry.absence = true;
    weekActions.set(key, entry);
  }

  const gap = member.p25 === null ? 0 : Math.max(0, Math.round(member.p25 - member.cum_sales));
  const countedThisWeek = weekActions.get(weekKey(member.iso_year, member.iso_week))?.sessions ?? 0;
  const sessionsThisWeek =
    member.has_coaching || member.has_listen ? Math.max(1, countedThisWeek) : countedThisWeek;

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

  const sales = member.weeks.map((w) => w.sales);
  let trend: Derived["trend"] = "unknown";
  if (sales.length >= 2) {
    const diff = sales[sales.length - 1] - sales[sales.length - 2];
    trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  }

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
    stripColor: gap >= 4 ? RED : AMBER_STRIP,
    weekActions,
    feedbackLog: member.actions.filter((a) => a.note && a.note.trim().length > 0),
  };
}

function priorityBand(member: AnyMember, d: Derived) {
  if (member.has_absence) {
    return {
      tone: { bg: "#f1f4f3", icon: "#57635e", text: "#1b1f1d" },
      mark: "✓",
      title: "Fravær hele ugen registreret",
      sub: "Ugen er lukket — forløbet genoptages næste uge.",
    };
  }
  if (d.missedWeeks >= 2) {
    return {
      tone: { bg: "#fbe9e8", icon: RED_TEXT, text: "#8f2a23" },
      mark: "!",
      title: `Session mangler — ${d.missedWeeks} uger i træk`,
      sub: "Sæt en 1-1 session i kalenderen i dag",
    };
  }
  if (member.week_required && d.sessionsThisWeek === 0) {
    return {
      tone: { bg: "#fbe9e8", icon: RED_TEXT, text: "#8f2a23" },
      mark: "!",
      title: `Ugens 1-1 session mangler i uge ${member.iso_week}`,
      sub: "Der skal holdes mindst én session denne uge",
    };
  }
  if (!member.week_required && !member.weekly_program_active) {
    return {
      tone: { bg: "#f1f4f3", icon: "#57635e", text: "#1b1f1d" },
      mark: "✓",
      title: "Ordningen er ikke trådt i kraft endnu",
      sub: "Ugen tælles ikke som manglende",
    };
  }
  if (d.trend === "down") {
    return {
      tone: { bg: "#fdf2e3", icon: AMBER_TEXT, text: "#7a4e11" },
      mark: "✓",
      title: "Forløb kørt — men salget falder",
      sub: "Tag trenden op på næste coaching",
    };
  }
  return {
    tone: { bg: "#e7f4ed", icon: GREEN, text: "#0f5a38" },
    mark: "✓",
    title: "Forløb kørt — og salget stiger",
    sub: "Hold kadencen indtil de er i spændet",
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

function WeeklyBars({
  weeks,
  stripColor,
  currentWeek,
}: {
  weeks: RampWeekPoint[];
  stripColor: string;
  currentWeek: number;
}) {
  const last = weeks[weeks.length - 1];
  const bandLow = last ? last.p25 : 0;
  const bandHigh = last ? last.p75 : 0;
  const max = Math.max(1, bandHigh, ...weeks.map((w) => w.sales)) * 1.12;
  const H = 84;
  const px = (v: number) => Math.round((v / max) * H);

  return (
    <div>
      <SectionLabel>Produkter pr. uge mod typisk spænd</SectionLabel>
      <div className="relative mt-3.5 flex items-end gap-2" style={{ height: H }}>
        {bandHigh > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-y-2 border-dashed"
            style={{
              top: H - px(bandHigh),
              height: Math.max(2, px(bandHigh) - px(bandLow)),
              borderColor: "#bcd6c8",
              background: "rgba(23,122,77,.07)",
            }}
          />
        )}
        {weeks.map((w) => {
          const color = w.sales >= w.p25 ? GREEN : w.sales >= w.p25 - 3 ? AMBER : stripColor;
          return (
            <div
              key={weekKey(w.iso_year, w.iso_week)}
              className="relative z-[1] flex flex-1 flex-col items-center gap-[5px]"
            >
              <span
                className="text-[12px] font-extrabold tabular-nums"
                style={{ color: w.sales >= w.p25 ? GREEN : "#57635e" }}
              >
                {w.sales}
              </span>
              <span
                className="w-full"
                style={{
                  height: Math.max(2, px(w.sales)),
                  background: color,
                  borderRadius: "5px 5px 0 0",
                }}
              />
            </div>
          );
        })}
      </div>
      <WeekLabels weeks={weeks} currentWeek={currentWeek} />
      {last && (
        <p className="mt-2.5 text-[12px] font-semibold" style={{ color: "#57635e" }}>
          Stiplet felt = typisk spænd {Math.round(bandLow)}–{Math.round(bandHigh)} · median{" "}
          {Math.round(last.p50)}
        </p>
      )}
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
      ? `Holdt i uge ${member.iso_week} · ${sessions} sessioner`
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
          1-1 session
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
          const color = entry?.absence ? "#e7eeeb" : count >= 1 ? GREEN : "#e3908b";
          const label = entry?.absence
            ? `Uge ${w.iso_week}: fravær hele ugen`
            : count === 1
              ? `Uge ${w.iso_week}: 1 session holdt`
              : `Uge ${w.iso_week}: ${count} sessioner holdt`;
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

function effectLine(member: AnyMember, d: Derived): { text: string; color: string } {
  const coachingWeeks = member.weeks.filter(
    (w) => (d.weekActions.get(weekKey(w.iso_year, w.iso_week))?.sessions ?? 0) > 0,
  ).length;
  if (coachingWeeks < 2 || member.weeks.length < 2) {
    return { text: "For få forløb til at måle effekt endnu", color: "#57635e" };
  }
  const first = member.weeks[0].sales;
  const last = member.weeks[member.weeks.length - 1].sales;
  const diff = last - first;
  return {
    text: `Coaching ${coachingWeeks} uger i træk — salg ${first} → ${last} (${
      diff >= 0 ? `op ${diff}` : `ned ${Math.abs(diff)}`
    })`,
    color: diff >= 0 ? "#0f5a38" : AMBER_TEXT,
  };
}

function MemberCard({
  member,
  onOpen,
  onExclude,
}: {
  member: RampTeamMember;
  onOpen: (member: RampTeamMember, kind: SessionKind, done: boolean) => void;
  onExclude: (member: RampTeamMember) => void;
}) {
  const logAction = useLogRampAction();
  const d = derive(member);
  const band = priorityBand(member, d);
  const effect = effectLine(member, d);
  const trendPill =
    d.trend === "up"
      ? { text: "↑ Stigende", bg: "#e7f4ed", color: "#0f5a38" }
      : d.trend === "down"
        ? { text: "↓ Faldende", bg: "#fbe9e8", color: "#8f2a23" }
        : { text: "→ Flad", bg: "#f1f4f3", color: "#57635e" };

  return (
    <article
      className="relative overflow-hidden rounded-[20px] bg-white"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
    >
      <span
        className="absolute bottom-0 left-0 top-0 w-[5px]"
        style={{ background: d.stripColor }}
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
                {[member.campaign_name, `arbejdsdag ${member.day_no}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill bg={trendPill.bg} color={trendPill.color}>
              {trendPill.text}
            </Pill>
            {d.gap > 0 && (
              <Pill
                bg={d.stripColor === RED ? "#fbe9e8" : "#fdf2e3"}
                color={d.stripColor === RED ? RED_TEXT : AMBER_TEXT}
              >
                {d.gap} under spændet
              </Pill>
            )}
            <ExcludeButton onClick={() => onExclude(member)} />
          </div>
        </div>

        <div
          className="mt-[18px] flex items-center gap-3.5 rounded-[14px] px-[18px] py-3.5"
          style={{ background: band.tone.bg }}
        >
          <span
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] text-[16px] font-extrabold text-white"
            style={{ background: band.tone.icon }}
          >
            {band.mark}
          </span>
          <div className="min-w-0">
            <p
              className="whitespace-normal text-[16px] font-extrabold"
              style={{ color: band.tone.text, letterSpacing: "-.01em", textWrap: "balance" }}
            >
              {band.title}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold" style={{ color: "#57635e" }}>
              {band.sub}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span
            className="whitespace-nowrap text-[12px] font-extrabold tabular-nums"
            style={{ color: "#57635e" }}
          >
            Dag {member.day_no} af 40
          </span>
          <span
            className="h-2 flex-1 overflow-hidden rounded-[4px]"
            style={{ background: "#f1f4f3" }}
          >
            <span
              className="block h-full rounded-[4px]"
              style={{
                width: `${Math.min(100, (member.day_no / 40) * 100)}%`,
                background: d.stripColor,
              }}
            />
          </span>
          <span
            className="whitespace-nowrap text-[12px] font-bold tabular-nums"
            style={{ color: "#57635e" }}
          >
            {member.days_left} dage tilbage
          </span>
        </div>
      </div>

      <div
        className="mt-[18px] grid gap-[22px] border-t px-5 py-[18px] sm:px-[26px] lg:grid-cols-2"
        style={{ borderColor: "#eef2f0" }}
      >
        <WeeklyBars weeks={member.weeks} stripColor={d.stripColor} currentWeek={member.iso_week} />

        <div
          className="rounded-[16px] border px-5 py-[18px]"
          style={{ background: "#f6f9f8", borderColor: "#e7eeeb" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Ugens faste forløb</SectionLabel>
            <span
              className="text-[12px] font-extrabold"
              style={{ color: d.sessionsThisWeek >= 1 ? "#0f5a38" : AMBER_TEXT }}
            >
              {d.sessionsThisWeek >= 1
                ? d.sessionsThisWeek > 1
                  ? `Ugen er klaret · ${d.sessionsThisWeek} sessioner`
                  : "Ugen er klaret"
                : "0 af 1 holdt"}
            </span>
          </div>

          {member.has_absence ? (
            <p className="mt-3 text-[12px] font-semibold" style={{ color: "#57635e" }}>
              Der er registreret fravær hele ugen — forløbet er ikke krævet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <ProgramRow
                sessions={d.sessionsThisWeek}
                member={member}
                missedWeeks={d.missedWeeks}
                onOpen={() => onOpen(member, "coaching", d.sessionsThisWeek > 0)}
              />
              {d.sessionsThisWeek > 0 && (
                <button
                  type="button"
                  onClick={() => onOpen(member, "coaching", true)}
                  className="flex w-full items-center gap-2 rounded-[13px] border border-dashed px-[15px] py-[11px] text-left text-[13px] font-bold"
                  style={{ borderColor: "#c3ccc8", color: "#0f5a38", background: "#ffffff" }}
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ekstra session i uge {member.iso_week}
                </button>
              )}
              {!member.week_required && (
                <p className="text-[12px] font-semibold" style={{ color: "#57635e" }}>
                  {member.weekly_program_active
                    ? "Under 2 arbejdsdage i ugen — forløbet er ikke krævet."
                    : "Ordningen er endnu ikke trådt i kraft — ugen tælles ikke som manglende."}
                </p>
              )}
              <button
                type="button"
                disabled={logAction.isPending}
                onClick={() =>
                  logAction.mutate({
                    employeeId: member.employee_id,
                    actionType: RAMP_WEEKLY_ABSENCE,
                    flagId: member.flag_id,
                  })
                }
                className="text-[12px] font-semibold underline disabled:opacity-50"
                style={{ color: "#57635e" }}
              >
                Registrér fravær hele ugen
              </button>
            </div>
          )}

          <HistoryBars member={member} d={d} />

          <p
            className="mt-3 border-t pt-3 text-[13px] font-bold"
            style={{ borderColor: "#e7eeeb", color: effect.color, textWrap: "pretty" }}
          >
            {effect.text}
          </p>

          <FeedbackLogList member={member} d={d} limit={4} />

        </div>
      </div>
    </article>
  );
}

/** Rene tal pr. uge uden norm — hele holdet maales ikke mod en kurve. */
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
}: {
  member: RampFullTeamMember;
  onOpen: (member: RampFullTeamMember, kind: SessionKind, done: boolean) => void;
  onExclude: (member: RampFullTeamMember) => void;
}) {
  const logAction = useLogRampAction();
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
            <Pill bg="#f1f4f3" color="#1b1f1d">
              {weekSum} produkter på 6 uger
            </Pill>
            <ExcludeButton onClick={() => onExclude(member)} />
          </div>
        </div>
      </div>

      <div
        className="mt-[18px] grid gap-[22px] border-t px-5 py-[18px] sm:px-[26px] lg:grid-cols-2"
        style={{ borderColor: "#eef2f0" }}
      >
        <PlainWeeklyBars weeks={member.weeks} currentWeek={member.iso_week} />

        <div
          className="rounded-[16px] border px-5 py-[18px]"
          style={{ background: "#f6f9f8", borderColor: "#e7eeeb" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Ugens faste forløb</SectionLabel>
            <span
              className="text-[12px] font-extrabold"
              style={{ color: d.sessionsThisWeek >= 1 ? "#0f5a38" : AMBER_TEXT }}
            >
              {d.sessionsThisWeek >= 1
                ? d.sessionsThisWeek > 1
                  ? `Ugen er klaret · ${d.sessionsThisWeek} sessioner`
                  : "Ugen er klaret"
                : "0 af 1 holdt"}
            </span>
          </div>

          {member.has_absence ? (
            <p className="mt-3 text-[12px] font-semibold" style={{ color: "#57635e" }}>
              Der er registreret fravær hele ugen — forløbet er ikke krævet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <ProgramRow
                sessions={d.sessionsThisWeek}
                member={member}
                missedWeeks={d.missedWeeks}
                onOpen={() => onOpen(member, "coaching", d.sessionsThisWeek > 0)}
              />
              {d.sessionsThisWeek > 0 && (
                <button
                  type="button"
                  onClick={() => onOpen(member, "coaching", true)}
                  className="flex w-full items-center gap-2 rounded-[13px] border border-dashed px-[15px] py-[11px] text-left text-[13px] font-bold"
                  style={{ borderColor: "#c3ccc8", color: "#0f5a38", background: "#ffffff" }}
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ekstra session i uge {member.iso_week}
                </button>
              )}
              {!member.week_required && (
                <p className="text-[12px] font-semibold" style={{ color: "#57635e" }}>
                  {member.weekly_program_active
                    ? "Under 2 arbejdsdage i ugen — forløbet er ikke krævet."
                    : "Ordningen er endnu ikke trådt i kraft — ugen tælles ikke som manglende."}
                </p>
              )}
              <button
                type="button"
                disabled={logAction.isPending}
                onClick={() =>
                  logAction.mutate({
                    employeeId: member.employee_id,
                    actionType: RAMP_WEEKLY_ABSENCE,
                    flagId: null,
                  })
                }
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
  kind,
  alreadyDone,
  onClose,
}: {
  member: AnyMember;
  kind: SessionKind;
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
  const previous = d.feedbackLog.filter((a) => a.action_type === KIND_ACTION[kind]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = () => {
    if (!ready || send.isPending) return;
    send.mutate(
      {
        employeeId: member.employee_id,
        kind,
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
              {KIND_LABEL[kind]}
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
              Forløbet er allerede holdt i uge {member.iso_week}. Du kan sende en tilføjelse.
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
  const setExclusion = useSetRampFeedbackExclusion();

  const excludedIds = useMemo(
    () => new Set(exclusions.map((e) => e.employee_id)),
    [exclusions],
  );
  const members = useMemo(
    () => allMembers.filter((m) => !excludedIds.has(m.employee_id)),
    [allMembers, excludedIds],
  );
  const fullTeam = useMemo(
    () => allFullTeam.filter((m) => !excludedIds.has(m.employee_id)),
    [allFullTeam, excludedIds],
  );
  const pausedList = useMemo(
    () =>
      ([...allMembers, ...allFullTeam] as AnyMember[])
        .filter((m) => excludedIds.has(m.employee_id))
        .sort((a, b) => a.employee_name.localeCompare(b.employee_name, "da")),
    [allMembers, allFullTeam, excludedIds],
  );
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showEvidence, setShowEvidence] = useState(false);
  const [dialog, setDialog] = useState<{
    employeeId: string;
    kind: SessionKind;
    done: boolean;
  } | null>(null);

  const isoWeek = members[0]?.iso_week ?? null;
  const campaignLabel = useMemo(() => {
    const names = Array.from(
      new Set(members.map((m) => m.campaign_name).filter((n): n is string => Boolean(n))),
    );
    return names.length > 0 ? names.join(" · ") : "Eesy TM Products";
  }, [members]);
  const programStart = members[0]?.weekly_program_start_date ?? null;
  const programActive = members[0]?.weekly_program_active ?? false;
  const programStartLabel = programStart
    ? new Date(`${programStart}T00:00:00`).toLocaleDateString("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const allList = useMemo(
    () =>
      members
        .map((m) => ({ member: m, urgency: derive(m).urgency }))
        .sort(
          (a, b) =>
            b.urgency - a.urgency ||
            a.member.employee_name.localeCompare(b.member.employee_name, "da"),
        )
        .map((x) => x.member),
    [members],
  );

  const dangerList = useMemo(() => allList.filter((m) => m.status === "under"), [allList]);

  const missingList = useMemo(
    () =>
      allList.filter(
        (m) => m.week_required && !m.has_absence && !m.has_coaching && !m.has_listen,
      ),
    [allList],
  );

  const counts = useMemo(() => {
    const good = members.filter((m) => m.status === "midt" || m.status === "over").length;
    const pending = members.filter((m) => m.status === "ukendt").length;
    return {
      danger: dangerList.length,
      good,
      pending,
      missing: missingList.length,
      total: members.length,
    };
  }, [members, dangerList.length, missingList.length]);

  const fullTeamList = useMemo(
    () =>
      [...fullTeam].sort(
        (a, b) =>
          Number(derive(b).missedWeeks > 0) - Number(derive(a).missedWeeks > 0) ||
          a.employee_name.localeCompare(b.employee_name, "da"),
      ),
    [fullTeam],
  );
  const fullTeamMissing = useMemo(
    () =>
      fullTeam.filter((m) => m.week_required && !m.has_absence && !m.has_coaching && !m.has_listen)
        .length,
    [fullTeam],
  );

  const dialogMember: AnyMember | undefined = dialog
    ? (members.find((m) => m.employee_id === dialog.employeeId) as AnyMember | undefined) ??
      fullTeam.find((m) => m.employee_id === dialog.employeeId)
    : undefined;

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
        <div className="py-16 text-center text-muted-foreground">
          Du har ikke adgang til Opstartshold.
        </div>
      </MainLayout>
    );
  }

  const list = filter === "all" ? allList : filter === "danger" ? dangerList : missingList;
  const day10 = stats.find((s) => s.day_no === 10);

  return (
    <MainLayout>
      <div className="ramp-page" style={{ background: "#e6efec" }}>
        <div className="mx-auto max-w-[1080px] p-4 sm:p-6" style={{ display: "grid", gap: 18 }}>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1
                  className="text-[30px] font-extrabold leading-tight sm:text-[34px]"
                  style={{ color: "#1b1f1d", letterSpacing: "-.03em" }}
                >
                  Opstartshold
                </h1>
                <span
                  className="rounded-full px-[11px] py-[5px] text-[12px] font-extrabold uppercase"
                  style={{ background: "#1b1f1d", color: "#ffffff", letterSpacing: ".06em" }}
                >
                  {campaignLabel}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] font-semibold" style={{ color: "#57635e" }}>
                Uge {isoWeek ?? "-"} · første 40 arbejdsdage
              </p>
              <p className="mt-1 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                Forsøgsordning: gælder kun {campaignLabel}. Virker det, ruller vi det ud på de
                øvrige teams.
              </p>
              {programStartLabel && (
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                  {programActive
                    ? `Ugentlige forløb registreres fra ${programStartLabel}.`
                    : `Ugentlige forløb registreres først fra ${programStartLabel} — indtil da tælles ingen uger som manglende.`}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { mode: "all" as FilterMode, label: `Alle nye · ${counts.total}` },
                  { mode: "danger" as FilterMode, label: `I farezonen · ${counts.danger}` },
                  {
                    mode: "missing" as FilterMode,
                    label: `Mangler forløb i uge ${isoWeek ?? "-"} · ${counts.missing}`,
                  },
                ]
              ).map((tab) => {
                const active = filter === tab.mode;
                return (
                  <button
                    key={tab.mode}
                    type="button"
                    onClick={() => setFilter(tab.mode)}
                    className="rounded-full px-4 py-2.5 text-[14px] font-bold"
                    style={{
                      background: active ? "#1b1f1d" : "#ffffff",
                      color: active ? "#ffffff" : "#1b1f1d",
                      boxShadow: "0 1px 2px rgba(0,0,0,.06)",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div className="grid gap-3.5 sm:grid-cols-3">
            {[
              {
                strip: RED,
                label: "I farezonen",
                value: counts.danger,
                sub: `af ${counts.total} sælgere`,
                extra: "Under det typiske niveau",
                extraColor: RED_TEXT,
              },
              {
                strip: GREEN,
                label: "Ser godt ud",
                value: counts.good,
                sub: "på eller over typisk",
                extra: "Skal stadig have ugens forløb",
                extraColor: "#57635e",
              },
              {
                strip: !programActive ? "#c9d6d1" : counts.missing > 0 ? AMBER : GREEN,
                label: `Mangler forløb i uge ${isoWeek ?? "-"}`,
                value: counts.missing,
                sub: `af ${counts.total} sælgere`,
                extra: !programActive
                  ? programStartLabel
                    ? `Starter ${programStartLabel}`
                    : "Ordningen er ikke trådt i kraft endnu"
                  : counts.missing > 0
                    ? "Ugens 1-1 session mangler stadig"
                    : "Alle forløb er afviklet",
                extraColor: !programActive
                  ? "#57635e"
                  : counts.missing > 0
                    ? AMBER_TEXT
                    : "#0f5a38",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="relative overflow-hidden rounded-[20px] bg-white px-[22px] py-5"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
              >
                <span
                  className="absolute bottom-0 left-0 top-0 w-[5px]"
                  style={{ background: kpi.strip }}
                />
                <p
                  className="text-[12px] font-extrabold uppercase"
                  style={{ color: "#57635e", letterSpacing: ".12em" }}
                >
                  {kpi.label}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: 40,
                      fontWeight: 800,
                      letterSpacing: "-.04em",
                      lineHeight: 1,
                      color: "#1b1f1d",
                    }}
                  >
                    {kpi.value}
                  </span>
                  <span className="text-[14px] font-semibold" style={{ color: "#57635e" }}>
                    {kpi.sub}
                  </span>
                </div>
                <p className="mt-[7px] text-[13px] font-bold" style={{ color: kpi.extraColor }}>
                  {kpi.extra}
                </p>
              </div>
            ))}
          </div>

          {stats.length > 0 && (
            <section
              className="rounded-[16px] bg-white px-[22px] py-4"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
            >
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
                <span
                  className="h-[9px] w-[9px] shrink-0 rounded-full"
                  style={{ background: RED }}
                />
                <p
                  className="min-w-[200px] flex-1 text-[14px] font-bold"
                  style={{ color: "#1b1f1d" }}
                >
                  {day10 && day10.n_below > 0 && day10.n_above > 0 ? (
                    <>
                      Under typisk på dag 10 →{" "}
                      <strong style={{ color: RED_TEXT }}>
                        {Math.round((day10.n_below_stopped / day10.n_below) * 100)} %
                      </strong>{" "}
                      stopper inden dag 40. På eller over →{" "}
                      <strong style={{ color: GREEN }}>
                        {Math.round((day10.n_above_stopped / day10.n_above) * 100)} %
                      </strong>
                      .
                    </>
                  ) : (
                    "Grundlaget er endnu for tyndt til en sammenligning på dag 10."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setShowEvidence((v) => !v)}
                  className="rounded-full px-3.5 py-[7px] text-[13px] font-bold"
                  style={{ background: "#f1f4f3", color: "#1b1f1d" }}
                >
                  {showEvidence ? "Skjul grundlag" : "Se grundlag"}
                </button>
              </div>
              {showEvidence && (
                <div
                  className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2 border-t pt-3.5 text-[13px] font-semibold"
                  style={{ borderColor: "#eaefed", color: "#57635e" }}
                >
                  {stats.map((s) => {
                    const line = formatRiskStatShort(s);
                    return line ? <span key={s.day_no}>{line}</span> : null;
                  })}
                  <span>Lille grundlag — tallene kan flytte sig</span>
                  <span>Gælder grupper, ikke enkeltpersoner</span>
                </div>
              )}
            </section>
          )}

          <section style={{ display: "grid", gap: 12 }}>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className="text-[19px] font-extrabold"
                  style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}
                >
                  {filter === "missing"
                    ? `Mangler forløb i uge ${isoWeek ?? "-"}`
                    : filter === "danger"
                      ? "I farezonen nu"
                      : "Alle nye i opstart"}
                </p>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                  Alle nye får mindst én 1-1 session med feedback hver uge i de første 40
                  arbejdsdage — også dem der ligger flot. Der kan tilføjes flere sessioner efter
                  behov.
                </p>
              </div>
              <p className="text-[13px] font-bold" style={{ color: "#57635e" }}>
                Sorteret efter hastende først
              </p>
            </div>

            {list.length === 0 ? (
              <div
                className="rounded-[20px] bg-white p-6 text-center"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
              >
                <p className="text-[15px] font-extrabold" style={{ color: "#1b1f1d" }}>
                  {filter === "missing"
                    ? `Alle forløb er afviklet i uge ${isoWeek ?? "-"}`
                    : filter === "danger"
                      ? "Ingen sælgere ligger under spændet lige nu"
                      : "Ingen sælgere er i opstart lige nu"}
                </p>
                {filter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="mt-2 text-[12px] font-bold underline"
                    style={{ color: "#0f5a38" }}
                  >
                    Vis alle nye
                  </button>
                )}
              </div>
            ) : (
              list.map((member) => (
                <MemberCard
                  key={member.employee_id}
                  member={member}
                  onOpen={(m, kind, done) =>
                    setDialog({ employeeId: m.employee_id, kind, done })
                  }
                  onExclude={(m) =>
                    setExclusion.mutate({ employeeId: m.employee_id, excluded: true })
                  }
                />
              ))
            )}
          </section>

          <section style={{ display: "grid", gap: 12 }}>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className="text-[19px] font-extrabold"
                  style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}
                >
                  Hele holdet · {fullTeamList.length}
                </p>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                  Alle øvrige aktive sælgere på {campaignLabel}. Ingen norm og ingen farezone — kun
                  tallene og ugens 1-1 session med feedback.
                </p>
              </div>
              <p
                className="text-[13px] font-bold"
                style={{ color: fullTeamMissing > 0 ? AMBER_TEXT : "#0f5a38" }}
              >
                {fullTeamMissing > 0
                  ? `${fullTeamMissing} mangler forløb i uge ${isoWeek ?? "-"}`
                  : "Alle forløb er afviklet"}
              </p>
            </div>

            {fullTeamLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#57635e" }} />
              </div>
            ) : fullTeamList.length === 0 ? (
              <div
                className="rounded-[20px] bg-white p-6 text-center"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
              >
                <p className="text-[15px] font-extrabold" style={{ color: "#1b1f1d" }}>
                  Ingen øvrige sælgere på holdet lige nu
                </p>
              </div>
            ) : (
              fullTeamList.map((member) => (
                <FullTeamMemberCard
                  key={member.employee_id}
                  member={member}
                  onOpen={(m, kind, done) =>
                    setDialog({ employeeId: m.employee_id, kind, done })
                  }
                  onExclude={(m) =>
                    setExclusion.mutate({ employeeId: m.employee_id, excluded: true })
                  }
                />
              ))
            )}
          </section>

          {pausedList.length > 0 && (
            <section style={{ display: "grid", gap: 8 }}>
              <div className="mt-1.5">
                <p
                  className="text-[19px] font-extrabold"
                  style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}
                >
                  Skal ikke have feedback · {pausedList.length}
                </p>
                <p className="mt-1 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                  Disse sælgere er taget ud af oversigten og tælles ikke med i manglende forløb. De
                  kan aktiveres igen når som helst.
                </p>
              </div>
              {pausedList.map((member) => (
                <PausedRow
                  key={member.employee_id}
                  member={member}
                  isPending={setExclusion.isPending}
                  onActivate={(m) =>
                    setExclusion.mutate({ employeeId: m.employee_id, excluded: false })
                  }
                />
              ))}
            </section>
          )}

          <p className="pb-4 text-[12px]" style={{ color: "#57635e" }}>
            Forløbet kører indtil sælgeren er inde i det typiske spænd. Det er en samtale der
            mangler — ikke en vurdering af sælgeren.
          </p>
        </div>
      </div>

      {dialog && dialogMember && (
        <FeedbackDialog
          member={dialogMember}
          kind={dialog.kind}
          alreadyDone={dialog.done}
          onClose={() => setDialog(null)}
        />
      )}
    </MainLayout>
  );
}
