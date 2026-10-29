// D0: kort med 24 px-runding i tre toner (lys = hvidt, moerk = onyx som hero-kortet, blaa = lys blå flade).
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = {
  lys: "bg-card text-card-foreground",
  moerk: "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]",
  blaa: "bg-[hsl(var(--cph-light-blue))] text-foreground",
} as const;
const POLSTRING = { normal: "p-5 md:p-6", taet: "p-4", ingen: "" } as const;

export function Kort({ tone = "lys", polstring = "normal", className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof TONE; polstring?: keyof typeof POLSTRING }) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl", TONE[tone], POLSTRING[polstring], className)} {...rest}>
      {children}
    </div>
  );
}

export function KortTitel({ children, hoejre, className }: { children: ReactNode; hoejre?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h3 className="text-[16px] font-extrabold leading-tight">{children}</h3>
      {hoejre}
    </div>
  );
}
