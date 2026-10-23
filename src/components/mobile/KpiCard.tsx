import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

/** KPI-kort. Læg flere i `KpiGrid`, så de stables på telefon. */
export function KpiCard({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-border bg-card p-4", className)}>
      <p className="text-[14px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-[14px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Gitter til KPI-kort: én kolonne på telefon. */
export function KpiGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const md = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }[cols];
  return <div className={cn("grid grid-cols-1 gap-3", md)}>{children}</div>;
}

interface ChartFrameProps {
  title: string;
  /** Selve grafen (fx en recharts ResponsiveContainer). Brug Tooltip med trigger="click" for tryk-tooltip. */
  children: ReactNode;
  /** Tallene bag grafen, vist som liste under grafen. */
  data: { label: string; value: ReactNode }[];
  height?: number;
}

/** Indpakning til grafer: fast højde (ingen layout-hop) og »Vis som liste« under grafen. */
export function ChartFrame({ title, children, data, height = 240 }: ChartFrameProps) {
  const [asList, setAsList] = useState(false);
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-4" aria-label={title}>
      <h3 className="mb-2 text-[16px] font-bold">{title}</h3>
      <div style={{ height }} className="w-full min-w-0">{children}</div>
      <button type="button" onClick={() => setAsList((v) => !v)} aria-expanded={asList}
        className="mt-2 min-h-[44px] rounded-full px-3 text-[14px] font-semibold text-primary active:opacity-70">
        {asList ? "Skjul liste" : "Vis som liste"}
      </button>
      {asList && (
        <dl className="mt-1 divide-y divide-border">
          {data.map((d) => (
            <div key={d.label} className="flex justify-between gap-3 py-2 text-[15px]">
              <dt className="text-muted-foreground">{d.label}</dt>
              <dd className="font-semibold tabular-nums">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
