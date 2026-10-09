import type { RampTeamMember } from "@/hooks/useRampTeam";
import { getInitials } from "@/utils/formatting";

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

const BLUE = "#2f6fb5";
const BLUE_TEXT = "#1d4f87";
const BLUE_LIGHT = "#dbe8f7";
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
    bg: BLUE,
    fg: "#ffffff",
    border: BLUE,
  },
  hold: {
    no: 2,
    title: "Hold fast",
    rule: "Under typisk, men stigende",
    text: "På vej. Anerkend fremgangen, og hold rytmen.",
    bg: BLUE_LIGHT,
    fg: BLUE_TEXT,
    border: "#b5cdea",
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

  // Typisk spaend vist som median af hver saelgers egen p25/p50 og p75/p50.
  const withNorm = members.filter((m) => (m.p50 ?? 0) > 0);
  const bandLow = median(withNorm.map((m) => (m.p25 ?? 0) / (m.p50 as number))) ?? 0.75;
  const bandHigh = median(withNorm.map((m) => (m.p75 ?? 0) / (m.p50 as number))) ?? 1.25;

  const yPct = (v: number) => 100 - (Math.min(Y_MAX, v) / Y_MAX) * 100;
  const xPct = (day: number) => ((Math.min(40, Math.max(1, day)) - 1) / 39) * 100;

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
        <div>
          <div className="flex gap-2">
            <div
              className="flex w-8 shrink-0 flex-col justify-between text-right text-[10px] font-bold tabular-nums"
              style={{ color: "#7b857f", height: 300 }}
            >
              <span>2x+</span>
              <span>1,0</span>
              <span>0</span>
            </div>
            <div className="relative flex-1" style={{ height: 300 }}>
              <div className="absolute inset-0 rounded-[10px]" style={{ background: "#fafcfb" }} />
              {/* Blaa zone under spaendet */}
              <div
                className="absolute inset-x-0 bottom-0 rounded-b-[10px]"
                style={{ top: `${yPct(bandLow)}%`, background: "rgba(47,111,181,.10)" }}
              >
                <span
                  className="absolute bottom-2 left-2 text-[11px] font-extrabold uppercase"
                  style={{ color: BLUE_TEXT, letterSpacing: ".08em" }}
                >
                  Start her
                </span>
              </div>
              {/* Typisk spaend */}
              <div
                className="absolute inset-x-0"
                style={{
                  top: `${yPct(bandHigh)}%`,
                  height: `${yPct(bandLow) - yPct(bandHigh)}%`,
                  background: "rgba(27,31,29,.07)",
                }}
              />
              {/* Median */}
              <div
                className="absolute inset-x-0"
                style={{ top: `${yPct(1)}%`, height: 2, background: "#1b1f1d" }}
              />
              {/* Dag 10 */}
              <div
                className="absolute bottom-0 top-0 border-l-2 border-dashed"
                style={{ left: `${xPct(10)}%`, borderColor: "#9aa59f" }}
              >
                <span className="absolute left-1 top-1 text-[10px] font-bold" style={{ color: "#57635e" }}>
                  dag 10
                </span>
              </div>
              {points.map(({ m, trend, group, y }) => {
                const label = `${m.employee_name} · dag ${m.day_no} · ${STATUS_LABEL[group]} · ${TREND_LABEL[trend]}`;
                const style =
                  group === "start"
                    ? { background: BLUE, color: "#ffffff", border: `2px solid ${BLUE}` }
                    : group === "hold"
                      ? { background: "#ffffff", color: BLUE_TEXT, border: `2px solid ${BLUE}` }
                      : { background: GREEN_LIGHT, color: "#0f5a38", border: `2px solid ${GREEN}` };
                return (
                  <button
                    key={m.employee_id}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => onSelectMember(m.employee_id)}
                    className="absolute flex h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-extrabold shadow-sm transition-transform hover:z-10 hover:scale-110"
                    style={{ left: `${xPct(m.day_no)}%`, top: `${yPct(y)}%`, ...style }}
                  >
                    {getInitials(m.employee_name)}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="ml-10 mt-1 flex justify-between text-[10px] font-bold tabular-nums"
            style={{ color: "#7b857f" }}
          >
            <span>Dag 1</span>
            <span>Arbejdsdag</span>
            <span>Dag 40</span>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-semibold"
            style={{ color: "#57635e" }}
          >
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[2px] w-4" style={{ background: "#1b1f1d" }} />
              Normal (median for dagen)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4" style={{ background: "rgba(27,31,29,.12)" }} />
              Typisk spænd
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: BLUE }} />
              Under typisk, flad/faldende
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: BLUE }} />
              Under typisk, stigende
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full border-2"
                style={{ background: GREEN_LIGHT, borderColor: GREEN }}
              />
              På eller over typisk
            </span>
            <span>Lodret: salg ift. det typiske for dagen (1,0 = median). Over 2x vises øverst.</span>
          </div>
        </div>

        <div>
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
