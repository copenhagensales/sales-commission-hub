import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { RampFullTeamMember } from "@/hooks/useRampTeam";
import { isoWeekOf, weekdayName } from "@/lib/rampWeek";
import {
  COACHING,
  coverage,
  lastFullWeeks,
  seniority,
  sortByLongestSince,
  weeksAgoLabel,
} from "@/lib/rampEstablished";
import { oneOnOneOf } from "./RampOverviewMatrix";

/**
 * Etablerede saelgere (efter de foerste 40 arbejdsdage).
 * Ingen salgsstatus, intet krav og ingen alarm — kun 1-1 og feedback.
 */

const DARK = "#1b1f1d";
const MUTED = "#57635e";
const GREEN = "#177a4d";
const SHOWN = 5;

type Member = RampFullTeamMember & { start_date?: string | null };

function latestFeedback(m: Member) {
  const a = m.actions.find((x) => x.action_type === COACHING && x.note && x.note.trim());
  if (!a) return null;
  const { week } = isoWeekOf(new Date(a.performed_at));
  const focus = a.focus_area?.trim();
  return { a, text: [weeksAgoLabel(a.performed_at), `uge ${week}`, focus ? `fokus: ${focus}` : null].filter(Boolean).join(" · ") };
}

function WeekSquares({ m }: { m: Member }) {
  const rows = lastFullWeeks(m.weeks, m.actions);
  return (
    <div className="flex gap-1">
      {rows.map((w) => {
        const label =
          w.state === "held" ? `Uge ${w.iso_week}: 1-1 holdt` : w.state === "absence" ? `Uge ${w.iso_week}: fravær` : `Uge ${w.iso_week}: ingen 1-1`;
        return (
          <span
            key={`${w.iso_year}-${w.iso_week}`}
            title={label}
            aria-label={label}
            className="inline-block h-[14px] w-[14px] rounded-[3px] border"
            style={{
              background: w.state === "held" ? GREEN : "#ffffff",
              borderColor: w.state === "held" ? GREEN : "#c9d2ce",
            }}
          />
        );
      })}
    </div>
  );
}

function OneCell({ m, pending, onHold }: { m: Member; pending: boolean; onHold: (m: Member) => void }) {
  const one = oneOnOneOf(m, pending);
  if (one.kind === "held")
    return (
      <span className="text-[13px] font-extrabold" style={{ color: GREEN }}>
        ✓ Holdt {one.weekday}
      </span>
    );
  if (one.kind === "absence")
    return (
      <span className="text-[13px] font-bold" style={{ color: "#8b958f" }}>
        Fravær
      </span>
    );
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onHold(m);
      }}
      className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white"
      style={{ background: DARK }}
    >
      Hold 1-1
    </button>
  );
}

