import type { RampTeamMember } from "@/hooks/useRampTeam";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_WEEKLY_MIN_TARGETS, weeklyTarget } from "@/lib/rampMinTarget";

/**
 * Overblik: hvem ligger hvor? Ren visning af data fra get_ramp_team_overview.
 * Maalestokken er forventningen (minimumskrav pr. opstartsuge fordelt pr.
 * arbejdsdag, beregnet i databasen af ramp_expected_at). expectation_status
 * "under" = under 100 %, "on_track" = paa eller over. "ukendt" vises ikke.
 */

export type SupportGroup = "start" | "hold" | "track";
export type Trend = "up" | "down" | "flat" | "unknown";

export function supportGroup(member: RampTeamMember, trend: Trend): SupportGroup | null {
  if (member.expectation_status === "under") return trend === "up" ? "hold" : "start";
  if (member.expectation_status === "on_track") return "track";
  return null;
}

/** Salg i ugen ift. ugens forventning, seneste uge mod ugen foer. */
export function expectationTrend(member: { weeks: { sales: number; expected?: number | null }[] }): Trend {
  const w = member.weeks.filter((x) => Number(x.expected ?? 0) > 0);
  if (w.length < 2) return "unknown";
  const a = w[w.length - 2];
  const b = w[w.length - 1];
  const diff = b.sales / Number(b.expected) - a.sales / Number(a.expected);
  return diff > 1e-9 ? "up" : diff < -1e-9 ? "down" : "flat";
}

/** Formaterer et salgstal med hoejst én decimal (dansk komma). */
export function fmtSales(v: number): string {
  const r = Math.round(v * 10) / 10;
  return String(r).replace(".", ",");
}

/** Hvor mange hele salg der mangler for at naa forventningen i dag. */
export function missingSales(m: { cum_sales: number; expected_today?: number | null }): number {
  return Math.max(0, Math.ceil(Number(m.expected_today ?? 0) - m.cum_sales - 1e-9));
}

const RED = "#c13b32";
const YELLOW = "#d9a21b";
const YELLOW_TEXT = "#7a5508";
const YELLOW_LIGHT = "#fbefcc";
const GREEN = "#177a4d";
const GREEN_LIGHT = "#d9f0e3";
const DARK = "#1b1f1d";
const Y_MAX = 2;
const DAYS = 40;
const WEEK_DAYS = 5;

const GROUP_INFO: Record<
  SupportGroup,
  { no: number; title: string; rule: string; text: string }
> = {
  start: {
    no: 1,
    title: "Start her",
    rule: "Under forventning og flad/faldende",
    text: "Størst risiko for at de stopper. 1-1 og medlyt denne uge.",
  },
  hold: {
    no: 2,
    title: "Hold fast",
    rule: "Under forventning, men stigende",
    text: "På vej. Anerkend fremgangen, og hold rytmen.",
  },
  track: {
    no: 3,
    title: "På sporet",
    rule: "På eller over forventning",
    text: "Ugens faste 1-1 — og brug dem som makker for nr. 1.",
  },
};

const STATUS_LABEL: Record<SupportGroup, string> = {
  start: "Ekstra støtte",
  hold: "Ekstra støtte",
  track: "På sporet",
};
const TREND_LABEL: Record<Trend, string> = {
  up: "stigende",
  down: "faldende",
  flat: "flad",
  unknown: "ingen trend endnu",
};

