import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, TrendingUp, Minus, Check, Clock } from "lucide-react";
import {
  RAMP_WEEKLY_ABSENCE,
  RAMP_WEEKLY_COACHING,
  RAMP_WEEKLY_LISTEN,
  formatRiskStatShort,
  useCanViewRampTeam,
  useLogRampAction,
  useRampRiskStats,
  useRampTeamOverview,
  type RampTeamMember,
  type RampWeekPoint,
} from "@/hooks/useRampTeam";
import { getInitials } from "@/utils/formatting";

type FilterMode = "danger" | "missing";

const STATUS_ORDER: Record<string, number> = { under: 0, ukendt: 1, midt: 2, over: 3 };

function trendOf(weeks: RampWeekPoint[]): { icon: typeof TrendingUp; label: string; tone: string } {
  const recent = weeks.slice(-2);
  if (recent.length < 2) {
    return { icon: Minus, label: "For tidligt at se en tendens", tone: "var(--ramp-muted)" };
  }
  const [prev, last] = recent;
  if (last.sales > prev.sales) {
    return { icon: TrendingUp, label: "Stigende de sidste to uger", tone: "var(--ramp-green)" };
  }
  if (last.sales < prev.sales) {
    return { icon: TrendingDown, label: "Faldende de sidste to uger", tone: "var(--ramp-red)" };
  }
  return { icon: Minus, label: "Uændret de sidste to uger", tone: "var(--ramp-yellow)" };
}

function gapLabel(member: RampTeamMember): string {
  if (member.p25 === null || member.p75 === null) return "Intet spænd endnu";
  if (member.cum_sales < member.p25) {
    return `${Math.round(member.p25 - member.cum_sales)} salg fra spændet`;
  }
  if (member.cum_sales > member.p75) {
    return `${Math.round(member.cum_sales - member.p75)} salg over spændet`;
  }
  return "Inde i spændet";
}

function headline(member: RampTeamMember): { mark: string; title: string; sub: string } {
  if (member.status === "under") {
    return {
      mark: "var(--ramp-red)",
      title: "Under det typiske niveau",
      sub: "1-1 coaching og 1-1 lyt hver uge, indtil han er inde i spændet.",
    };
  }
  if (member.status === "over") {
    return {
      mark: "var(--ramp-green)",
      title: "Over det typiske niveau",
      sub: "Ingen handling nødvendig ud over ugens faste forløb.",
    };
  }
  if (member.status === "midt") {
    return {
      mark: "var(--ramp-green-strong)",
      title: "Inde i det typiske spænd",
      sub: "Hold ugens faste forløb, så han bliver der.",
    };
  }
  return {
    mark: "var(--ramp-yellow)",
    title: "Endnu uden grundlag",
    sub: "Der er ikke nok data på dagen til at vurdere niveauet.",
  };
}

function WeeklyBars({ weeks }: { weeks: RampWeekPoint[] }) {
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.sales, w.p75)));
  const last = weeks[weeks.length - 1];
  return (
    <div>
      <p className="text-[13px] font-semibold" style={{ color: "var(--ramp-ink)" }}>
        Salg pr. uge mod typisk spænd
      </p>
      <div className="mt-2 flex items-end gap-3" style={{ height: 96 }}>
        {weeks.map((w) => {
          const bottom = (w.p25 / max) * 100;
          const bandHeight = Math.max(2, ((w.p75 - w.p25) / max) * 100);
          const barHeight = Math.max(2, (w.sales / max) * 100);
          const median = (w.p50 / max) * 100;
          return (
            <div key={`${w.iso_year}-${w.iso_week}`} className="flex-1 text-center">
              <div className="relative w-full" style={{ height: 76 }}>
                <div
                  className="absolute inset-x-0 rounded-[3px] border border-dashed"
                  style={{
                    bottom: `${bottom}%`,
                    height: `${bandHeight}%`,
                    borderColor: "var(--ramp-green-line)",
                    background: "var(--ramp-green-flat-2)",
                  }}
                />
                <div
                  className="absolute inset-x-0"
                  style={{ bottom: `${median}%`, height: 1, background: "var(--ramp-green-line)" }}
                />
                <div
                  className="absolute bottom-0 left-1/2 w-3 -translate-x-1/2 rounded-t-[3px]"
                  style={{
                    height: `${barHeight}%`,
                    background: w.sales < w.p25 ? "var(--ramp-red)" : "var(--ramp-green)",
                  }}
                />
              </div>
              <p className="mt-1 text-[11px]" style={{ color: "var(--ramp-muted)" }}>
                U{w.iso_week}
              </p>
              <p className="text-[11px] font-semibold" style={{ color: "var(--ramp-ink)" }}>
                {w.sales}
              </p>
            </div>
          );
        })}
      </div>
      {last && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--ramp-muted)" }}>
          Stiplet felt = typisk spænd {Math.round(last.p25)}–{Math.round(last.p75)} · median{" "}
          {Math.round(last.p50)}
        </p>
      )}
    </div>
  );
}