export function RampEstablishedSection({
  members,
  matches,
  pendingAbsence,
  onHold,
  onAbsence,
  onExclude,
}: {
  members: Member[];
  matches: (m: { employee_name: string }) => boolean;
  pendingAbsence: Set<string>;
  onHold: (m: Member, done: boolean) => void;
  onAbsence: (m: Member) => void;
  onExclude: (m: Member) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const sorted = useMemo(() => sortByLongestSince(members), [members]);
  const n = members.length;
  const heldNow = members.filter((m) => m.has_coaching).length;
  const cov = useMemo(() => coverage(members.map((m) => lastFullWeeks(m.weeks, m.actions))), [members]);
  const visible = sorted.filter(matches);
  const rows = showAll ? visible : visible.slice(0, SHOWN);
  const panel = members.find((m) => m.employee_id === panelId) ?? null;

  return (
    <section className="rounded-[20px] bg-white p-5 sm:p-7" style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[19px] font-extrabold" style={{ color: DARK, letterSpacing: "-.02em" }}>
            Etablerede sælgere · {n}
          </p>
          <p className="mt-1 text-[13px] font-semibold" style={{ color: MUTED }}>
            Efter de første 40 arbejdsdage. Ingen salgsstatus og intet krav, kun 1-1 og feedback.
          </p>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-[22px] font-extrabold tabular-nums" style={{ color: DARK }}>
              {heldNow} af {n}
            </p>
            <p className="text-[12px] font-semibold" style={{ color: MUTED }}>
              har fået 1-1 i denne uge
            </p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-extrabold tabular-nums" style={{ color: DARK }}>
              {cov.pct === null ? "–" : `${cov.pct} %`}
            </p>
            <p className="text-[12px] font-semibold" style={{ color: MUTED }}>
              1-1 dækning, sidste 4 uger
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="text-[11px] font-extrabold uppercase" style={{ color: MUTED, letterSpacing: ".1em" }}>
              <th className="py-2 pr-3">Sælger</th>
              <th className="py-2 pr-3">Ugens 1-1</th>
              <th className="py-2 pr-3">Sidste 4 uger</th>
              <th className="py-2">Seneste feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const sen = m.day_no <= 0 ? "Ikke startet endnu" : m.day_no <= 45 ? "Ny etableret" : seniority(m.start_date);
              const fb = latestFeedback(m);
              return (
                <tr
                  key={m.employee_id}
                  onClick={() => setPanelId(m.employee_id)}
                  className="cursor-pointer border-t hover:bg-[#f6f9f8]"
                  style={{ borderColor: "#eef2f0" }}
                >
                  <td className="py-3 pr-3">
                    <p className="text-[14px] font-extrabold" style={{ color: DARK }}>
                      {m.employee_name}
                    </p>
                    <p className="text-[12px] font-semibold" style={{ color: MUTED }}>
                      {[m.campaign_name, sen].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <OneCell m={m} pending={pendingAbsence.has(m.employee_id)} onHold={(x) => onHold(x, false)} />
                  </td>
                  <td className="py-3 pr-3">
                    <WeekSquares m={m} />
                  </td>
                  <td className="py-3 text-[12px] font-semibold" style={{ color: MUTED }}>
                    {fb ? fb.text : "Ingen feedback endnu"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-[13px] font-semibold" style={{ color: MUTED }}>
                  Ingen etablerede sælgere matcher.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold" style={{ color: MUTED }}>
          Sorteret efter længst tid siden seneste 1-1
        </p>
        {visible.length > SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-full px-3 py-1 text-[12px] font-bold"
            style={{ background: "#f1f4f3", color: DARK }}
          >
            {showAll ? "Vis færre" : `Vis alle ${visible.length} etablerede`}
          </button>
        )}
      </div>

      <Sheet open={!!panel} onOpenChange={(o) => !o && setPanelId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
          {panel && (
            <EstablishedPanel
              m={panel}
              pending={pendingAbsence.has(panel.employee_id)}
              onHold={(done) => {
                setPanelId(null);
                onHold(panel, done);
              }}
              onAbsence={() => onAbsence(panel)}
              onExclude={() => {
                setPanelId(null);
                onExclude(panel);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function EstablishedPanel({
  m,
  pending,
  onHold,
  onAbsence,
  onExclude,
}: {
  m: Member;
  pending: boolean;
  onHold: (done: boolean) => void;
  onAbsence: () => void;
  onExclude: () => void;
}) {
  const one = oneOnOneOf(m, pending);
  const notes = m.actions.filter((a) => a.action_type === COACHING && a.note && a.note.trim()).slice(0, 3);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-6 pb-6">
      <SheetHeader className="text-left">
        <SheetTitle className="text-[24px] font-extrabold" style={{ color: DARK }}>
          {m.employee_name}
        </SheetTitle>
        <SheetDescription className="text-[13px] font-semibold" style={{ color: MUTED }}>
          {[m.campaign_name, "Etableret sælger"].filter(Boolean).join(" · ")}
        </SheetDescription>
      </SheetHeader>

      <section className="space-y-3 rounded-[16px] border p-4" style={{ background: "#f6f9f8", borderColor: "#e7eeeb" }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-extrabold uppercase" style={{ color: MUTED, letterSpacing: ".12em" }}>
            Ugens 1-1
          </p>
          <span className="text-[13px] font-extrabold" style={{ color: one.kind === "held" ? GREEN : MUTED }}>
            {one.kind === "held" ? `✓ Holdt ${one.weekday}` : one.kind === "absence" ? "Fravær hele ugen" : "Ikke holdt endnu"}
          </span>
        </div>
        {one.kind !== "absence" && (
          <button
            type="button"
            onClick={() => onHold(one.kind === "held")}
            className="w-full rounded-full px-4 py-3 text-[14px] font-extrabold text-white"
            style={{ background: one.kind === "held" ? GREEN : DARK }}
          >
            {one.kind === "held" ? "Tilføj ekstra 1-1" : "Hold 1-1 og send feedback"}
          </button>
        )}
        {one.kind !== "held" && one.kind !== "absence" && (
          <button type="button" onClick={onAbsence} className="text-[12px] font-semibold underline" style={{ color: MUTED }}>
            Registrér fravær hele ugen
          </button>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-extrabold uppercase" style={{ color: MUTED, letterSpacing: ".12em" }}>
          Seneste feedback
        </p>
        {notes.length === 0 ? (
          <p className="text-[13px] font-semibold" style={{ color: MUTED }}>
            Ingen feedback sendt endnu.
          </p>
        ) : (
          notes.map((a, i) => {
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
                  {weeksAgoLabel(a.performed_at)} · {weekdayName(a.performed_at)}
                  {a.performed_by_name ? ` · af ${a.performed_by_name}` : ""}
                </span>
                {open === i && (
                  <span className="mt-2 block whitespace-pre-wrap text-[12px]" style={{ color: DARK }}>
                    {a.note}
                  </span>
                )}
              </button>
            );
          })
        )}
      </section>

      <button type="button" onClick={onExclude} className="text-[12px] font-semibold underline" style={{ color: "#8b958f" }}>
        Skal ikke have feedback
      </button>
    </div>
  );
}
