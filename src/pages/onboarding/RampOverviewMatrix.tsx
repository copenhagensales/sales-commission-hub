import { RAMP_WEEKLY_COACHING, type RampTeamMember } from "@/hooks/useRampTeam";
import { useEffect, useState, type ReactNode } from "react";
import { weeklyTarget } from "@/lib/rampMinTarget";
import {
  isoWeekOf,
  restOfWeek,
  weekdayName,
  WEEKDAY_NAME,
  type RampWeekStatus,
} from "@/lib/rampWeek";

/**
 * Ugetavle, graf og tal-knapper: ren visning af ugemodellen fra
 * get_ramp_team_overview (beregnet i databasen af ramp_week_status).
 * Mandag vises sidste uges slutresultat (last_week_status). Ingen ny beregning.
 */

export type SupportGroup = "start" | "hold" | "track";
export type BoardFilter = SupportGroup | "missing";
export type Trend = "up" | "down" | "flat" | "unknown";

export function groupOf(w: RampWeekStatus | null | undefined): SupportGroup | null {
  switch (w?.status) {
    case "start_her":
      return "start";
    case "hold_fast":
      return "hold";
    case "paa_sporet":
      return "track";
    default:
      return null;
  }
}

export function supportGroup(member: { week_status?: RampWeekStatus | null }): SupportGroup | null {
  return groupOf(member.week_status);
}

/** Ugens tempo mod sidste uges resultat. Kun til tekster; status afgøres i databasen. */
export function expectationTrend(member: { week_status?: RampWeekStatus | null }): Trend {
  const w = member.week_status;
  if (!w || w.pace_ratio == null || w.prev_ratio == null) return "unknown";
  const diff = w.pace_ratio - w.prev_ratio;
  return diff > 1e-9 ? "up" : diff < -1e-9 ? "down" : "flat";
}

/** Formaterer et salgstal med hoejst én decimal (dansk komma). */
export function fmtSales(v: number): string {
  const r = Math.round(v * 10) / 10;
  return String(r).replace(".", ",");
}

/** Hele salg der mangler for at naa "forventet nu" i denne uge. */
export function missingSales(m: { week_status?: RampWeekStatus | null }): number {
  const w = m.week_status;
  if (!w || w.status === "ny_uge") return 0;
  return Math.max(0, Math.ceil(w.expected_now - w.sales - 1e-9));
}

export const RED = "#c13b32";
export const YELLOW = "#d9a21b";
export const YELLOW_TEXT = "#7a5508";
export const GREEN = "#177a4d";
export const DARK = "#1b1f1d";
export const MUTED = "#57635e";
export const COLOR: Record<SupportGroup, string> = { start: RED, hold: YELLOW, track: GREEN };
const PENDING_COLOR = "#b9c4bf";

export const GROUP_TITLE: Record<SupportGroup, string> = {
  start: "Start her",
  hold: "Hold fast",
  track: "På sporet",
};

export const STATUS_PILL: Record<SupportGroup, string> = {
  start: "Start her · bagud i denne uge",
  hold: "Hold fast · bedre end sidste uge",
  track: "På sporet",
};

// ---------- Ugens 1-1 (altid den indevaerende uge) ----------

export type OneOnOne =
  | { kind: "held"; weekday: string }
  | { kind: "missing" }
  | { kind: "absence" }
  | { kind: "not_required" };

/** Kun 1-1 (coaching) tæller som ugens 1-1. */
export function oneOnOneOf(
  m: Pick<RampTeamMember, "has_coaching" | "actions" | "iso_year" | "iso_week" | "has_absence" | "week_required">,
  absencePending = false,
): OneOnOne {
  if (m.has_coaching) {
    const a = m.actions.find((x) => {
      if (x.action_type !== RAMP_WEEKLY_COACHING) return false;
      const { year, week } = isoWeekOf(new Date(x.performed_at));
      return year === m.iso_year && week === m.iso_week;
    });
    return { kind: "held", weekday: a ? weekdayName(a.performed_at) : "" };
  }
  if (m.has_absence || absencePending) return { kind: "absence" };
  if (!m.week_required) return { kind: "not_required" };
  return { kind: "missing" };
}

export interface BoardItem {
  m: RampTeamMember;
  /** Den viste uge (denne uge, eller sidste uge om mandagen). */
  w: RampWeekStatus | null;
  g: SupportGroup | null;
  one: OneOnOne;
}

// ---------- Tal-knapper ----------