function formatShort(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pctOf(m: RampTeamMember): number {
  return Number(m.expected_pct ?? 0);
}

export function RampOverviewMatrix({
  members,
  trendOf,
  counts,
  activeGroup,
  onSelectGroup,
  onSelectMember,
  minTargets = DEFAULT_WEEKLY_MIN_TARGETS,
  footer,
}: {
  members: RampTeamMember[];
  trendOf: (m: RampTeamMember) => Trend;
  counts: Record<SupportGroup, number>;
  activeGroup: SupportGroup | null;
  onSelectGroup: (g: SupportGroup) => void;
  onSelectMember: (employeeId: string) => void;
  minTargets?: number[];
  footer?: ReactNode;
}) {
  const [showBand, setShowBand] = useState(false);
  const points = members
    .map((m) => {
      const trend = trendOf(m);
      const group = supportGroup(m, trend);
      if (!group) return null;
      return { m, trend, group, y: Math.min(Y_MAX, Math.max(0, pctOf(m) / 100)) };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Hold: arbejdsdage med 2+ saelgere (etiket over grafen).
  const cohortsRaw = useMemo(() => {
    const byDay = new Map<number, number>();
    points.forEach((p) => byDay.set(p.m.day_no, (byDay.get(p.m.day_no) ?? 0) + 1));
    return [...byDay.entries()].filter(([, n]) => n >= 2).sort((a, b) => a[0] - b[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.m.day_no).join(",")]);

  const H = 480;
  const PAD = { l: 52, r: 92, t: 46, b: 70 };
  const R = 9;
  const GAP = 4;
  const plotW = width - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const ys = (v: number) => PAD.t + plotH - (Math.min(Y_MAX, Math.max(0, v)) / Y_MAX) * plotH;
  const xs = (d: number) => PAD.l + ((Math.min(DAYS, Math.max(1, d)) - 0.5) / DAYS) * plotW;
  const xEdge = (d: number) => PAD.l + (d / DAYS) * plotW; // d = antal dage efter venstre kant

  // Beeswarm: y er fast, kun x flyttes mindst muligt indtil ingen overlap.
  const placed = useMemo(() => {
    const out: { p: (typeof points)[number]; x: number; y: number }[] = [];
    const minD = 2 * R + GAP;
    const sorted = [...points].sort((a, b) => a.m.day_no - b.m.day_no || a.y - b.y);
    for (const p of sorted) {
      const y = ys(p.y);
      const x0 = xs(p.m.day_no);
      let x = x0;
      for (let k = 0; k < 2000; k++) {
        const off = Math.ceil(k / 2) * (k % 2 ? 1 : -1);
        const cx = Math.min(width - PAD.r - R, Math.max(PAD.l + R, x0 + off));
        if (out.every((o) => Math.hypot(o.x - cx, o.y - y) >= minD)) {
          x = cx;
          break;
        }
      }
      out.push({ p, x, y });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => `${p.m.employee_id}:${p.y}:${p.m.day_no}`).join("|"), width]);

  // Labels kun for "Start her", uden overlap (flyttes lodret, tynd streg ud).
  const labels = useMemo(() => {
    const boxes: { x: number; y: number; w: number; h: number }[] = placed.map((o) => ({
      x: o.x - R, y: o.y - R, w: 2 * R, h: 2 * R,
    }));
    const hit = (b: { x: number; y: number; w: number; h: number }) =>
      boxes.some((o) => b.x < o.x + o.w + 2 && b.x + b.w + 2 > o.x && b.y < o.y + o.h + 1 && b.y + b.h + 1 > o.y);
    const res: { id: string; text: string; dx: number; dy: number; lx: number; ly: number; anchorRight: boolean }[] = [];
    for (const o of placed.filter((q) => q.p.group === "start").sort((a, b) => a.y - b.y)) {
      const text = formatShort(o.p.m.employee_name);
      const w = text.length * 6.6 + 4;
      const h = 14;
      let done = false;
      for (let k = 0; k < 80 && !done; k++) {
        const dy = Math.ceil(k / 2) * (k % 2 ? 1 : -1) * 4;
        for (const right of [true, false]) {
          const bx = right ? o.x + R + 6 : o.x - R - 6 - w;
          const by = o.y + dy - h / 2;
          if (bx < PAD.l || bx + w > width - PAD.r || by < PAD.t || by + h > H - PAD.b) continue;
          const b = { x: bx, y: by, w, h };
          if (!hit(b)) {
            boxes.push(b);
            res.push({ id: o.p.m.employee_id, text, dx: o.x, dy: o.y, lx: right ? bx : bx + w, ly: by + h / 2, anchorRight: right });
            done = true;
            break;
          }
        }
      }
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, width]);

  const cohorts = useMemo(() => {
    let lastEnd = [-Infinity, -Infinity];
    return cohortsRaw.map(([day, n]) => {
      const text = `Hold · dag ${day} (${n})`;
      const w = text.length * 5.8;
      const x = Math.min(width - w / 2 - 2, Math.max(PAD.l + w / 2, xs(day)));
      const row = x - w / 2 > lastEnd[0] + 6 ? 0 : x - w / 2 > lastEnd[1] + 6 ? 1 : 0;
      lastEnd[row] = x + w / 2;
      return { day, n, text, x, row };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortsRaw, width]);

  // Typisk spaend (historik) omregnet til samme akse: p25/p50/p75 ÷ forventning pr. arbejdsdag.
  const band = useMemo(() => {
    const byDay = new Map<number, { lo: number[]; mid: number[]; hi: number[] }>();
    members.forEach((m) => {
      const e = Number(m.expected_today ?? 0);
      if (e <= 0 || m.p50 == null || m.day_no < 1 || m.day_no > DAYS) return;
      const b = byDay.get(m.day_no) ?? { lo: [], mid: [], hi: [] };
      b.lo.push((m.p25 ?? 0) / e);
      b.mid.push(m.p50 / e);
      b.hi.push((m.p75 ?? 0) / e);
      byDay.set(m.day_no, b);
    });
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([d, b]) => ({ d, lo: median(b.lo) as number, mid: median(b.mid) as number, hi: median(b.hi) as number }));
  }, [members]);

  const weeks = Math.ceil(DAYS / WEEK_DAYS);
  const yTicks = [0, 0.5, 1, 1.5, 2];
  const dim = (g: SupportGroup) => (activeGroup && activeGroup !== g ? 0.2 : 1);
  const tipText = (m: RampTeamMember) =>
    `${m.cum_sales} salg · forventet ${fmtSales(Number(m.expected_today ?? 0))} i dag (${Math.round(pctOf(m))} %)`;
  const tip = (o: (typeof placed)[number]) =>
    `${o.p.m.employee_name} · dag ${o.p.m.day_no} · ${tipText(o.p.m)} · ${STATUS_LABEL[o.p.group]} · ${TREND_LABEL[o.p.trend]}`;
  const [hover, setHover] = useState<string | null>(null);
  const hovered = placed.find((o) => o.p.m.employee_id === hover);

  const startList = useMemo(
    () => members.filter((m) => supportGroup(m, trendOf(m)) === "start").sort((a, b) => pctOf(a) - pctOf(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members],
  );

  const bandPath = (key: "lo" | "mid" | "hi") =>
    band.map((p, i) => `${i ? "L" : "M"}${xs(p.d).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(" ");
  const bandArea = band.length
    ? `${bandPath("hi")} ${[...band].reverse().map((p) => `L${xs(p.d).toFixed(1)},${ys(p.lo).toFixed(1)}`).join(" ")} Z`
    : null;

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-[12px] font-extrabold uppercase" style={{ color: "#57635e", letterSpacing: ".1em" }}>
          Hvor starter du?
        </p>
        <div className="mt-2.5 grid gap-3 md:grid-cols-3">
          {(["start", "hold", "track"] as SupportGroup[]).map((g) => {
            const info = GROUP_INFO[g];
            const active = activeGroup === g;
            const filled = g === "start";
            const accent = g === "start" ? RED : g === "hold" ? YELLOW_TEXT : GREEN;
            return (
              <button
                key={g}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectGroup(g)}
                className="flex items-center gap-4 rounded-[18px] border-2 px-5 py-5 text-left transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,.08)]"
                style={{
                  background: filled ? RED : "#ffffff",
                  color: filled ? "#ffffff" : DARK,
                  borderColor: active ? DARK : "transparent",
                  opacity: activeGroup && !active ? 0.6 : 1,
                }}
              >
                <span
                  className="text-[52px] font-extrabold leading-none tabular-nums"
                  style={{ color: filled ? "#ffffff" : accent, letterSpacing: "-.04em" }}
                >
                  {counts[g]}
                </span>
                <span className="min-w-0">
                  <span
                    className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase"
                    style={{ letterSpacing: ".08em", color: filled ? "#ffffff" : accent }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-full border-2"
                      style={{ borderColor: filled ? "#ffffff" : accent }}
                    />
                    {info.no} · {info.title}
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold">{info.rule}</span>
                  <span className="mt-0.5 block text-[13px] font-semibold" style={{ opacity: filled ? 0.92 : 0.75 }}>
                    {info.text}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <section
        className="rounded-[20px] bg-white p-5 sm:p-8"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
        aria-label="Overblik: hvem ligger hvor?"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[22px] font-extrabold" style={{ color: DARK, letterSpacing: "-.02em" }}>
            Overblik: hvem ligger hvor?
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold" style={{ color: "#57635e" }}>
            <input
              type="checkbox"
              checked={showBand}
              onChange={(e) => setShowBand(e.target.checked)}
              className="h-4 w-4"
            />
            Vis typisk spænd (historik)
          </label>
        </div>
        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div ref={wrapRef} className="relative w-full">
              <svg width={width} height={H} role="img" aria-label="Prikdiagram: arbejdsdag og salg ift. forventning">
                <rect x={PAD.l} y={PAD.t} width={plotW} height={ys(1) - PAD.t} fill={GREEN} opacity={0.07} />
                <rect x={PAD.l} y={ys(1)} width={plotW} height={H - PAD.b - ys(1)} fill={RED} opacity={0.07} />
                <text x={PAD.l + 8} y={PAD.t + 16} fontSize={10} fontWeight={800} fill={GREEN} letterSpacing=".08em">
                  OVER FORVENTNING
                </text>
                <text x={PAD.l + 8} y={H - PAD.b - 8} fontSize={10} fontWeight={800} fill={RED} letterSpacing=".08em">
                  UNDER FORVENTNING
                </text>
                {yTicks.map((t) => (
                  <g key={t}>
                    {t !== 1 && (
                      <line x1={PAD.l} x2={width - PAD.r} y1={ys(t)} y2={ys(t)} stroke="rgba(27,31,29,.06)" />
                    )}
                    <text x={PAD.l - 6} y={ys(t) + 3} fontSize={10} textAnchor="end" fill="#7b857f">
                      {t === Y_MAX ? "200 %+" : `${Math.round(t * 100)} %`}
                    </text>
                  </g>
                ))}
                {Array.from({ length: weeks - 1 }, (_, i) => (i + 1) * WEEK_DAYS).map((d) => (
                  <line key={d} x1={xEdge(d)} x2={xEdge(d)} y1={PAD.t} y2={H - PAD.b + 36} stroke="rgba(27,31,29,.08)" />
                ))}
                {showBand && bandArea && (
                  <g pointerEvents="none">
                    <path d={bandArea} fill="rgba(27,31,29,.10)" />
                    <path d={bandPath("mid")} fill="none" stroke="#57635e" strokeWidth={1.5} strokeDasharray="4 3" />
                    {band.length > 0 && (
                      <text
                        x={Math.min(width - PAD.r - 4, xs(band[band.length - 1].d) + 6)}
                        y={ys(band[band.length - 1].mid) - 4}
                        fontSize={10}
                        fontWeight={700}
                        textAnchor={xs(band[band.length - 1].d) > width - 140 ? "end" : "start"}
                        fill="#57635e"
                      >
                        Normal · typisk spænd (historik)
                      </text>
                    )}
                  </g>
                )}
                <line x1={PAD.l} x2={width - PAD.r} y1={ys(1)} y2={ys(1)} stroke={DARK} strokeWidth={2.5} />
                <g>
                  <rect x={width - PAD.r + 6} y={ys(1) - 9} width={82} height={18} rx={4} fill={DARK} />
                  <text x={width - PAD.r + 47} y={ys(1) + 4} fontSize={11} fontWeight={800} textAnchor="middle" fill="#ffffff">
                    Forventning
                  </text>
                </g>
                <line x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#c9cfcb" />
                {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
                  const cx = xEdge((w - 0.5) * WEEK_DAYS);
                  return (
                    <g key={w}>
                      <text x={cx} y={H - PAD.b + 16} fontSize={11} fontWeight={800} textAnchor="middle" fill={DARK}>
                        Uge {w}
                      </text>
                      <text x={cx} y={H - PAD.b + 30} fontSize={11} textAnchor="middle" fill="#57635e">
                        {weeklyTarget(w, minTargets)} salg
                      </text>
                    </g>
                  );
                })}
                <text x={PAD.l + plotW / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="#7b857f">
                  Arbejdsdag · opstartsuge og forventede salg pr. uge
                </text>
                {cohorts.map((c) => (
                  <g key={c.day}>
                    <line x1={xs(c.day)} x2={xs(c.day)} y1={PAD.t - 4} y2={H - PAD.b} stroke="#9aa39e" strokeDasharray="2 4" />
                    <text x={c.x} y={PAD.t - 10 - c.row * 15} fontSize={12} fontWeight={700} textAnchor="middle" fill={DARK}>
                      {c.text}
                    </text>
                  </g>
                ))}
                {labels.map((l) => {
                  const far = Math.abs(l.ly - l.dy) > 3;
                  return (
                    <g key={l.id} opacity={dim("start")} pointerEvents="none">
                      {far && <line x1={l.dx + (l.anchorRight ? R : -R)} y1={l.dy} x2={l.lx} y2={l.ly} stroke={RED} strokeWidth={0.8} />}
                      <text x={l.lx + (l.anchorRight ? 2 : -2)} y={l.ly + 4} fontSize={11} fontWeight={700} textAnchor={l.anchorRight ? "start" : "end"} fill={DARK}>
                        {l.text}
                      </text>
                    </g>
                  );
                })}
                {placed.map((o) => {
                  const g = o.p.group;
                  const style =
                    g === "start"
                      ? { fill: RED, stroke: RED, sw: 1.5 }
                      : g === "hold"
                        ? { fill: "#ffffff", stroke: YELLOW, sw: 3 }
                        : { fill: GREEN_LIGHT, stroke: GREEN, sw: 1.5 };
                  const label = tip(o);
                  return (
                    <circle
                      key={o.p.m.employee_id}
                      cx={o.x}
                      cy={o.y}
                      r={R - style.sw / 2}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={style.sw}
                      opacity={dim(g)}
                      tabIndex={0}
                      role="button"
                      aria-label={label}
                      className="cursor-pointer outline-none focus-visible:[stroke:#1b1f1d]"
                      onMouseEnter={() => setHover(o.p.m.employee_id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(o.p.m.employee_id)}
                      onBlur={() => setHover(null)}
                      onClick={() => onSelectMember(o.p.m.employee_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectMember(o.p.m.employee_id);
                        }
                      }}
                    >
                      <title>{label}</title>
                    </circle>
                  );
                })}
              </svg>
              {hovered && (
                <div
                  className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold"
                  style={{
                    left: Math.min(width - 10, Math.max(10, hovered.x)),
                    top: hovered.y - R - 8,
                    transform: `translate(${hovered.x > width - 160 ? "-100%" : hovered.x < 160 ? "0" : "-50%"}, -100%)`,
                    background: DARK,
                    color: "#ffffff",
                  }}
                >
                  {hovered.p.m.employee_name} · dag {hovered.p.m.day_no} · {tipText(hovered.p.m)}
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold" style={{ color: "#57635e" }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: RED }} /> Start her
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border-[3px]" style={{ borderColor: YELLOW }} /> Hold fast
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border" style={{ background: GREEN_LIGHT, borderColor: GREEN }} /> På sporet
              </span>
            </div>
            <p className="mt-2 text-[12px] font-semibold" style={{ color: "#57635e" }}>
              Vandret: arbejdsdag fra startdato, delt i opstartsuger. Lodret: salg til og med i dag ift. forventet antal på
              samme dag (100 % = præcis på forventning). Over 200 % vises øverst.
            </p>
            {footer && <div className="mt-4">{footer}</div>}
          </div>

          <aside aria-label="Start her i dag" className="min-w-0">
            <p className="text-[12px] font-extrabold uppercase" style={{ color: RED, letterSpacing: ".1em" }}>
              Start her · i dag
            </p>
            <p className="mt-0.5 text-[13px] font-semibold" style={{ color: "#57635e" }}>
              Salg til og med i dag mod forventning
            </p>
            {startList.length === 0 ? (
              <p className="mt-4 text-[13px] font-semibold" style={{ color: "#57635e" }}>
                Ingen i Start her lige nu.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2.5">
                {startList.map((m) => {
                  const exp = Number(m.expected_today ?? 0);
                  const share = exp > 0 ? Math.min(1, m.cum_sales / exp) : 0;
                  return (
                    <li key={m.employee_id}>
                      <button
                        type="button"
                        onClick={() => onSelectMember(m.employee_id)}
                        className="w-full rounded-[12px] px-3 py-2.5 text-left hover:bg-[#f6f8f7]"
                      >
                        <span className="flex items-baseline justify-between gap-2 text-[13px]">
                          <span className="min-w-0 truncate font-extrabold" style={{ color: DARK }}>
                            {m.employee_name} <span className="font-semibold" style={{ color: "#7b857f" }}>· dag {m.day_no}</span>
                          </span>
                          <span className="shrink-0 font-bold tabular-nums" style={{ color: DARK }}>
                            {m.cum_sales} af {fmtSales(exp)} salg
                          </span>
                        </span>
                        <span
                          className="mt-1.5 block h-2.5 w-full overflow-hidden rounded-full"
                          style={{ background: "#ece9e8" }}
                          aria-hidden
                        >
                          <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: RED }} />
                        </span>
                        <span className="mt-1 block text-[12px] font-bold" style={{ color: RED }}>
                          Mangler {missingSales(m)} salg
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[12px] font-semibold" style={{ color: "#57635e" }}>
              Hele baren = forventet antal salg i dag.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
