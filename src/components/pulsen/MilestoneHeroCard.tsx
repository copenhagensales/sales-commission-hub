import type { ReactNode } from "react";

interface MilestoneHeroCardProps {
  value: string;
  unit?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}

/** Stor milepæl (fx Klub eller husrekord). Data kommer i trin 6. */
export function MilestoneHeroCard({ value, unit, eyebrow, title, subtitle, footer }: MilestoneHeroCardProps) {
  return (
    <div className="rounded-[24px] bg-[hsl(var(--cph-onyx))] p-5 text-[hsl(var(--cph-light-blue))]">
      <div className="flex items-center gap-4">
        <div className="flex h-[88px] w-[88px] flex-none flex-col items-center justify-center rounded-[22px] bg-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-onyx))]">
          <span className="text-[30px] font-black leading-none tabular-nums tracking-[-0.03em]">{value}</span>
          {unit && <span className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">{unit}</span>}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--cph-emerald))]">{eyebrow}</p>
          <h3 className="mt-1 text-[20px] font-black leading-tight">{title}</h3>
          {subtitle && <p className="mt-1 text-[14px] opacity-75">{subtitle}</p>}
        </div>
      </div>
      {footer && <div className="mt-4 border-t border-[hsl(var(--cph-light-blue)/0.15)] pt-2">{footer}</div>}
    </div>
  );
}