export function RampKpiFilters({
  counts,
  missing,
  held,
  required,
  active,
  onSelect,
  discreet,
}: {
  counts: Record<SupportGroup, number>;
  missing: number;
  held: number;
  required: number;
  active: BoardFilter | null;
  onSelect: (f: BoardFilter) => void;
  discreet: boolean;
}) {
  const cards: { f: BoardFilter; title: string; rule: string; text: string; n: number | string }[] = [
    { f: "start", title: "Start her", rule: "Bagud · ikke flere salg pr. dag end sidste uge", text: "Giv dem mest tid denne uge", n: discreet ? "–" : counts.start },
    { f: "hold", title: "Hold fast", rule: "Bagud · men flere salg pr. dag end sidste uge", text: "Anerkend fremgangen", n: discreet ? "–" : counts.hold },
    { f: "track", title: "På sporet", rule: "På eller foran ugens tempo", text: "Brug dem som makker", n: discreet ? "–" : counts.track },
    { f: "missing", title: "Mangler ugens 1-1", rule: "Frist fredag kl. 8", text: `${held} af ${required} holdt`, n: missing },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const isActive = active === c.f;
        const filled = c.f === "start";
        const accent = c.f === "start" ? "#ffffff" : c.f === "hold" ? YELLOW_TEXT : c.f === "track" ? GREEN : DARK;
        return (
          <button
            key={c.f}
            type="button"
            aria-pressed={isActive}
            data-kpi={c.f}
            onClick={() => onSelect(c.f)}
            className="flex items-center gap-3.5 rounded-[18px] border-2 px-4 py-4 text-left transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,.08)]"
            style={{
              background: filled ? RED : "#ffffff",
              color: filled ? "#ffffff" : DARK,
              borderColor: isActive ? DARK : c.f === "missing" ? DARK : "transparent",
              boxShadow: isActive ? `0 0 0 2px ${filled ? DARK : "#ffffff"} inset` : undefined,
              opacity: active && !isActive ? 0.6 : 1,
            }}
          >
            <span className="text-[44px] font-extrabold leading-none tabular-nums" style={{ color: accent, letterSpacing: "-.04em" }}>
              {c.n}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".08em", color: accent }}>
                {c.title}
              </span>
              <span className="mt-0.5 block text-[13px] font-extrabold">{c.rule}</span>
              <span className="block text-[12px] font-semibold" style={{ opacity: filled ? 0.92 : 0.75 }}>
                {c.text}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Celler ----------

function SellerCell({ m, w, discreet }: { m: RampTeamMember; w: RampWeekStatus | null; discreet: boolean }) {
  const sub = discreet || !w
    ? m.team_name ?? m.campaign_name ?? ""
    : w.partial_start
      ? `Startet ${WEEKDAY_NAME[w.start_weekday]} · ${w.workdays} dage · krav ${fmtSales(w.required)} af ${fmtSales(w.week_target)}`
      : `Opstartsuge ${w.start_week} · krav ${fmtSales(w.required)}`;
  return (
    <div className="min-w-0">
      <p className="truncate text-[15px] font-extrabold" style={{ color: DARK }}>
        {m.employee_name}
      </p>
      <p className="text-[12px] font-semibold" style={{ color: MUTED }}>
        {sub}
      </p>
    </div>
  );
}

export function SalesBar({ w, g, monday }: { w: RampWeekStatus; g: SupportGroup | null; monday: boolean }) {
  const sales = monday ? w.sales : w.sales_live;
  const max = Math.max(w.required, sales, 0.0001);
  const fill = Math.min(100, (sales / max) * 100);
  const marker = Math.min(100, (w.expected_now / max) * 100);
  return (
    <div className="min-w-[200px]">
      <div className="flex items-baseline justify-between gap-3 text-[13px] font-bold">
        <span style={{ color: DARK }}>
          {sales} af {fmtSales(w.required)} salg
        </span>
        <span style={{ color: MUTED }}>
          {monday ? "slutresultat" : `burde have ${fmtSales(w.expected_now)} nu`}
        </span>
      </div>
      <div className="relative mt-1.5 h-2.5 rounded-full" style={{ background: "#e9eeec" }}>
        <div className="h-full rounded-full" style={{ width: `${fill}%`, background: g ? COLOR[g] : PENDING_COLOR }} />
        <span
          aria-hidden
          className="absolute -top-1 h-[18px] w-[3px] rounded"
          style={{ left: `calc(${marker}% - 1.5px)`, background: DARK }}
        />
      </div>
    </div>
  );
}

/** Tekst om resten af ugen. Bruges i tavlen og i sidepanelet. */
export function restText(w: RampWeekStatus, g: SupportGroup | null, monday: boolean): { main: string; sub: string; color: string } {
  if (monday) {
    const miss = Math.max(0, w.required - w.sales);
    return {
      main: miss > 0 ? `Manglede ${fmtSales(miss)}` : "Ugens krav nået",
      sub: "sidste uge",
      color: miss > 0 ? (g === "start" ? RED : YELLOW_TEXT) : GREEN,
    };
  }
  const rest = restOfWeek(w);
  if (g === "track") {
    const ahead = w.sales - w.expected_now;
    const toGo = Math.max(0, w.required - w.sales_live);
    return {
      main: ahead > 1e-9 ? `${fmtSales(ahead)} foran tempo` : "På tempo",
      sub: toGo > 0 ? `${fmtSales(toGo)} til ugens krav` : "Ugens krav er nået",
      color: GREEN,
    };
  }
  return {
    main: `Mangler ${fmtSales(rest.missing)}`,
    sub: `${fmtSales(rest.perDay)} salg pr. dag${g === "hold" ? " · bedre end sidste uge" : ""}`,
    color: g === "start" ? RED : YELLOW_TEXT,
  };
}

function RestCell({ w, g, monday }: { w: RampWeekStatus; g: SupportGroup | null; monday: boolean }) {
  const t = restText(w, g, monday);
  return (
    <div className="text-[13px] font-bold">
      <p style={{ color: t.color }}>{t.main}</p>
      <p style={{ color: MUTED }}>{t.sub}</p>
    </div>
  );
}

function HistoryCell({ w }: { w: RampWeekStatus }) {
  if (w.history.length === 0)
    return (
      <span className="text-[12px] font-bold" style={{ color: MUTED }}>
        Ny
      </span>
    );
  return (
    <div className="flex gap-1">
      {w.history.map((h) => (
        <span
          key={`${h.iso_year}-${h.iso_week}`}
          title={`Uge ${h.iso_week}: ${h.met ? "opfyldt" : "ikke opfyldt"} (${h.sales} af ${fmtSales(h.required)})`}
          aria-label={`Uge ${h.iso_week}: ${h.met ? "opfyldt" : "ikke opfyldt"}`}
          className="inline-block h-4 w-4 rounded-[4px] border-2"
          style={{ background: h.met ? GREEN : "transparent", borderColor: h.met ? GREEN : "#c9d2ce" }}
        />
      ))}
    </div>
  );
}

export function OneOnOneCell({ one, onHold }: { one: OneOnOne; onHold: () => void }) {
  if (one.kind === "held")
    return (
      <span className="whitespace-nowrap text-[13px] font-extrabold" style={{ color: GREEN }} data-one="held">
        ✓ Holdt {one.weekday}
      </span>
    );
  if (one.kind === "absence")
    return (
      <span className="text-[13px] font-bold" style={{ color: MUTED }} data-one="absence">
        Fravær
      </span>
    );
  if (one.kind === "not_required")
    return (
      <span className="text-[13px] font-bold" style={{ color: MUTED }} data-one="not_required">
        Ikke krævet
      </span>
    );
  return (
    <button
      type="button"
      data-one="missing"
      onClick={(e) => {
        e.stopPropagation();
        onHold();
      }}
      className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-extrabold text-white"
      style={{ background: DARK }}
    >
      Hold 1-1
    </button>
  );
}

// ---------- Graf ----------

const CHART_WEEKS = 8;
const PACE_MAX = 2;

interface ChartDot {
  item: BoardItem;
  w: RampWeekStatus;
  g: SupportGroup;
  col: number;
  pace: number;
  x: number;
  y: number;
}

export function WeekOverviewChart({
  items,
  targets,
  emptyText,
  onSelect,
}: {
  items: BoardItem[];
  targets: number[];
  emptyText: string | null;
  onSelect: (employeeId: string, g: SupportGroup) => void;
}) {
  const W = 960;
  const H = 400;
  const padL = 56;
  const padR = 96;
  const padT = 18;
  const padB = 64;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const colW = plotW / CHART_WEEKS;
  const yOf = (p: number) => padT + plotH - (Math.min(p, PACE_MAX) / PACE_MAX) * plotH;
  const R = 8;

  const dots: ChartDot[] = [];
  for (const item of items) {
    const { w, g } = item;
    if (!g || !w || w.expected_now <= 0) continue;
    const col = Math.min(Math.max(1, w.start_week), CHART_WEEKS) - 1;
    dots.push({ item, w, g, col, pace: w.sales / w.expected_now, x: 0, y: 0 });
  }
  for (let c = 0; c < CHART_WEEKS; c++) {
    const center = padL + colW * c + colW / 2;
    const placed: ChartDot[] = [];
    const inCol = dots.filter((d) => d.col === c).sort((a, b) => a.pace - b.pace);
    for (const d of inCol) {
      d.y = yOf(d.pace);
      const offsets = [0];
      for (let k = 1; k < 20; k++) offsets.push(k * (R + 1), -k * (R + 1));
      const limit = colW / 2 - R - 2;
      let best = 0;
      for (const o of offsets) {
        if (Math.abs(o) > limit) continue;
        best = o;
        if (placed.every((p) => Math.hypot(p.x - (center + o), p.y - d.y) >= 2 * R + 2)) break;
      }
      d.x = center + best;
      placed.push(d);
    }
  }
  const labels: { d: ChartDot; ly: number; lx: number }[] = [];
  for (let c = 0; c < CHART_WEEKS; c++) {
    const colDots = dots.filter((d) => d.col === c);
    const lx = colDots.length ? Math.max(...colDots.map((d) => d.x)) + R + 6 : 0;
    const ls = colDots
      .filter((d) => d.g === "start")
      .sort((a, b) => a.y - b.y)
      .map((d) => ({ d, ly: d.y, lx }));
    for (let i = 1; i < ls.length; i++) ls[i].ly = Math.max(ls[i].ly, ls[i - 1].ly + 15);
    const overflow = ls.length ? ls[ls.length - 1].ly - (padT + plotH - 4) : 0;
    if (overflow > 0) ls.forEach((l) => (l.ly -= overflow));
    labels.push(...ls);
  }

  const tip = (d: ChartDot) => {
    const base = `${d.item.m.employee_name} · opstartsuge ${d.w.start_week} · ${d.w.sales} af ${fmtSales(d.w.required)} salg · burde have ${fmtSales(d.w.expected_now)} nu (${Math.round(d.pace * 100)} %)`;
    return d.w.partial_start
      ? `${base}\nStartet ${WEEKDAY_NAME[d.w.start_weekday]} · krav ${fmtSales(d.w.required)} af ${fmtSales(d.w.week_target)}`
      : base;
  };

  if (emptyText)
    return (
      <p className="py-6 text-[15px] font-bold" style={{ color: MUTED }}>
        {emptyText}
      </p>
    );

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[720px]" role="img" aria-label="Overblik: hvem ligger hvor?">
        <rect x={padL} y={padT} width={plotW} height={yOf(1) - padT} fill={GREEN} opacity={0.07} />
        <rect x={padL} y={yOf(1)} width={plotW} height={padT + plotH - yOf(1)} fill={RED} opacity={0.07} />
        <text x={padL + 8} y={padT + 16} fontSize={11} fontWeight={800} fill={GREEN} letterSpacing=".08em">
          FORAN TEMPO
        </text>
        <text x={padL + 8} y={padT + plotH - 8} fontSize={11} fontWeight={800} fill={RED} letterSpacing=".08em">
          BAGUD I DENNE UGE
        </text>
        {[0, 0.5, 1, 1.5, 2].map((p) => (
          <text key={p} x={padL - 8} y={yOf(p) + 4} fontSize={12} fontWeight={700} fill={MUTED} textAnchor="end">
            {p === 2 ? "200 %+" : `${p * 100} %`}
          </text>
        ))}
        {Array.from({ length: CHART_WEEKS }, (_, c) => (
          <g key={c}>
            {c > 0 && <line x1={padL + colW * c} x2={padL + colW * c} y1={padT} y2={padT + plotH} stroke="#e3e9e6" />}
            <text x={padL + colW * c + colW / 2} y={padT + plotH + 20} fontSize={12} fontWeight={800} fill={DARK} textAnchor="middle">
              Uge {c + 1}
            </text>
            <text x={padL + colW * c + colW / 2} y={padT + plotH + 36} fontSize={12} fontWeight={600} fill={MUTED} textAnchor="middle">
              {fmtSales(weeklyTarget(c + 1, targets))} salg
            </text>
          </g>
        ))}
        <text x={padL + plotW / 2} y={H - 6} fontSize={11} fontWeight={700} fill={MUTED} textAnchor="middle">
          Opstartsuge · krav pr. uge
        </text>
        <line x1={padL} x2={padL + plotW} y1={yOf(1)} y2={yOf(1)} stroke={DARK} strokeWidth={2} />
        <rect x={padL + plotW + 4} y={yOf(1) - 10} width={88} height={20} rx={6} fill={DARK} />
        <text x={padL + plotW + 48} y={yOf(1) + 4} fontSize={11} fontWeight={800} fill="#ffffff" textAnchor="middle">
          Ugens tempo
        </text>
        {dots.map((d) => (
          <g key={d.item.m.employee_id} className="cursor-pointer" onClick={() => onSelect(d.item.m.employee_id, d.g)} data-group={d.g}>
            <title>{tip(d)}</title>
            {d.g === "start" && <circle cx={d.x} cy={d.y} r={R} fill={RED} stroke="#ffffff" strokeWidth={2} />}
            {d.g === "hold" && <circle cx={d.x} cy={d.y} r={R - 1} fill="#ffffff" stroke={YELLOW} strokeWidth={3} />}
            {d.g === "track" && <circle cx={d.x} cy={d.y} r={R - 1} fill="#d6efe2" stroke={GREEN} strokeWidth={3} />}
          </g>
        ))}
        {labels.map(({ d, ly, lx }) => (
          <g key={`l-${d.item.m.employee_id}`}>
            {(lx - d.x > R + 8 || Math.abs(ly - d.y) > 2) && (
              <line x1={d.x} y1={d.y} x2={lx - 2} y2={ly} stroke={RED} strokeOpacity={0.35} strokeWidth={1} />
            )}
            <text
              x={lx}
              y={ly + 4}
              fontSize={11}
              fontWeight={800}
              fill={RED}
              className="cursor-pointer"
              onClick={() => onSelect(d.item.m.employee_id, d.g)}
            >
              {d.item.m.employee_name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------- Ugetavle ----------

const PREVIEW = 3;
type GroupKey = SupportGroup | "pending";
const GROUP_ORDER: GroupKey[] = ["start", "hold", "track", "pending"];

export function RampWeekBoard({
  items,
  activeFilter,
  discreet,
  monday,
  focusId,
  onRowClick,
  onHold,
  aboutButton,
  footer,
}: {
  items: BoardItem[];
  activeFilter: BoardFilter | null;
  discreet: boolean;
  monday: boolean;
  /** Saelger der skal scrolles frem og fremhaeves (klik i grafen). */
  focusId: { id: string; nonce: number } | null;
  onRowClick: (m: RampTeamMember) => void;
  onHold: (m: RampTeamMember) => void;
  aboutButton?: ReactNode;
  footer?: ReactNode;
}) {
  const [expanded, setExpanded] = useState<Record<GroupKey, boolean>>({ start: true, hold: false, track: false, pending: false });
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!focusId) return;
    const it = items.find((i) => i.m.employee_id === focusId.id);
    if (it) setExpanded((e) => ({ ...e, [it.g ?? "pending"]: true }));
    setFlash(focusId.id);
    const t1 = window.setTimeout(() => {
      document.getElementById(`ramp-row-${focusId.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const t2 = window.setTimeout(() => setFlash(null), 2200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const visible = items.filter((i) =>
    !activeFilter ? true : activeFilter === "missing" ? i.one.kind === "missing" : i.g === activeFilter,
  );

  const groups = discreet
    ? [{ key: "pending" as GroupKey, rows: [...visible].sort((a, b) => a.m.employee_name.localeCompare(b.m.employee_name, "da")) }]
    : GROUP_ORDER.map((key) => ({
        key,
        rows: visible
          .filter((i) => (i.g ?? "pending") === key)
          .sort((a, b) => Number(a.w?.pace_ratio ?? 0) - Number(b.w?.pace_ratio ?? 0)),
      })).filter((gr) => gr.key !== "pending" || gr.rows.length > 0);

  const cols = discreet ? 2 : 5;

  return (
    <section className="rounded-[20px] bg-white p-5 sm:p-7" style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }} aria-label="Ugetavle">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-bold" style={{ color: MUTED }}>
        {!discreet && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-8 rounded-full" style={{ background: "#e9eeec" }} />
              Hele baren = ugens krav
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-[3px] rounded" style={{ background: DARK }} />
              Hvor man burde være nu
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-[4px]" style={{ background: GREEN }} />
              Uge opfyldt
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-[4px] border-2" style={{ borderColor: "#c9d2ce" }} />
              Ikke opfyldt
            </span>
          </>
        )}
        {aboutButton && <span className="ml-auto">{aboutButton}</span>}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-[15px] font-bold" style={{ color: MUTED }}>
          {activeFilter === "missing" ? "Alle har fået ugens 1-1." : "Ingen sælgere at vise."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className={`w-full border-separate ${discreet ? "min-w-[420px]" : "min-w-[900px]"}`} style={{ borderSpacing: "0 6px" }}>
            <thead>
              <tr className="text-left text-[11px] font-extrabold uppercase" style={{ color: MUTED, letterSpacing: ".08em" }}>
                <th className="px-3 py-1">Sælger</th>
                {!discreet && <th className="px-3 py-1">{monday ? "Sidste uges salg mod krav" : "Ugens salg mod krav"}</th>}
                {!discreet && <th className="px-3 py-1">Resten af ugen</th>}
                <th className="px-3 py-1">Ugens 1-1</th>
                {!discreet && <th className="px-3 py-1">Sidste uger</th>}
              </tr>
            </thead>
            {groups.map(({ key, rows }) => {
              const open = discreet || key === "start" || expanded[key];
              const shown = open ? rows : rows.slice(0, PREVIEW);
              const color = key === "pending" ? MUTED : COLOR[key];
              return (
                <tbody key={key} data-board-group={discreet ? "all" : key}>
                  {!discreet && (
                    <tr>
                      <td colSpan={cols} className="px-3 pt-3 text-[12px] font-extrabold uppercase" style={{ color, letterSpacing: ".1em" }}>
                        {key === "pending" ? "Afventer status" : GROUP_TITLE[key]} · {rows.length}
                      </td>
                    </tr>
                  )}
                  {shown.map(({ m, w, g, one }) => (
                    <tr
                      key={m.employee_id}
                      id={`ramp-row-${m.employee_id}`}
                      data-row-group={g ?? "pending"}
                      onClick={() => onRowClick(m)}
                      className="cursor-pointer"
                      style={{
                        background: flash === m.employee_id ? "#fff6d6" : "#f6f8f7",
                        outline: flash === m.employee_id ? `2px solid ${DARK}` : "2px solid transparent",
                      }}
                    >
                      <td className="rounded-l-[12px] border-l-4 px-3 py-2.5" style={{ borderColor: discreet ? "#d7e0dc" : g ? COLOR[g] : PENDING_COLOR }}>
                        <SellerCell m={m} w={w} discreet={discreet} />
                      </td>
                      {!discreet && (
                        <td className="px-3 py-2.5">
                          {w && g ? (
                            <SalesBar w={w} g={g} monday={monday} />
                          ) : (
                            <span className="text-[13px] font-bold" style={{ color: MUTED }}>
                              {w ? `${w.sales_live} salg indtil nu` : "Første status kommer i morgen"}
                            </span>
                          )}
                        </td>
                      )}
                      {!discreet && <td className="px-3 py-2.5">{w && g ? <RestCell w={w} g={g} monday={monday} /> : null}</td>}
                      <td className={`px-3 py-2.5 ${discreet ? "rounded-r-[12px]" : ""}`}>
                        <OneOnOneCell one={one} onHold={() => onHold(m)} />
                      </td>
                      {!discreet && <td className="rounded-r-[12px] px-3 py-2.5">{w ? <HistoryCell w={w} /> : null}</td>}
                    </tr>
                  ))}
                  {!open && rows.length > PREVIEW && (
                    <tr>
                      <td colSpan={cols} className="px-3">
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ ...e, [key]: true }))}
                          className="whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold"
                          style={{ background: "#f1f4f3", color: DARK }}
                        >
                          Vis {rows.length - PREVIEW} flere
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {footer && <div className="mt-4">{footer}</div>}
      <p className="mt-3 text-[12px] font-semibold" style={{ color: MUTED }}>
        Status måles kun på den indeværende kalenderuge (mandag–fredag), til og med i går. Tidligere uger påvirker
        ikke status. De vises kun som historik. Starter man midt i en uge, gælder kravet forholdsmæssigt for de dage,
        der er tilbage. Helligdage trækkes fra. Mandag vises sidste uges slutresultat, og ny status kommer tirsdag
        morgen. Ugens 1-1 skal holdes inden fredag kl. 8.
      </p>
    </section>
  );
}
