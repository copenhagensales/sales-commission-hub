import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Loader2, Check, X } from "lucide-react";
import {
  RAMP_WEEKLY_ABSENCE,
  RAMP_WEEKLY_COACHING,
  RAMP_WEEKLY_LISTEN,
  formatRiskStatShort,
  useCanViewRampTeam,
  useLogRampAction,
  useRampRiskStats,
  useRampTeamOverview,
  useSendRampSessionFeedback,
  type RampAction,
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

type FilterMode = "danger" | "missing";
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
  doneThisWeek: number;
  missedListen: number;
  trend: "up" | "down" | "flat" | "unknown";
  urgency: number;
  stripColor: string;
  weekActions: Map<string, { coaching: boolean; listen: boolean; absence: boolean }>;
  feedbackLog: RampAction[];
}

function weekKey(year: number, week: number) {
  return `${year}-${week}`;
}

function derive(member: RampTeamMember): Derived {
  const weekActions = new Map<string, { coaching: boolean; listen: boolean; absence: boolean }>();
  for (const action of member.actions) {
    const { year, week } = isoWeekOf(new Date(action.performed_at));
    const key = weekKey(year, week);
    const entry = weekActions.get(key) ?? { coaching: false, listen: false, absence: false };
    if (action.action_type === RAMP_WEEKLY_COACHING) entry.coaching = true;
    if (action.action_type === RAMP_WEEKLY_LISTEN) entry.listen = true;
    if (action.action_type === RAMP_WEEKLY_ABSENCE) entry.absence = true;
    weekActions.set(key, entry);
  }

  const gap = member.p25 === null ? 0 : Math.max(0, Math.round(member.p25 - member.cum_sales));
  const doneThisWeek = (member.has_coaching ? 1 : 0) + (member.has_listen ? 1 : 0);

  // Sammenhaengende uger bagud uden et lyt (den aktuelle uge taelles med).
  let missedListen = 0;
  for (let i = member.weeks.length - 1; i >= 0; i--) {
    const w = member.weeks[i];
    const entry = weekActions.get(weekKey(w.iso_year, w.iso_week));
    if (entry?.absence) break;
    if (entry?.listen) break;
    missedListen += 1;
  }

  const sales = member.weeks.map((w) => w.sales);
  let trend: Derived["trend"] = "unknown";
  if (sales.length >= 2) {
    const diff = sales[sales.length - 1] - sales[sales.length - 2];
    trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  }

  const urgency =
    (missedListen >= 2 ? 100 : 0) + (2 - doneThisWeek) * 20 + gap * 3 + (trend === "down" ? 10 : 0);

  return {
    gap,
    doneThisWeek,
    missedListen,
    trend,
    urgency,
    stripColor: gap >= 4 ? RED : AMBER_STRIP,
    weekActions,
    feedbackLog: member.actions.filter((a) => a.note && a.note.trim().length > 0),
  };
}

