import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  RAMP_WEEKLY_ABSENCE,
  RAMP_WEEKLY_COACHING,
  RAMP_WEEKLY_LISTEN,
  type RampAction,
  type RampTeamMember,
} from "@/hooks/useRampTeam";
import { weeklyTarget } from "@/lib/rampMinTarget";
import { isoWeekOf, weekdayName, weekRequired } from "@/lib/rampWeek";
import {
  COLOR,
  DARK,
  GREEN,
  MUTED,
  RED,
  STATUS_PILL,
  SalesBar,
  fmtSales,
  restText,
  type BoardItem,
} from "./RampOverviewMatrix";

/** Sidepanel med saelgerkortet. Ren visning af ugemodellen + ugens 1-1. */

const ACTION_LABEL: Record<string, string> = {
  [RAMP_WEEKLY_COACHING]: "1-1 holdt",
  [RAMP_WEEKLY_LISTEN]: "Medlyt holdt (tidligere ordning)",
  [RAMP_WEEKLY_ABSENCE]: "Fravær hele ugen",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(`${d}T00:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "long" });
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-extrabold uppercase" style={{ color: MUTED, letterSpacing: ".12em" }}>
      {children}
    </p>
  );
}

function StartWeeks({ item, targets }: { item: BoardItem; targets: number[] }) {
  const { m } = item;
  const cur = m.week_status;
  const history = [...(m.week_status?.history ?? []), ...(m.last_week_status?.history ?? [])];
  const coachingWeeks = new Set(
    m.actions
      .filter((a) => a.action_type === RAMP_WEEKLY_COACHING)
      .map((a) => {
        const { year, week } = isoWeekOf(new Date(a.performed_at));
        return `${year}-${week}`;
      }),
  );
  const startIsoDay = m.start_date ? new Date(`${m.start_date}T00:00:00`).getDay() || 7 : 1;
  const rows = m.weeks.map((wk) => {
    const isNow = wk.iso_year === m.iso_year && wk.iso_week === m.iso_week;
    const h = history.find((x) => x.iso_year === wk.iso_year && x.iso_week === wk.iso_week);
    const required = isNow && cur
      ? cur.required
      : h
        ? h.required
        : wk.week_no === 1 && startIsoDay > 1 && startIsoDay <= 5
          ? weekRequired(1, 6 - startIsoDay, targets)
          : weeklyTarget(wk.week_no, targets);
    const sales = isNow && cur ? cur.sales_live : wk.sales;
    return { wk, isNow, required, sales, coached: coachingWeeks.has(`${wk.iso_year}-${wk.iso_week}`) };
  });
  return (
    <div className="space-y-2">
      {rows.map(({ wk, isNow, required, sales, coached }) => {
        const pct = Math.min(100, (sales / Math.max(required, 0.0001)) * 100);
        const met = sales >= required;
        return (
          <div key={`${wk.iso_year}-${wk.iso_week}`} className="grid grid-cols-[92px_1fr_auto] items-center gap-3">
            <span className="text-[12px] font-bold" style={{ color: DARK }}>
              Uge {wk.week_no}
              {isNow && (
                <span className="ml-1 rounded-full px-1.5 py-px text-[10px] font-extrabold text-white" style={{ background: DARK }}>
                  nu
                </span>
              )}
            </span>
            <span className="h-2 rounded-full" style={{ background: "#e9eeec" }}>
              <span
                className="block h-full rounded-full"
                style={{ width: `${pct}%`, background: met ? GREEN : isNow ? "#9aa6a1" : "#c9d2ce" }}
              />
            </span>
            <span className="whitespace-nowrap text-[12px] font-bold tabular-nums" style={{ color: MUTED }}>
              {sales} af {fmtSales(required)}
              {coached ? " · 1-1 ✓" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FeedbackList({ actions }: { actions: RampAction[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const list = actions.filter((a) => a.note && a.note.trim().length > 0).slice(0, 3);
  if (list.length === 0)
    return (
      <p className="text-[13px] font-semibold" style={{ color: MUTED }}>
        Ingen feedback sendt endnu.
      </p>
    );
  return (
    <div className="space-y-2">
      {list.map((a, i) => {
        const { week } = isoWeekOf(new Date(a.performed_at));
        const focus = a.focus_area?.trim();
        return (
          <button
            key={`${a.performed_at}-${i}`}
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="block w-full rounded-[13px] border bg-white p-3 text-left"
            style={{ borderColor: "#e7eeeb" }}
          >
            <span className="block text-[13px] font-extrabold" style={{ color: DARK }}>
              Uge {week}
              {focus ? ` · fokus: ${focus}` : ""}
            </span>
            <span className="block text-[12px] font-semibold" style={{ color: MUTED }}>
              {ACTION_LABEL[a.action_type] ?? "Registrering"} {weekdayName(a.performed_at)} · sendt til sælger og teamets ledere
            </span>
            {open === i && (
              <span className="mt-2 block whitespace-pre-wrap text-[12px]" style={{ color: DARK }}>
                {a.note}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function RampSellerPanel({
  item,
  monday,
  discreet,
  targets,
  onClose,
  onHold,
  onAbsence,
  onExclude,
}: {
  item: BoardItem | null;
  monday: boolean;
  discreet: boolean;
  targets: number[];
  onClose: () => void;
  onHold: (m: RampTeamMember, done: boolean) => void;
  onAbsence: (m: RampTeamMember) => void;
  onExclude: (m: RampTeamMember) => void;
}) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
        {item && <PanelBody item={item} monday={monday} discreet={discreet} targets={targets} onHold={onHold} onAbsence={onAbsence} onExclude={onExclude} />}
      </SheetContent>
    </Sheet>
  );
}

function PanelBody({
  item,
  monday,
  discreet,
  targets,
  onHold,
  onAbsence,
  onExclude,
}: {
  item: BoardItem;
  monday: boolean;
  discreet: boolean;
  targets: number[];
  onHold: (m: RampTeamMember, done: boolean) => void;
  onAbsence: (m: RampTeamMember) => void;
  onExclude: (m: RampTeamMember) => void;
}) {
  const { m, w, g, one } = item;
  const startWeek = m.week_status?.start_week;
  const sub = [m.campaign_name, startWeek ? `opstartsuge ${startWeek}` : null, m.start_date ? `startet ${fmtDate(m.start_date)}` : null]
    .filter(Boolean)
    .join(" · ");
  const rest = w && g ? restText(w, g, monday) : null;

  return (
    <div className="space-y-6 pb-6">
      <SheetHeader className="text-left">
        <SheetTitle className="text-[24px] font-extrabold" style={{ color: DARK }}>
          {m.employee_name}
        </SheetTitle>
        <SheetDescription className="text-[13px] font-semibold" style={{ color: MUTED }}>
          {sub}
        </SheetDescription>
        {!discreet && g && (
          <span
            className="mt-2 inline-block w-fit rounded-full px-3 py-1 text-[12px] font-extrabold"
            style={{ background: g === "start" ? RED : "#ffffff", color: g === "start" ? "#ffffff" : COLOR[g], border: `2px solid ${COLOR[g]}` }}
          >
            {STATUS_PILL[g]}
          </span>
        )}
      </SheetHeader>

      {!discreet && (
        <section className="space-y-2">
          <Label>{monday ? "Sidste uge · slutresultat" : "Denne uge"}</Label>
          {w && g ? (
            <>
              <SalesBar w={w} g={g} monday={monday} />
              {rest && (
                <p className="text-[13px] font-bold" style={{ color: rest.color }}>
                  {rest.main}
                  <span style={{ color: MUTED }}>
                    {" · "}
                    {monday ? rest.sub : g === "track" ? rest.sub : `${rest.sub.split(" · ")[0]} resten af ugen`}
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] font-semibold" style={{ color: MUTED }}>
              Første status kommer i morgen.
            </p>
          )}
        </section>
      )}

      {!discreet && m.weeks.length > 0 && (
        <section className="space-y-2">
          <Label>Uger i opstart</Label>
          <StartWeeks item={item} targets={targets} />
        </section>
      )}

      <section className="space-y-3 rounded-[16px] border p-4" style={{ background: "#f6f9f8", borderColor: "#e7eeeb" }}>
        <div className="flex items-center justify-between gap-2">
          <Label>Ugens 1-1</Label>
          <span
            className="text-[13px] font-extrabold"
            style={{ color: one.kind === "held" ? GREEN : one.kind === "missing" ? RED : MUTED }}
          >
            {one.kind === "held"
              ? `✓ Holdt ${one.weekday}`
              : one.kind === "missing"
                ? "Mangler · frist fredag kl. 8"
                : one.kind === "absence"
                  ? "Fravær hele ugen"
                  : "Ikke krævet denne uge"}
          </span>
        </div>
        {one.kind !== "absence" && (
          <button
            type="button"
            onClick={() => onHold(m, one.kind === "held")}
            className="w-full rounded-full px-4 py-3 text-[14px] font-extrabold text-white"
            style={{ background: one.kind === "held" ? GREEN : DARK }}
          >
            {one.kind === "held" ? "Tilføj ekstra 1-1" : "Hold 1-1 og send feedback"}
          </button>
        )}
        {one.kind !== "held" && one.kind !== "absence" && (
          <button type="button" onClick={() => onAbsence(m)} className="text-[12px] font-semibold underline" style={{ color: MUTED }}>
            Registrér fravær hele ugen
          </button>
        )}
      </section>

      <section className="space-y-2">
        <Label>Seneste feedback</Label>
        <FeedbackList actions={m.actions} />
      </section>

      <button type="button" onClick={() => onExclude(m)} className="text-[12px] font-semibold underline" style={{ color: "#8b958f" }}>
        Skal ikke have feedback
      </button>
    </div>
  );
}