function ProgramRow({
  label,
  done,
  onRegister,
  disabled,
}: {
  label: string;
  done: boolean;
  onRegister: () => void;
  disabled: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-3 py-2"
      style={{
        borderColor: done ? "var(--ramp-green-line)" : "var(--ramp-surface-2)",
        background: done ? "var(--ramp-green-flat)" : "var(--ramp-surface-3)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: done ? "var(--ramp-green)" : "var(--ramp-surface-2)" }}
        >
          {done ? (
            <Check className="h-3 w-3" style={{ color: "#fff" }} />
          ) : (
            <Clock className="h-3 w-3" style={{ color: "var(--ramp-muted)" }} />
          )}
        </span>
        <span className="text-[13px] font-medium" style={{ color: "var(--ramp-ink)" }}>
          {label}
        </span>
      </div>
      {done ? (
        <span className="text-[12px] font-semibold" style={{ color: "var(--ramp-green-strong)" }}>
          Afviklet
        </span>
      ) : (
        <button
          type="button"
          onClick={onRegister}
          disabled={disabled}
          className="text-[12px] font-semibold underline disabled:opacity-50"
          style={{ color: "var(--ramp-green-strong)" }}
        >
          Registrér
        </button>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: RampTeamMember }) {
  const logAction = useLogRampAction();
  const trend = trendOf(member.weeks);
  const head = headline(member);
  const TrendIcon = trend.icon;

  return (
    <article
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--ramp-surface-2)", background: "#fff" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ background: "var(--ramp-surface)", color: "var(--ramp-ink)" }}
          >
            {getInitials(member.employee_name)}
          </span>
          <div>
            <p className="text-[15px] font-bold" style={{ color: "var(--ramp-ink)" }}>
              {member.employee_name}
            </p>
            <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
              {[member.team_name, member.campaign_name].filter(Boolean).join(" · ") || "Uden team"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-[12px] font-semibold" style={{ color: trend.tone }}>
            <TrendIcon className="h-3.5 w-3.5" />
            {trend.label}
          </p>
          <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
            {gapLabel(member)}
          </p>
        </div>
      </div>

      <div
        className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2"
        style={{ background: member.status === "under" ? "var(--ramp-red-flat)" : "var(--ramp-green-flat)" }}
      >
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: head.mark }} />
        <div>
          <p className="text-[13px] font-bold" style={{ color: "var(--ramp-ink)" }}>
            {head.title}
          </p>
          <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
            {head.sub}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[12px]" style={{ color: "var(--ramp-muted)" }}>
        <span className="font-semibold" style={{ color: "var(--ramp-ink)" }}>
          Dag {member.day_no} af 40
        </span>
        <span>{member.days_left} dage tilbage</span>
        <span>{member.cum_sales} salg i alt</span>
      </div>

      <div className="mt-4">
        <WeeklyBars weeks={member.weeks} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold" style={{ color: "var(--ramp-ink)" }}>
            Ugens faste forløb
          </p>
          <span className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
            Uge {member.iso_week}
          </span>
        </div>
        {member.has_absence ? (
          <p
            className="mt-2 rounded-lg px-3 py-2 text-[12px]"
            style={{ background: "var(--ramp-surface-3)", color: "var(--ramp-muted)" }}
          >
            Registreret fravær hele ugen — ugen er afsluttet.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <ProgramRow
              label="1-1 coaching"
              done={member.has_coaching}
              disabled={logAction.isPending}
              onRegister={() =>
                logAction.mutate({
                  employeeId: member.employee_id,
                  actionType: RAMP_WEEKLY_COACHING,
                  flagId: member.flag_id,
                })
              }
            />
            <ProgramRow
              label="1-1 lyt"
              done={member.has_listen}
              disabled={logAction.isPending}
              onRegister={() =>
                logAction.mutate({
                  employeeId: member.employee_id,
                  actionType: RAMP_WEEKLY_LISTEN,
                  flagId: member.flag_id,
                })
              }
            />
            {!member.week_required && (
              <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                Under 2 arbejdsdage i ugen — forløbet er ikke krævet.
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
              className="text-[12px] underline disabled:opacity-50"
              style={{ color: "var(--ramp-muted)" }}
            >
              Registrér fravær hele ugen
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
          Effekt over 6 uger
        </p>
        <div className="mt-1 flex items-end gap-1" style={{ height: 24 }}>
          {member.weeks.map((w) => (
            <span
              key={`line-${w.iso_year}-${w.iso_week}`}
              className="flex-1 rounded-[2px]"
              style={{
                height: `${Math.max(8, Math.min(100, (w.sales / Math.max(1, ...member.weeks.map((x) => x.sales))) * 100))}%`,
                background: w.sales < w.p25 ? "var(--ramp-red-strong)" : "var(--ramp-green)",
              }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export default function RampTeam() {
  const { data: canView, isLoading: accessLoading } = useCanViewRampTeam();
  const { data: members = [], isLoading } = useRampTeamOverview();
  const { data: stats = [] } = useRampRiskStats();
  const [filter, setFilter] = useState<FilterMode>("danger");

  const isoWeek = members[0]?.iso_week ?? null;

  const dangerList = useMemo(
    () =>
      members
        .slice()
        .sort((a, b) => {
          const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
          if (s !== 0) return s;
          const missingA = a.week_required && !a.week_complete ? 0 : 1;
          const missingB = b.week_required && !b.week_complete ? 0 : 1;
          if (missingA !== missingB) return missingA - missingB;
          return a.employee_name.localeCompare(b.employee_name, "da");
        }),
    [members],
  );

  const missingList = useMemo(
    () => dangerList.filter((m) => m.week_required && !m.week_complete),
    [dangerList],
  );

  const counts = useMemo(() => {
    const danger = members.filter((m) => m.status === "under").length;
    const good = members.filter((m) => m.status === "midt" || m.status === "over").length;
    const pending = members.filter((m) => m.status === "ukendt").length;
    return { danger, good, pending, missing: missingList.length, total: members.length };
  }, [members, missingList.length]);

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

  return (
    <MainLayout>
      <div className="ramp-page" style={{ background: "var(--ramp-surface)" }}>
        <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
          <header>
            <h1 className="text-2xl font-extrabold" style={{ color: "var(--ramp-ink)" }}>
              Opstartshold
            </h1>
            <p className="text-[13px]" style={{ color: "var(--ramp-muted)" }}>
              Uge {isoWeek ?? "-"} · første 40 arbejdsdage
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => setFilter("danger")}
                className="h-9 rounded-full border px-4 text-[13px] font-semibold"
                style={{
                  borderColor: filter === "danger" ? "var(--ramp-green)" : "var(--ramp-surface-2)",
                  background: filter === "danger" ? "var(--ramp-green-flat)" : "#fff",
                  color: "var(--ramp-ink)",
                }}
              >
                Alle i farezonen · {counts.danger}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFilter("missing")}
                className="h-9 rounded-full border px-4 text-[13px] font-semibold"
                style={{
                  borderColor: filter === "missing" ? "var(--ramp-green)" : "var(--ramp-surface-2)",
                  background: filter === "missing" ? "var(--ramp-green-flat)" : "#fff",
                  color: "var(--ramp-ink)",
                }}
              >
                Mangler forløb i uge {isoWeek ?? "-"} · {counts.missing}
              </Button>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--ramp-surface-2)", background: "#fff" }}>
              <p className="text-[12px] font-semibold" style={{ color: "var(--ramp-muted)" }}>
                I farezonen
              </p>
              <p className="text-3xl font-extrabold" style={{ color: "var(--ramp-red)" }}>
                {counts.danger}
              </p>
              <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                af {counts.total} sælgere
              </p>
              <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--ramp-ink)" }}>
                {counts.missing} mangler ugens forløb
              </p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--ramp-surface-2)", background: "#fff" }}>
              <p className="text-[12px] font-semibold" style={{ color: "var(--ramp-muted)" }}>
                Ser godt ud
              </p>
              <p className="text-3xl font-extrabold" style={{ color: "var(--ramp-green)" }}>
                {counts.good}
              </p>
              <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                på eller over typisk
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                Ingen handling nødvendig
              </p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--ramp-surface-2)", background: "#fff" }}>
              <p className="text-[12px] font-semibold" style={{ color: "var(--ramp-muted)" }}>
                Stadig undervejs
              </p>
              <p className="text-3xl font-extrabold" style={{ color: "var(--ramp-yellow)" }}>
                {counts.pending}
              </p>
              <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                mod dag 40
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                Tælles ikke med endnu
              </p>
            </div>
          </div>

          {stats.length > 0 && (
            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: "var(--ramp-green-line)", background: "var(--ramp-green-flat)" }}
            >
              {(() => {
                const day10 = stats.find((s) => s.day_no === 10);
                if (!day10 || day10.n_below === 0 || day10.n_above === 0) return null;
                const below = Math.round((day10.n_below_stopped / day10.n_below) * 100);
                const above = Math.round((day10.n_above_stopped / day10.n_above) * 100);
                return (
                  <p className="text-[13px] font-bold" style={{ color: "var(--ramp-ink)" }}>
                    Under typisk på dag 10 → {below} % ({day10.n_below_stopped} af {day10.n_below})
                    stopper inden dag 40. På eller over → {above} % ({day10.n_above_stopped} af{" "}
                    {day10.n_above}).
                  </p>
                );
              })()}
              <ul className="mt-2 space-y-1 text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                {stats.map((s) => {
                  const line = formatRiskStatShort(s);
                  return line ? <li key={s.day_no}>{line}</li> : null;
                })}
                <li>Lille grundlag — tallene kan flytte sig</li>
                <li>Gælder grupper, ikke enkeltpersoner</li>
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--ramp-ink)" }}>
                Under niveau = 1-1 coaching og 1-1 lyt hver uge, indtil de er inde i spændet.
              </p>
              <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                Sorteret efter hastende først
              </p>
            </div>

            {list.length === 0 ? (
              <div
                className="rounded-2xl border p-6 text-center"
                style={{ borderColor: "var(--ramp-surface-2)", background: "#fff" }}
              >
                <p className="text-[14px] font-bold" style={{ color: "var(--ramp-ink)" }}>
                  Alle forløb er afviklet i uge {isoWeek ?? "-"}
                </p>
                <p className="text-[12px]" style={{ color: "var(--ramp-muted)" }}>
                  Skift til "Alle i farezonen" for at se holdet.
                </p>
              </div>
            ) : (
              list.map((member) => <MemberCard key={member.employee_id} member={member} />)
            )}
          </section>

          <p className="pb-4 text-[12px]" style={{ color: "var(--ramp-muted)" }}>
            Forløbet kører indtil sælgeren er inde i det typiske spænd. Det er en samtale der
            mangler — ikke en vurdering af sælgeren.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
