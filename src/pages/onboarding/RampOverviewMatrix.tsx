import type { RampTeamMember } from "@/hooks/useRampTeam";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WEEKLY_MIN_TARGETS, minCumulativeAt } from "@/lib/rampMinTarget";

const MIN_COLOR = "#2b5fd9";

/**
 * Overblik: hvem ligger hvor? Ren visning af data fra get_ramp_team_overview.
 * Grupperingen bruger sidens eksisterende definition: status "under" = under
 * typisk; "midt"/"over" = paa eller over. "ukendt" vises ikke (ingen norm endnu).
 */

export type SupportGroup = "start" | "hold" | "track";
type Trend = "up" | "down" | "flat" | "unknown";

export function supportGroup(member: RampTeamMember, trend: Trend): SupportGroup | null {
  if (member.status === "under") return trend === "up" ? "hold" : "start";
  if (member.status === "midt" || member.status === "over") return "track";
  return null;
}

const RED = "#c13b32";
const YELLOW = "#d9a21b";
const YELLOW_TEXT = "#7a5508";
const YELLOW_LIGHT = "#fbefcc";
const GREEN = "#177a4d";
const GREEN_LIGHT = "#d9f0e3";
const Y_MAX = 2;

const GROUP_INFO: Record<
  SupportGroup,
  { no: number; title: string; rule: string; text: string; bg: string; fg: string; border: string }
