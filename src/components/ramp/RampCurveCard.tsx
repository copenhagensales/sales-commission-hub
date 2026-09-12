import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, TrendingUp } from "lucide-react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { useEmployeeRamp, type RampData } from "@/hooks/useEmployeeRamp";

interface RampCurveCardProps {
  /** Undlad for den indloggede bruger selv. */
  employeeId?: string;
  /** Skjul kortet når opstarten er gennemført (bruges på forsiden). */
  hideWhenCompleted?: boolean;
  className?: string;
}

const MILESTONES = [
  { label: "Første salg", target: 1 },
  { label: "10 salg", target: 10 },
  { label: "25 salg", target: 25 },
  { label: "50 salg", target: 50 },
];

const ZONE_FROM = 10;
const ZONE_TO = 25;

export function RampCurveCard({ employeeId, hideWhenCompleted, className }: RampCurveCardProps) {
  const { data, isLoading } = useEmployeeRamp(employeeId);
  const view = useMemo(() => (data ? buildView(data) : null), [data]);

  if (isLoading) {
    return (
      <div className={cn("ramp-start", className)}>
        <div className="rs-card p-5 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!data || !view) return null;
  if (hideWhenCompleted && !data.er_aktiv) return null;

  return (
    <div className={cn("ramp-start", className)}>
      {/* 1) Toplinje */}
      <div className="rs-fade flex items-center gap-2.5 mb-3">
        <span
          className="grid h-7 w-7 place-items-center rounded-[9px]"
          style={{ background: "var(--rs-accent)" }}
        >
          <TrendingUp className="h-4 w-4" style={{ color: "#12321f" }} />
        </span>
        <span className="text-[15px] font-bold tracking-tight">Din opstart</span>
        {data.campaign_name && (
          <span className="text-[12px] truncate" style={{ color: "var(--rs-muted)" }}>
            {data.campaign_name}
          </span>
        )}
      </div>

      {/* 2) Hero */}
      <div
        className="rs-dark rs-fade p-5 sm:p-7"
        style={{ animationDelay: "60ms", borderLeft: "5px solid var(--rs-accent)" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 lg:gap-10">
          <div className="min-w-0">
            <div className="flex items-end gap-3">
              <span
                className="rs-num font-extrabold leading-[0.85] text-[64px] sm:text-[82px]"
                style={{ letterSpacing: "-0.04em" }}
              >
                {view.myTotal}
              </span>
              <span
                className="text-[15px] font-semibold pb-3"
                style={{ color: "var(--rs-on-dark-muted)" }}
              >
                salg
              </span>
            </div>

            <p
              className="mt-3 text-[20px] sm:text-[24px] font-bold leading-snug"
              style={{ color: "var(--rs-accent)", letterSpacing: "-0.02em" }}
            >
              {view.headline}
            </p>

            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--rs-on-dark-muted)" }}>
              Typisk på dag {view.currentDay}: {view.p25}–{view.p75} salg · midt i feltet {view.p50}
            </p>
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="rs-num text-[17px] font-bold">Dag {view.currentDay} af 40</span>
                <span className="text-[12px]" style={{ color: "var(--rs-on-dark-muted)" }}>
                  {view.daysLeft} dage tilbage
                </span>
              </div>
              <div
                className="mt-2.5 h-2 w-full overflow-hidden rounded-full"
                style={{ background: "rgba(230,240,241,0.16)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${view.progressPct}%`,
                    background: "var(--rs-accent)",
                    transition: "width 700ms cubic-bezier(0.22,0.8,0.28,1)",
                  }}
                />
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: "rgba(230,240,241,0.07)" }}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] font-bold tracking-[0.14em]"
                  style={{ color: "var(--rs-on-dark-muted)" }}
                >
                  SIDSTE 7 DAGE
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: "rgba(59,224,134,0.16)", color: "var(--rs-accent)" }}
                >
                  {view.momentumLabel}
                </span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="rs-num text-[30px] font-extrabold leading-none">{view.last7}</span>
                <span className="text-[12px] pb-1" style={{ color: "var(--rs-on-dark-muted)" }}>
                  salg
                </span>
              </div>
              <div className="mt-3 flex h-16 items-end gap-1.5">
                {view.last7Bars.map((bar, i) => (
                  <div
                    key={i}
                    className="flex flex-1 flex-col items-center justify-end"
                    style={{ height: "100%" }}
                  >
                    <span
                      className="rs-num mb-1 text-[11px] font-bold leading-none"
                      style={{ color: bar.value > 0 ? "var(--rs-accent)" : "var(--rs-on-dark-muted)" }}
                    >
                      {bar.value}
                    </span>
                    <div
                      className="rs-bar w-full rounded-[4px]"
                      style={{
                        height: `${Math.max(bar.pct, 6)}%`,
                        background: bar.value > 0 ? "var(--rs-accent)" : "rgba(230,240,241,0.18)",
                        animationDelay: `${180 + i * 55}ms`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3) Kurvekort */}
      <div
        className="rs-card rs-fade mt-4 p-4 sm:p-6"
        style={{ animationDelay: "140ms", borderLeft: "5px solid #2e3136" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.14em]"
              style={{ color: "var(--rs-muted)" }}
            >
              Forløb
            </p>
            <h3 className="text-[18px] font-extrabold tracking-tight">Din kurve mod dag 40</h3>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: "#e8faf0", color: "#13623c" }}
          >
            Prognose: ca. {view.forecast40} salg på dag 40
          </span>
        </div>

        <div className="mt-3 h-64 sm:h-80 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={view.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3eaeb" vertical={false} />
              <XAxis
                dataKey="day_no"
                type="number"
                domain={[1, 40]}
                ticks={[1, 10, 20, 30, 40]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#6b757c" }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickLine={false}
                axisLine={false}
                width={30}
                tick={{ fontSize: 11, fill: "#6b757c" }}
              />
              <ReferenceArea
                x1={ZONE_FROM}
                x2={ZONE_TO}
                fill="#2e3136"
                fillOpacity={0.05}
                label={{
                  value: "OPSTARTSZONEN · DAG 10-25",
                  position: "insideTop",
                  fontSize: 9,
                  fill: "#6b757c",
                  letterSpacing: 1,
                }}
              />
              <ReferenceArea
                x1={ZONE_TO}
                x2={40}
                fill="#3be086"
                fillOpacity={0.06}
                label={{
                  value: "MOMENTUM-ZONEN",
                  position: "insideTop",
                  fontSize: 9,
                  fill: "#13623c",
                  letterSpacing: 1,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e3eaeb",
                  borderRadius: "14px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => `Dag ${label}`}
                formatter={(value: number | number[], name) => {
                  if (name === "band" && Array.isArray(value)) {
                    return [`${Math.round(value[0])}–${Math.round(value[1])}`, "Hvor de fleste ligger"];
                  }
                  if (name === "p50") return [Math.round(Number(value)), "Typisk forløb"];
                  if (name === "mine") return [Number(value), "Dig"];
                  if (name === "forecast") return [`ca. ${Math.round(Number(value))}`, "Din prognose"];
                  return [value as number, String(name)];
                }}
              />
              <Area
                dataKey="band"
                name="band"
                stroke="none"
                fill="#2e3136"
                fillOpacity={0.09}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                dataKey="p50"
                name="p50"
                type="monotone"
                stroke="#8c979d"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="forecast"
                name="forecast"
                type="monotone"
                stroke="#3be086"
                strokeWidth={2.5}
                strokeDasharray="6 6"
                dot={false}
                connectNulls
                animationDuration={900}
              />
              <Line
                dataKey="mine"
                name="mine"
                type="monotone"
                stroke="#2e3136"
                strokeWidth={3}
                dot={false}
                connectNulls={false}
                animationDuration={900}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
          <LegendItem color="#2e3136" label="Dig" />
          <LegendItem color="#3be086" label="Din prognose" dashed />
          <LegendItem color="#8c979d" label="Typisk forløb" />
          <span className="inline-flex items-center gap-2" style={{ color: "var(--rs-muted)" }}>
            <span
              className="h-3 w-5 rounded-[3px]"
              style={{ background: "rgba(46,49,54,0.12)" }}
            />
            Hvor de fleste ligger
          </span>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--rs-muted)" }}>
          {view.zoneText}
        </p>
      </div>

      {/* 4) Din rejse */}
      <div className="rs-card rs-fade mt-4 p-4 sm:p-6" style={{ animationDelay: "200ms" }}>
        <h3 className="text-[16px] font-bold tracking-tight">Din rejse</h3>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {view.milestones.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl px-3.5 py-3"
              style={{
                background: m.reachedDay ? "#e8faf0" : "#f2f6f7",
                border: `1px solid ${m.reachedDay ? "#bfeed4" : "#e3eaeb"}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                  style={{
                    background: m.reachedDay ? "var(--rs-accent)" : "#dde5e7",
                  }}
                >
                  {m.reachedDay ? <Check className="h-3 w-3" style={{ color: "#12321f" }} /> : null}
                </span>
                <span className="text-[13px] font-bold truncate">{m.label}</span>
              </div>
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--rs-muted)" }}>
                {m.reachedDay ? `Nået på dag ${m.reachedDay}` : m.forecastDay
                  ? `Ventes omkring dag ${m.forecastDay}`
                  : "Ligger efter dag 40"}
              </p>
            </div>
          ))}
        </div>

        <div
          className="mt-3 rounded-2xl px-4 py-3.5"
          style={{ background: "#f2f6f7", border: "1px solid #e3eaeb" }}
        >
          <p className="text-[10px] font-bold tracking-[0.14em]" style={{ color: "var(--rs-muted)" }}>
            NÆSTE MILEPÆL
          </p>
          <p className="mt-1 text-[15px] font-bold">{view.nextMilestoneTitle}</p>
          <p className="text-[12.5px]" style={{ color: "var(--rs-muted)" }}>
            {view.nextMilestoneWhen}
          </p>
        </div>

        {data.n_sellers ? (
          <p className="mt-3 text-[11px]" style={{ color: "var(--rs-muted)" }}>
            Spændet bygger på {data.n_sellers} sælgere, der har været gennem de første 40 dage.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ color: "var(--rs-muted)" }}>
      <span
        className="h-0 w-5"
        style={{
          borderTop: `${dashed ? "2px dashed" : "3px solid"} ${color}`,
        }}
      />
      {label}
    </span>
  );
}

function cumAt(map: Map<number, number>, day: number) {
  if (day <= 0) return 0;
  for (let d = day; d >= 1; d--) {
    const v = map.get(d);
    if (v != null) return v;
  }
  return 0;
}

function buildView(data: RampData) {
  const myByDay = new Map(data.my_days.map((d) => [d.day_no, Number(d.cum_sales)]));
  const lastPoint = data.my_days.length ? Math.max(...data.my_days.map((d) => d.day_no)) : 0;
  const currentDay = Math.min(Math.max(data.current_day_no || lastPoint || 1, 1), 40);
  const myTotal = cumAt(myByDay, lastPoint);

  const bandByDay = new Map(data.band.map((b) => [b.day_no, b]));
  const bandNow = bandByDay.get(currentDay) ?? data.band[data.band.length - 1];
  const p25 = Math.round(Number(bandNow?.p25 ?? 0));
  const p50 = Math.round(Number(bandNow?.p50 ?? 0));
  const p75 = Math.round(Number(bandNow?.p75 ?? 0));

  // ── Sidste 7 dage vs. de 7 foregående ──────────────────────────────
  const refDay = Math.max(lastPoint, 1);
  const last7 = cumAt(myByDay, refDay) - cumAt(myByDay, refDay - 7);
  const prev7 = cumAt(myByDay, refDay - 7) - cumAt(myByDay, refDay - 14);
  const dailyValues: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = refDay - i;
    dailyValues.push(day >= 1 ? cumAt(myByDay, day) - cumAt(myByDay, day - 1) : 0);
  }
  const maxDaily = Math.max(1, ...dailyValues);
  const last7Bars = dailyValues.map((value) => ({ value, pct: (value / maxDaily) * 100 }));
  const momentumLabel =
    last7 > prev7 ? "Stigende" : last7 === prev7 && last7 > 0 ? "Stabilt" : last7 > 0 ? "I gang" : "Klar til gang";

  // ── Prognose: medianens vækstform fra sælgerens punkt, skaleret ─────
  const p50Now = Number(bandNow?.p50 ?? 0);
  const scale = Math.min(1.6, Math.max(0.55, p50Now > 0 ? myTotal / p50Now : 1));
  const forecastAt = (day: number) => {
    const b = bandByDay.get(day);
    if (!b) return null;
    const growth = Math.max(0, Number(b.p50) - p50Now);
    return myTotal + growth * scale;
  };
  const forecast40 = Math.round(forecastAt(40) ?? myTotal);

  // ── Graf ───────────────────────────────────────────────────────────
  const chartData = data.band.map((b) => ({
    day_no: b.day_no,
    band: [Number(b.p25), Number(b.p75)] as [number, number],
    p50: Number(b.p50),
    mine: b.day_no <= lastPoint && myByDay.has(b.day_no) ? myByDay.get(b.day_no) : null,
    forecast: b.day_no >= currentDay ? forecastAt(b.day_no) : null,
  }));

  // ── Milepæle ───────────────────────────────────────────────────────
  const minePoints = data.my_days
    .slice()
    .sort((a, b) => a.day_no - b.day_no)
    .map((d) => ({ day_no: d.day_no, value: Number(d.cum_sales) }));
  const milestones = MILESTONES.map((m) => {
    const reached = minePoints.find((p) => p.value >= m.target);
    const forecastHit = !reached
      ? data.band.find((b) => b.day_no >= currentDay && (forecastAt(b.day_no) ?? 0) >= m.target)
      : undefined;
    return {
      label: m.label,
      target: m.target,
      reachedDay: reached ? reached.day_no : null,
      forecastDay: forecastHit ? forecastHit.day_no : null,
    };
  });
  const next = milestones.find((m) => !m.reachedDay);
  const nextMilestoneTitle = next ? next.label : "Alle milepæle er nået";
  const gapToNext = next ? Math.max(0, next.target - myTotal) : 0;
  const nextMilestoneWhen = next
    ? next.forecastDay
      ? `${gapToNext} salg igen · ventes omkring dag ${next.forecastDay}`
      : `${gapToNext} salg igen`
    : "Flot forløb hele vejen gennem de 40 dage";

  // ── Hovedlinjen ────────────────────────────────────────────────────
  const headline = buildHeadline({
    myTotal,
    currentDay,
    p25,
    p50,
    p75,
    last7,
    prev7,
    gapToNext,
    nextLabel: next?.label ?? null,
  });

  // ── Zonetekst ──────────────────────────────────────────────────────
  const zoneText =
    currentDay < ZONE_FROM
      ? "Opstartszonen (dag 10-25) er der, hvor de fleste bygger deres rutiner op. Du er på vej derind, og kurven stiger typisk hurtigere bagefter."
      : currentDay <= ZONE_TO
        ? "I opstartszonen (dag 10-25) bygger de fleste deres rutiner op — du er inde i den nu, og kurven stiger typisk hurtigere herfra."
        : "I opstartszonen (dag 10-25) bygger de fleste deres rutiner op — du er igennem den, og kurven stiger typisk hurtigere herfra.";

  return {
    chartData,
    currentDay,
    daysLeft: Math.max(0, 40 - currentDay),
    progressPct: Math.min(100, Math.round((currentDay / 40) * 100)),
    myTotal,
    p25,
    p50,
    p75,
    last7,
    last7Bars,
    momentumLabel,
    forecast40,
    milestones,
    nextMilestoneTitle,
    nextMilestoneWhen,
    headline,
    zoneText,
  };
}

function buildHeadline(input: {
  myTotal: number;
  currentDay: number;
  p25: number;
  p50: number;
  p75: number;
  last7: number;
  prev7: number;
  gapToNext: number;
  nextLabel: string | null;
}) {
  const { myTotal, currentDay, p25, p50, p75, last7, prev7, gapToNext, nextLabel } = input;

  // På eller over medianen → percentillinje (aldrig under 5 af 10).
  if (myTotal >= p50) {
    if (myTotal > p75) {
      const tenths = Math.min(9, Math.max(8, Math.round(interpolatePercentile(myTotal, p25, p50, p75) / 10)));
      return `Du er blandt de stærkeste på dag ${currentDay} — over ${tenths} af 10 sælgere`;
    }
    const tenths = Math.min(7, Math.max(5, Math.round(interpolatePercentile(myTotal, p25, p50, p75) / 10)));
    return `Du ligger over ${tenths} af 10 sælgere på dag ${currentDay}`;
  }

  // Mellem p25 og medianen.
  if (myTotal >= p25) {
    return `Du ligger midt i feltet på dag ${currentDay}`;
  }

  // Under p25 → intet percentiltal, kun sande udsagn om sælgeren selv.
  if (last7 > prev7 && last7 > 0) {
    return `Din bedste uge indtil nu — ${last7} salg de sidste 7 dage`;
  }
  if (last7 > 0) {
    return `${last7} salg de sidste 7 dage`;
  }
  if (nextLabel && gapToNext > 0 && gapToNext <= 5) {
    return `${gapToNext} salg fra din næste milepæl`;
  }
  return "Dag 10 til 25 er der, hvor de fleste bygger rutinerne op";
}

/** Grov percentilplacering i båndet: p25→25, p50→50, p75→75, derover mod 95. */
function interpolatePercentile(value: number, p25: number, p50: number, p75: number) {
  if (value <= p25) return 25;
  if (value <= p50) return p50 === p25 ? 50 : 25 + ((value - p25) / (p50 - p25)) * 25;
  if (value <= p75) return p75 === p50 ? 75 : 50 + ((value - p50) / (p75 - p50)) * 25;
  const span = Math.max(1, p75 - p50);
  return Math.min(95, 75 + ((value - p75) / span) * 20);
}