function priorityBand(member: RampTeamMember, d: Derived) {
  const missingKind = member.has_coaching ? KIND_LABEL.listen : KIND_LABEL.coaching;
  if (member.has_absence) {
    return {
      tone: { bg: "#f1f4f3", icon: "#57635e", text: "#1b1f1d" },
      mark: "✓",
      title: "Fravær hele ugen registreret",
      sub: "Ugen er lukket — forløbet genoptages næste uge.",
    };
  }
  if (d.missedListen >= 2) {
    return {
      tone: { bg: "#fbe9e8", icon: RED_TEXT, text: "#8f2a23" },
      mark: "!",
      title: `Lyt mangler — ${d.missedListen} uger i træk`,
      sub: "Sæt et lyt i kalenderen i dag",
    };
  }
  if (d.doneThisWeek === 0) {
    return {
      tone: { bg: "#fbe9e8", icon: RED_TEXT, text: "#8f2a23" },
      mark: "!",
      title: `Begge forløb mangler i uge ${member.iso_week}`,
      sub: "Coaching og lyt skal holdes denne uge",
    };
  }
  if (d.doneThisWeek === 1) {
    return {
      tone: { bg: "#fdf2e3", icon: AMBER_TEXT, text: "#7a4e11" },
      mark: "!",
      title: `${missingKind} mangler i uge ${member.iso_week}`,
      sub: "Ét forløb tilbage før ugen er lukket",
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

function WeeklyBars({ weeks, stripColor }: { weeks: RampWeekPoint[]; stripColor: string }) {
  const last = weeks[weeks.length - 1];
  const bandLow = last ? last.p25 : 0;
  const bandHigh = last ? last.p75 : 0;
  const max = Math.max(1, bandHigh, ...weeks.map((w) => w.sales)) * 1.12;
  const H = 84;
  const px = (v: number) => Math.round((v / max) * H);

  return (
    <div>
      <SectionLabel>Salg pr. uge mod typisk spænd</SectionLabel>
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
      <div className="mt-2 flex gap-2">
        {weeks.map((w) => (
          <span
            key={`lbl-${weekKey(w.iso_year, w.iso_week)}`}
            className="flex-1 text-center text-[11px] font-bold tabular-nums"
            style={{ color: "#57635e" }}
          >
            u{w.iso_week}
          </span>
        ))}
      </div>
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
  kind,
  done,
  member,
  missedListen,
  onOpen,
}: {
  kind: SessionKind;
  done: boolean;
  member: RampTeamMember;
  missedListen: number;
  onOpen: () => void;
}) {
  const status = done
    ? `Holdt i uge ${member.iso_week}`
    : kind === "listen" && missedListen >= 2
      ? `Mangler ${missedListen} uger i træk`
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
          {KIND_LABEL[kind]}
        </span>
        <span className="mt-px block text-[12px] font-semibold" style={{ color: "#57635e" }}>
          {status}
        </span>
      </span>
    </button>
  );
}

function HistoryBars({ member, d }: { member: RampTeamMember; d: Derived }) {
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
          const count = (entry?.coaching ? 1 : 0) + (entry?.listen ? 1 : 0);
          const color = entry?.absence
            ? "#e7eeeb"
            : count === 2
              ? GREEN
              : count === 1
                ? AMBER
                : "#e3908b";
          const label = entry?.absence
            ? `Uge ${w.iso_week}: fravær hele ugen`
            : `Uge ${w.iso_week}: ${count} af 2 forløb holdt`;
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

function effectLine(member: RampTeamMember, d: Derived): { text: string; color: string } {
  const coachingWeeks = member.weeks.filter(
    (w) => d.weekActions.get(weekKey(w.iso_year, w.iso_week))?.coaching,
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
}: {
  member: RampTeamMember;
  onOpen: (member: RampTeamMember, kind: SessionKind, done: boolean) => void;
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
              className="text-[16px] font-extrabold"
              style={{ color: band.tone.text, letterSpacing: "-.01em" }}
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
        <WeeklyBars weeks={member.weeks} stripColor={d.stripColor} />

        <div
          className="rounded-[16px] border px-5 py-[18px]"
          style={{ background: "#f6f9f8", borderColor: "#e7eeeb" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Ugens faste forløb</SectionLabel>
            <span
              className="text-[12px] font-extrabold"
              style={{ color: d.doneThisWeek === 2 ? "#0f5a38" : AMBER_TEXT }}
            >
              {d.doneThisWeek === 2 ? "Ugen er klaret" : `${d.doneThisWeek} af 2 holdt`}
            </span>
          </div>

          {member.has_absence ? (
            <p className="mt-3 text-[12px] font-semibold" style={{ color: "#57635e" }}>
              Der er registreret fravær hele ugen — forløbet er ikke krævet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <ProgramRow
                kind="coaching"
                done={member.has_coaching}
                member={member}
                missedListen={d.missedListen}
                onOpen={() => onOpen(member, "coaching", member.has_coaching)}
              />
              <ProgramRow
                kind="listen"
                done={member.has_listen}
                member={member}
                missedListen={d.missedListen}
                onOpen={() => onOpen(member, "listen", member.has_listen)}
              />
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

          {d.feedbackLog.length > 0 && (
            <div className="mt-3 space-y-2">
              <SectionLabel>Sendt feedback</SectionLabel>
              {d.feedbackLog.slice(0, 4).map((a, index) => {
                const { week } = isoWeekOf(new Date(a.performed_at));
                return (
                  <div
                    key={`${a.performed_at}-${index}`}
                    className="rounded-[13px] border bg-white p-3"
                    style={{ borderColor: "#e7eeeb" }}
                  >
                    <p className="text-[12px] font-bold" style={{ color: "#1b1f1d" }}>
                      {a.action_type}
                    </p>
                    <p className="text-[11px] font-semibold" style={{ color: "#57635e" }}>
                      Sendt til {a.recipients.length} · uge {week}
                    </p>
                    <p
                      className="mt-1 whitespace-pre-wrap text-[12px]"
                      style={{ color: "#1b1f1d" }}
                    >
                      {a.note}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function FeedbackDialog({
  member,
  kind,
  alreadyDone,
  onClose,
}: {
  member: RampTeamMember;
  kind: SessionKind;
  alreadyDone: boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const send = useSendRampSessionFeedback();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ready = note.trim().length >= 10;
  const d = derive(member);
  const previous = d.feedbackLog.filter((a) => a.action_type === KIND_ACTION[kind]);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!ready || send.isPending) return;
    send.mutate(
      {
        employeeId: member.employee_id,
        kind,
        note: note.trim(),
        flagId: member.flag_id,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,28,25,.45)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[560px] overflow-hidden rounded-[20px] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5">
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

        <div className="space-y-4 px-5 pb-4">
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
          className="flex flex-wrap items-center justify-between gap-3 p-4"
          style={{ background: "#f6f9f8" }}
        >
          <p className="text-[12px] font-semibold" style={{ color: ready ? "#0f5a38" : AMBER_TEXT }}>
            {ready ? "Sendes til sælgeren og teamets ledere" : "Skriv feedback før du sender"}
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
  const { data: members = [], isLoading } = useRampTeamOverview();
  const { data: stats = [] } = useRampRiskStats();
  const [filter, setFilter] = useState<FilterMode>("danger");
  const [showEvidence, setShowEvidence] = useState(false);
  const [dialog, setDialog] = useState<{
    employeeId: string;
    kind: SessionKind;
    done: boolean;
  } | null>(null);

  const isoWeek = members[0]?.iso_week ?? null;
  const programStart = members[0]?.weekly_program_start_date ?? null;
  const programActive = members[0]?.weekly_program_active ?? false;
  const programStartLabel = programStart
    ? new Date(`${programStart}T00:00:00`).toLocaleDateString("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const dangerList = useMemo(
    () =>
      members
        .filter((m) => m.status === "under")
        .map((m) => ({ member: m, urgency: derive(m).urgency }))
        .sort(
          (a, b) =>
            b.urgency - a.urgency ||
            a.member.employee_name.localeCompare(b.member.employee_name, "da"),
        )
        .map((x) => x.member),
    [members],
  );

  const missingList = useMemo(
    () => dangerList.filter((m) => !m.has_absence && (!m.has_coaching || !m.has_listen)),
    [dangerList],
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

  const dialogMember = dialog ? members.find((m) => m.employee_id === dialog.employeeId) : undefined;

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

  const list = filter === "danger" ? dangerList : missingList;
  const day10 = stats.find((s) => s.day_no === 10);

  return (
    <MainLayout>
      <div className="ramp-page" style={{ background: "#e6efec" }}>
        <div className="mx-auto max-w-[1080px] p-4 sm:p-6" style={{ display: "grid", gap: 18 }}>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1
                className="text-[30px] font-extrabold leading-tight sm:text-[34px]"
                style={{ color: "#1b1f1d", letterSpacing: "-.03em" }}
              >
                Opstartshold
              </h1>
              <p className="mt-1.5 text-[15px] font-semibold" style={{ color: "#57635e" }}>
                Uge {isoWeek ?? "-"} · første 40 arbejdsdage
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
                  { mode: "danger" as FilterMode, label: `Alle i farezonen · ${counts.danger}` },
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
                extra: `${counts.missing} mangler ugens forløb`,
                extraColor: RED_TEXT,
              },
              {
                strip: GREEN,
                label: "Ser godt ud",
                value: counts.good,
                sub: "på eller over typisk",
                extra: "Ingen handling nødvendig",
                extraColor: "#57635e",
              },
              {
                strip: NEUTRAL,
                label: "Stadig undervejs",
                value: counts.pending,
                sub: "mod dag 40",
                extra: "Tælles ikke med endnu",
                extraColor: "#57635e",
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
                <ul className="mt-3 space-y-1 text-[12px]" style={{ color: "#57635e" }}>
                  {stats.map((s) => {
                    const line = formatRiskStatShort(s);
                    return line ? <li key={s.day_no}>{line}</li> : null;
                  })}
                  <li>Lille grundlag — tallene kan flytte sig</li>
                  <li>Gælder grupper, ikke enkeltpersoner</li>
                </ul>
              )}
            </section>
          )}

          <section style={{ display: "grid", gap: 18 }}>
            <div>
              <p className="text-[14px] font-extrabold" style={{ color: "#1b1f1d" }}>
                Under spændet = 1-1 coaching og 1-1 lyt hver uge, indtil de er inde i spændet.
              </p>
              <p className="text-[12px]" style={{ color: "#57635e" }}>
                Sorteret med mest hastende først
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
                    : "Ingen sælgere ligger under spændet lige nu"}
                </p>
                {filter === "missing" && (
                  <button
                    type="button"
                    onClick={() => setFilter("danger")}
                    className="mt-2 text-[12px] font-bold underline"
                    style={{ color: "#0f5a38" }}
                  >
                    Tilbage til alle i farezonen
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
                />
              ))
            )}
          </section>

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
