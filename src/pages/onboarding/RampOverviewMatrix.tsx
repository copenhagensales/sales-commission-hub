import type { RampTeamMember } from "@/hooks/useRampTeam";
import { useState, type ReactNode } from "react";
import { restOfWeek, WEEKDAY_NAME, type RampWeekStatus } from "@/lib/rampWeek";

/**
 * Ugetavle: ren visning af ugemodellen fra get_ramp_team_overview.week_status
 * (beregnet i databasen af ramp_week_status). Status maales kun paa den
 * indevaerende kalenderuge til og med i gaar. Tidligere uger er kun historik.
 */

export type SupportGroup = "start" | "hold" | "track";
export type Trend = "up" | "down" | "flat" | "unknown";

export function supportGroup(member: { week_status?: RampWeekStatus | null }): SupportGroup | null {
  switch (member.week_status?.status) {
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

const RED = "#c13b32";
const YELLOW = "#d9a21b";
const YELLOW_TEXT = "#7a5508";
const GREEN = "#177a4d";
const DARK = "#1b1f1d";
const MUTED = "#57635e";
const COLOR: Record<SupportGroup, string> = { start: RED, hold: YELLOW, track: GREEN };

const GROUP_INFO: Record<SupportGroup, { no: number; title: string; rule: string; text: string }> = {
  start: {
    no: 1,
    title: "Start her",
    rule: "Bagud i denne uge · ikke bedre end sidste uge",
    text: "Størst risiko for at de stopper. 1-1 og medlyt denne uge.",
  },
  hold: {
    no: 2,
    title: "Hold fast",
    rule: "Bagud i denne uge · men bedre end sidste uge",
    text: "På vej. Anerkend fremgangen, og hold rytmen.",
  },
  track: {
    no: 3,
    title: "På sporet",
    rule: "På eller foran ugens tempo",
    text: "Ugens faste 1-1 — og brug dem som makker for nr. 1.",
  },
};

function SellerCell({ m, w }: { m: RampTeamMember; w: RampWeekStatus }) {
  const sub = w.partial_start
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

function SalesBar({ w, g }: { w: RampWeekStatus; g: SupportGroup }) {
  const max = Math.max(w.required, w.sales_live, 0.0001);
  const fill = Math.min(100, (w.sales_live / max) * 100);
  const marker = Math.min(100, (w.expected_now / max) * 100);
  return (
    <div className="min-w-[220px]">
      <div className="flex items-baseline justify-between gap-3 text-[13px] font-bold">
        <span style={{ color: DARK }}>
          {w.sales_live} af {fmtSales(w.required)} salg
        </span>
        <span style={{ color: MUTED }}>burde have {fmtSales(w.expected_now)} nu</span>
      </div>
      <div className="relative mt-1.5 h-2.5 rounded-full" style={{ background: "#e9eeec" }}>
        <div className="h-full rounded-full" style={{ width: `${fill}%`, background: COLOR[g] }} />
        <span
          aria-hidden
          className="absolute -top-1 h-[18px] w-[3px] rounded"
          style={{ left: `calc(${marker}% - 1.5px)`, background: DARK }}
        />
      </div>
    </div>
  );
}

function RestCell({ w, g }: { w: RampWeekStatus; g: SupportGroup }) {
  const rest = restOfWeek(w);
  if (g === "track") {
    const ahead = w.sales - w.expected_now;
    const toGo = Math.max(0, w.required - w.sales_live);
    return (
      <div className="text-[13px] font-bold">
        <p style={{ color: GREEN }}>{ahead > 1e-9 ? `${fmtSales(ahead)} foran tempo` : "På tempo"}</p>
        <p style={{ color: MUTED }}>{toGo > 0 ? `${fmtSales(toGo)} til ugens krav` : "Ugens krav er nået"}</p>
      </div>
    );
  }
  return (
    <div className="text-[13px] font-bold">
      <p style={{ color: g === "start" ? RED : YELLOW_TEXT }}>Mangler {fmtSales(rest.missing)}</p>
      <p style={{ color: MUTED }}>
        {fmtSales(rest.perDay)} salg pr. dag{g === "hold" ? " · bedre end sidste uge" : ""}
      </p>
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

const PREVIEW = 3;
__CHART__

export function RampOverviewMatrix({
  members,
  counts,
  activeGroup,
  onSelectGroup,
  onSelectMember,
  footer,
  targets,
}: {
  members: RampTeamMember[];
  counts: Record<SupportGroup, number>;
  activeGroup: SupportGroup | null;
  onSelectGroup: (g: SupportGroup) => void;
  onSelectMember: (employeeId: string) => void;
  footer?: ReactNode;
  targets?: number[];
}) {
  const [expanded, setExpanded] = useState<Record<SupportGroup, boolean>>({ start: true, hold: false, track: false });
  const [flash, setFlash] = useState<string | null>(null);
  const focusRow = (employeeId: string, g: SupportGroup) => {
    if (activeGroup && activeGroup !== g) onSelectGroup(activeGroup);
    setExpanded((e) => ({ ...e, [g]: true }));
    setFlash(employeeId);
    window.setTimeout(() => {
      document.getElementById(`ramp-row-${employeeId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    window.setTimeout(() => setFlash((f) => (f === employeeId ? null : f)), 2200);
  };
  const any = members.find((m) => m.week_status)?.week_status ?? null;
  const isoWeek = any?.iso_week ?? members[0]?.iso_week;
  const newWeek = members.length > 0 && members.every((m) => !m.week_status || m.week_status.status === "ny_uge");

  // Ugens fremdrift ud fra en sælger med fuld uge (alle har samme kalender).
  const ref = members.map((m) => m.week_status).find((w) => w && !w.partial_start) ?? any;
  const done = ref?.done_days ?? 0;
  const total = ref?.workdays ?? 5;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const yesterday = WEEKDAY_NAME[((new Date().getDay() + 6) % 7) || 7];

  const groups = (["start", "hold", "track"] as SupportGroup[]).map((g) => ({
    g,
    rows: members
      .filter((m) => supportGroup(m) === g)
      .sort((a, b) => Number(a.week_status?.pace_ratio ?? 0) - Number(b.week_status?.pace_ratio ?? 0)),
  }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[24px] font-extrabold" style={{ color: DARK, letterSpacing: "-.02em" }}>
            Uge {isoWeek ?? "-"} · hvem er på sporet?
          </p>
          <p className="mt-0.5 text-[14px] font-semibold" style={{ color: MUTED }}>
            {newWeek
              ? "Ny uge · første status i morgen"
              : `Målt til og med i går (${yesterday}) · ${done} af ${total} arbejdsdage gået · ${Math.max(0, total - done)} dage tilbage`}
          </p>
        </div>
        <div className="w-44">
          <p className="text-right text-[12px] font-bold" style={{ color: MUTED }}>
            Ugen er {pct} % gået
          </p>
          <div className="mt-1 h-1.5 rounded-full" style={{ background: "#d7e0dc" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DARK }} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
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
                {newWeek ? 0 : counts[g]}
              </span>
              <span className="min-w-0">
                <span
                  className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase"
                  style={{ letterSpacing: ".08em", color: filled ? "#ffffff" : accent }}
                >
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

      <WeekOverviewChart members={members} targets={targets ?? []} newWeek={newWeek} onSelect={focusRow} />

      <section
        className="rounded-[20px] bg-white p-5 sm:p-7"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
        aria-label="Ugetavle"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-bold" style={{ color: MUTED }}>
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
        </div>

        {newWeek ? (
          <p className="mt-6 text-[15px] font-bold" style={{ color: MUTED }}>
            Ny uge · første status i morgen.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate" style={{ borderSpacing: "0 6px" }}>
              <thead>
                <tr className="text-left text-[11px] font-extrabold uppercase" style={{ color: MUTED, letterSpacing: ".08em" }}>
                  <th className="px-3 py-1">Sælger</th>
                  <th className="px-3 py-1">Ugens salg mod krav</th>
                  <th className="px-3 py-1">Resten af ugen</th>
                  <th className="px-3 py-1">Sidste uger</th>
                </tr>
              </thead>
              {groups.map(({ g, rows }) => {
                if (activeGroup && activeGroup !== g) return null;
                const open = g === "start" || expanded[g];
                const shown = open ? rows : rows.slice(0, PREVIEW);
                return (
                  <tbody key={g}>
                    <tr>
                      <td colSpan={4} className="px-3 pt-3 text-[12px] font-extrabold uppercase" style={{ color: COLOR[g], letterSpacing: ".1em" }}>
                        {GROUP_INFO[g].title} · {rows.length}
                      </td>
                    </tr>
                    {shown.map((m) => {
                      const w = m.week_status as RampWeekStatus;
                      return (
                        <tr
                          key={m.employee_id}
                          id={`ramp-row-${m.employee_id}`}
                          onClick={() => onSelectMember(m.employee_id)}
                          className="cursor-pointer transition-[outline-color] duration-500"
                          style={{
                            background: flash === m.employee_id ? "#fff6d6" : "#f6f8f7",
                            outline: flash === m.employee_id ? `2px solid ${DARK}` : "2px solid transparent",
                          }}
                        >
                          <td className="rounded-l-[12px] border-l-4 px-3 py-2.5" style={{ borderColor: COLOR[g] }}>
                            <SellerCell m={m} w={w} />
                          </td>
                          <td className="px-3 py-2.5">
                            <SalesBar w={w} g={g} />
                          </td>
                          <td className="px-3 py-2.5">
                            <RestCell w={w} g={g} />
                          </td>
                          <td className="rounded-r-[12px] px-3 py-2.5">
                            <HistoryCell w={w} />
                          </td>
                        </tr>
                      );
                    })}
                    {!open && rows.length > PREVIEW && (
                      <tr>
                        <td colSpan={4} className="px-3">
                          <button
                            type="button"
                            onClick={() => setExpanded((e) => ({ ...e, [g]: true }))}
                            className="rounded-full px-3 py-1 text-[12px] font-bold"
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
          der er tilbage. Helligdage trækkes fra. Mandag vises "Ny uge", og første status kommer tirsdag morgen.
        </p>
      </section>
    </div>
  );
}