> = {
  start: {
    no: 1,
    title: "Start her",
    rule: "Under typisk og flad/faldende",
    text: "Størst risiko for at de stopper. 1-1 og medlyt denne uge.",
    bg: RED,
    fg: "#ffffff",
    border: RED,
  },
  hold: {
    no: 2,
    title: "Hold fast",
    rule: "Under typisk, men stigende",
    text: "På vej. Anerkend fremgangen, og hold rytmen.",
    bg: YELLOW_LIGHT,
    fg: YELLOW_TEXT,
    border: YELLOW,
  },
  track: {
    no: 3,
    title: "På sporet",
    rule: "På eller over typisk",
    text: "Ugens faste 1-1 — og brug dem som makker for nr. 1.",
    bg: GREEN_LIGHT,
    fg: "#0f5a38",
    border: "#a9dcc3",
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

export function RampOverviewMatrix({
  members,
  trendOf,
  counts,
  activeGroup,
  onSelectGroup,
  onSelectMember,
  minTargets = DEFAULT_WEEKLY_MIN_TARGETS,
}: {
  members: RampTeamMember[];
  trendOf: (m: RampTeamMember) => Trend;
  counts: Record<SupportGroup, number>;
  activeGroup: SupportGroup | null;
  onSelectGroup: (g: SupportGroup) => void;
  onSelectMember: (employeeId: string) => void;
  minTargets?: number[];
}) {
  const points = members
    .map((m) => {
      const trend = trendOf(m);
      const group = supportGroup(m, trend);
      if (!group) return null;
      const p50 = m.p50 ?? 0;
      const ratio = p50 > 0 ? m.cum_sales / p50 : m.cum_sales > 0 ? Y_MAX : 1;
      return { m, trend, group, y: Math.min(Y_MAX, Math.max(0, ratio)) };
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

  // Typisk spaend vist som median af hver saelgers egen p25/p50 og p75/p50.
  const withNorm = members.filter((m) => (m.p50 ?? 0) > 0);
  const bandLow = median(withNorm.map((m) => (m.p25 ?? 0) / (m.p50 as number))) ?? 0.75;
  const bandHigh = median(withNorm.map((m) => (m.p75 ?? 0) / (m.p50 as number))) ?? 1.25;

  const H = 460;
  const gutter = width >= 640;
  const PAD = { l: 40, r: gutter ? 150 : 16, t: 20, b: 76 };
  const R = 9;
  const GAP = 4;
  const plotW = width - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const maxY = Math.max(bandHigh, 1.2, ...points.map((p) => p.y));
  const yTop = Math.min(Y_MAX, Math.ceil((maxY + 0.15) * 4) / 4);
  const ys = (v: number) => PAD.t + plotH - (Math.min(yTop, Math.max(0, v)) / yTop) * plotH;
  const xs = (d: number) => PAD.l + ((Math.min(40, Math.max(1, d)) - 0.5) / 40) * plotW;

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
  }, [points.map((p) => `${p.m.employee_id}:${p.y}:${p.m.day_no}`).join("|"), width, yTop]);

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
          if (bx < 0 || bx + w > width || by < 0 || by + h > H - PAD.b) continue;
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
  }, [placed, width]);

  // Hold: arbejdsdage med 2+ saelgere.
  const cohorts = useMemo(() => {
    const byDay = new Map<number, number>();
    points.forEach((p) => byDay.set(p.m.day_no, (byDay.get(p.m.day_no) ?? 0) + 1));
    const list = [...byDay.entries()].filter(([, n]) => n >= 2).sort((a, b) => a[0] - b[0]);
    let lastEnd = [-Infinity, -Infinity];
    return list.map(([day, n]) => {
      const text = `Hold · dag ${day} (${n})`;
      const w = text.length * 5.8;
      const x = xs(day);
      const row = x - w / 2 > lastEnd[0] + 6 ? 0 : x - w / 2 > lastEnd[1] + 6 ? 1 : 0;
      lastEnd[row] = x + w / 2;
      return { day, n, text, x, row };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.m.day_no).join(","), width]);

  const yTicks = [0, 0.5, 1, 1.5, 2].filter((t) => t <= yTop + 1e-9);
  const dim = (g: SupportGroup) => (activeGroup && activeGroup !== g ? 0.2 : 1);
  const tip = (o: (typeof placed)[number]) =>
    `${o.p.m.employee_name} · dag ${o.p.m.day_no} · ${o.p.y.toFixed(2).replace(".", ",")}x normal${o.p.y >= Y_MAX ? "+" : ""} · ${o.p.m.cum_sales} salg, minimum ${String(Math.round(minCumulativeAt(o.p.m.day_no, minTargets) * 10) / 10).replace(".", ",")} i dag · ${STATUS_LABEL[o.p.group]} · ${TREND_LABEL[o.p.trend]}`;

  // Minimumsstreg: kumulativt minimum / median for dagen, pr. arbejdsdag med kendt median.
  const minPts = (() => {
    const byDay = new Map<number, number[]>();
    members.forEach((m) => {
      if ((m.p50 ?? 0) > 0 && m.day_no >= 1 && m.day_no <= 40) {
        const arr = byDay.get(m.day_no) ?? [];
        arr.push(m.p50 as number);
        byDay.set(m.day_no, arr);
      }
    });
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([d, p]) => ({ d, r: Math.min(Y_MAX, minCumulativeAt(d, minTargets) / (median(p) as number)) }));
  })();
  const minPath = minPts.length
    ? minPts.map((p, i) => `${i ? "L" : "M"}${xs(p.d).toFixed(1)},${ys(p.r).toFixed(1)}`).join(" ")
    : null;
  const minLabelY = minPts.length ? ys(minPts[minPts.length - 1].r) : null;
  const [hover, setHover] = useState<string | null>(null);
  const hovered = placed.find((o) => o.p.m.employee_id === hover);

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
                  color: filled ? "#ffffff" : "#1b1f1d",
                  borderColor: active ? "#1b1f1d" : "transparent",
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
      <p className="text-[22px] font-extrabold" style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}>
        Overblik: hvem ligger hvor?
      </p>
      <div className="mt-4">
        <div className="min-w-0">
          <div ref={wrapRef} className="relative w-full">
            <svg width={width} height={H} role="img" aria-label="Prikdiagram: arbejdsdag og niveau ift. normal">
              <rect x={PAD.l} y={ys(bandLow)} width={plotW} height={plotH + PAD.t - ys(bandLow)} fill={RED} opacity={0.07} />
              <text x={PAD.l + 6} y={H - PAD.b - 6} fontSize={10} fontWeight={800} fill={RED} letterSpacing=".08em">START HER</text>
              <rect x={PAD.l} y={ys(bandHigh)} width={plotW} height={ys(bandLow) - ys(bandHigh)} fill="rgba(27,31,29,.08)" />
              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={PAD.l} x2={width - PAD.r} y1={ys(t)} y2={ys(t)} stroke="rgba(27,31,29,.06)" />
                  <text x={PAD.l - 6} y={ys(t) + 3} fontSize={10} textAnchor="end" fill="#7b857f">
                    {t === Y_MAX ? "2x+" : `${String(t).replace(".", ",")}`}
                  </text>
                </g>
              ))}
              <line x1={PAD.l} x2={width - PAD.r} y1={ys(1)} y2={ys(1)} stroke="#1b1f1d" strokeWidth={2} />
              {minPath && (
                <path d={minPath} fill="none" stroke={MIN_COLOR} strokeWidth={2.5} strokeDasharray="6 4" aria-label="Minimum (dit krav)" />
              )}
              {gutter ? (
                <g fontSize={12}>
                  <line x1={width - PAD.r + 8} x2={width - PAD.r + 8} y1={ys(bandHigh)} y2={ys(bandLow)} stroke="#9aa39e" strokeWidth={2} />
                  <line x1={width - PAD.r + 8} x2={width - PAD.r + 8} y1={ys(bandLow) + 4} y2={H - PAD.b} stroke={RED} strokeOpacity={0.4} strokeWidth={2} />
                  <text x={width - PAD.r + 18} y={ys(1) - 2} fontWeight={800} fill="#1b1f1d">Normal</text>
                  <text x={width - PAD.r + 18} y={ys(1) + 13} fontSize={11} fill="#57635e">(median for dagen)</text>
                  <text x={width - PAD.r + 18} y={Math.max(ys(1) + 40, (ys(bandHigh) + ys(bandLow)) / 2 + 30)} fontWeight={700} fill="#57635e">Typisk spænd</text>
                  <text x={width - PAD.r + 18} y={(ys(bandLow) + H - PAD.b) / 2 + 4} fontWeight={800} fill={RED}>Start her-zone</text>
                  {minLabelY !== null && (
                    <text x={width - PAD.r + 18} y={minLabelY + 4} fontWeight={800} fill={MIN_COLOR}>Minimum (dit krav)</text>
                  )}
                </g>
              ) : (
                <text x={width - PAD.r} y={ys(1) - 5} fontSize={10} fontWeight={800} textAnchor="end" fill="#1b1f1d">Normal</text>
              )}
              <line x1={PAD.l} x2={width - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#c9cfcb" />
              {[1, 5, 10, 15, 20, 25, 30, 35, 40].map((d) => (
                <text key={d} x={xs(d)} y={H - PAD.b + 16} fontSize={11} textAnchor="middle" fill="#7b857f">{d}</text>
              ))}
              {cohorts.map((c) => (
                <g key={c.day}>
                  <line x1={c.x} x2={c.x} y1={PAD.t} y2={H - PAD.b} stroke="#c9cfcb" strokeDasharray="2 4" />
                  <text x={c.x} y={H - PAD.b + 40 + c.row * 15} fontSize={12} fontWeight={700} textAnchor="middle" fill="#1b1f1d">{c.text}</text>
                </g>
              ))}
              <text x={PAD.l + plotW / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="#7b857f">Arbejdsdag</text>
              {labels.map((l) => {
                const o = placed.find((q) => q.p.m.employee_id === l.id);
                const far = Math.abs(l.ly - l.dy) > 3;
                return (
                  <g key={l.id} opacity={dim("start")} pointerEvents="none">
                    {far && <line x1={l.dx + (l.anchorRight ? R : -R)} y1={l.dy} x2={l.lx} y2={l.ly} stroke={RED} strokeWidth={0.8} />}
                    <text x={l.lx + (l.anchorRight ? 2 : -2)} y={l.ly + 4} fontSize={11} fontWeight={700} textAnchor={l.anchorRight ? "start" : "end"} fill="#1b1f1d">
                      {l.text}
                    </text>
                    {!o && null}
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
                  transform: `translate(${hovered.x > width - 120 ? "-100%" : hovered.x < 120 ? "0" : "-50%"}, -100%)`,
                  background: "#1b1f1d",
                  color: "#ffffff",
                }}
              >
                {hovered.p.m.employee_name} · dag {hovered.p.m.day_no} · {hovered.p.m.cum_sales} salg · minimum{" "}
                {String(Math.round(minCumulativeAt(hovered.p.m.day_no, minTargets) * 10) / 10).replace(".", ",")} i dag
              </div>
            )}
          </div>
          <p className="mt-3 text-[12px] font-semibold" style={{ color: "#57635e" }}>
            Vandret: arbejdsdag. Lodret: salg ift. det typiske for dagen (Normal = 1,0). Over 2x vises øverst.
          </p>
        </div>
      </div>
      </section>
    </div>
  );
}
