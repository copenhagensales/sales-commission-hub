import type { RampTeamMember } from "@/hooks/useRampTeam";
import { useEffect, useState } from "react";

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
}: {
  members: RampTeamMember[];
  trendOf: (m: RampTeamMember) => Trend;
  counts: Record<SupportGroup, number>;
  activeGroup: SupportGroup | null;
  onSelectGroup: (g: SupportGroup) => void;
  onSelectMember: (employeeId: string) => void;
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

  const [openOverride, setOpenOverride] = useState<Partial<Record<SupportGroup, boolean>>>({});
  useEffect(() => setOpenOverride({}), [activeGroup]);

  // Typisk spaend vist som median af hver saelgers egen p25/p50 og p75/p50.
  const withNorm = members.filter((m) => (m.p50 ?? 0) > 0);
  const bandLow = median(withNorm.map((m) => (m.p25 ?? 0) / (m.p50 as number))) ?? 0.75;
  const bandHigh = median(withNorm.map((m) => (m.p75 ?? 0) / (m.p50 as number))) ?? 1.25;

  const xPct = (v: number) => (Math.min(Y_MAX, Math.max(0, v)) / Y_MAX) * 100;
  const order: SupportGroup[] = ["start", "hold", "track"];
  const isOpen = (g: SupportGroup) =>
    activeGroup ? g === activeGroup : (openOverride[g] ?? g !== "track");
  const toggle = (g: SupportGroup) => setOpenOverride((o) => ({ ...o, [g]: !isOpen(g) }));
  const arrow: Record<Trend, string> = { up: "↑", flat: "→", down: "↓", unknown: "" };

  return (
    <section
      className="rounded-[20px] bg-white p-5 sm:p-6"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
      aria-label="Overblik: hvem ligger hvor?"
    >
      <p className="text-[19px] font-extrabold" style={{ color: "#1b1f1d", letterSpacing: "-.02em" }}>
        Overblik: hvem ligger hvor?
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="flex text-[10px] font-bold" style={{ color: "#7b857f" }}>
            <div className="w-[140px] shrink-0 sm:w-[220px]" />
            <div className="relative h-4 flex-1">
              <span className="absolute left-0">0</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${xPct(1)}%`, color: "#1b1f1d" }}>
                Normal
              </span>
              <span className="absolute right-0">2x+</span>
            </div>
          </div>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-[140px] right-0 sm:left-[220px]">
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${xPct(bandLow)}%`,
                  width: `${xPct(bandHigh) - xPct(bandLow)}%`,
                  background: "rgba(27,31,29,.07)",
                }}
              />
              <div className="absolute inset-y-0 z-[1]" style={{ left: `${xPct(1)}%`, width: 2, background: "#1b1f1d" }} />
            </div>
            {order.map((g) => {
              const info = GROUP_INFO[g];
              const rows = points.filter((p) => p.group === g).sort((a, b) => a.y - b.y);
              const open = isOpen(g);
              return (
                <div key={g} className="relative">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(g)}
                    className="relative z-[2] mt-2 flex w-full items-center justify-between rounded-[8px] px-3 py-1.5 text-left text-[12px] font-extrabold uppercase"
                    style={{ background: info.bg, color: info.fg, letterSpacing: ".04em" }}
                  >
                    <span>{info.no} · {info.title} · {rows.length}</span>
                    <span className="text-[11px] normal-case">{open ? "Skjul" : "Vis alle"}</span>
                  </button>
                  {open &&
                    rows.map(({ m, trend, group, y }, i) => {
                      const label = `${m.employee_name} · dag ${m.day_no} · ${STATUS_LABEL[group]} · ${TREND_LABEL[trend]}`;
                      const dot =
                        group === "start"
                          ? { background: RED, border: `2px solid ${RED}` }
                          : group === "hold"
                            ? { background: "#ffffff", border: `3px solid ${YELLOW}` }
                            : { background: GREEN_LIGHT, border: `2px solid ${GREEN}` };
                      const lineColor = group === "track" ? GREEN : group === "hold" ? YELLOW : RED;
                      const lo = Math.min(xPct(1), xPct(y));
                      const hi = Math.max(xPct(1), xPct(y));
                      return (
                        <button
                          key={m.employee_id}
                          type="button"
                          title={label}
                          aria-label={label}
                          onClick={() => onSelectMember(m.employee_id)}
                          className="flex h-8 w-full items-center text-left hover:bg-black/[.04]"
                          style={{ background: i % 2 ? "rgba(27,31,29,.025)" : undefined }}
                        >
                          <span className="flex w-[140px] shrink-0 items-baseline gap-1.5 truncate pl-3 pr-2 sm:w-[220px]">
                            <span className="truncate text-[13px] font-bold" style={{ color: "#1b1f1d" }}>
                              {m.employee_name}
                            </span>
                            <span className="shrink-0 text-[11px] font-semibold" style={{ color: "#7b857f" }}>
                              dag {m.day_no}
                            </span>
                          </span>
                          <span className="relative h-full flex-1">
                            <span
                              className="absolute top-1/2 z-[2] h-[2px] -translate-y-1/2"
                              style={{ left: `${lo}%`, width: `${hi - lo}%`, background: lineColor, opacity: 0.5 }}
                            />
                            <span
                              className="absolute top-1/2 z-[3] h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                              style={{ left: `${xPct(y)}%`, ...dot }}
                            />
                            {arrow[trend] && (
                              <span
                                className="absolute top-1/2 z-[3] -translate-y-1/2 text-[12px] font-extrabold"
                                style={{
                                  left: `calc(${xPct(y)}% + ${xPct(y) > 92 ? -22 : 10}px)`,
                                  color: lineColor,
                                }}
                              >
                                {arrow[trend]}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              );
            })}
          </div>
          <div
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-semibold"
            style={{ color: "#57635e" }}
          >
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-[2px]" style={{ background: "#1b1f1d" }} />
              Normal (median for dagen)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4" style={{ background: "rgba(27,31,29,.12)" }} />
              Typisk spænd
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: RED }} />
              Under typisk, flad/faldende
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: YELLOW }} />
              Under typisk, stigende
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2" style={{ background: GREEN_LIGHT, borderColor: GREEN }} />
              På eller over typisk
            </span>
            <span>Vandret: salg ift. det typiske for sælgerens dag (Normal = 1,0). Over 2x vises yderst.</span>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p
            className="text-[12px] font-extrabold uppercase"
            style={{ color: "#57635e", letterSpacing: ".1em" }}
          >
            Hvor starter du?
          </p>
          <div className="mt-3 grid gap-2.5">
            {(["start", "hold", "track"] as SupportGroup[]).map((g) => {
              const info = GROUP_INFO[g];
              const active = activeGroup === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectGroup(g)}
                  className="rounded-[14px] border-2 px-4 py-3 text-left transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,.08)]"
                  style={{
                    background: info.bg,
                    color: info.fg,
                    borderColor: active ? "#1b1f1d" : info.border,
                  }}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-extrabold uppercase" style={{ letterSpacing: ".04em" }}>
                      {info.no} · {info.title}
                    </span>
                    <span className="text-[24px] font-extrabold tabular-nums leading-none">
                      {counts[g]}
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] font-bold opacity-90">{info.rule}</span>
                  <span className="mt-0.5 block text-[12px] font-semibold opacity-90">{info.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
