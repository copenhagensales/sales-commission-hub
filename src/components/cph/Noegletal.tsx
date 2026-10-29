// D0: nøgletal (fliser), det store tal (hero) og fremdriftsbjælke – fra hero-kortet på Hjem.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Etiket } from "./Side";

export function Noegletal({ etiket, vaerdi, note, tone = "lys", fremhaev = false, className }: {
  etiket: ReactNode; vaerdi: ReactNode; note?: ReactNode; tone?: "lys" | "blaa" | "moerk"; fremhaev?: boolean; className?: string;
}) {
  const moerk = tone === "moerk";
  return (
    <div className={cn("min-w-0 rounded-2xl p-4", tone === "lys" ? "bg-card" : tone === "blaa" ? "bg-[hsl(var(--cph-light-blue))]" : "bg-[hsl(var(--cph-light-blue)/0.08)] text-[hsl(var(--cph-light-blue))]", className)}>
      <p className={cn("text-[13px]", moerk ? "text-[hsl(var(--cph-light-blue)/0.72)]" : "text-muted-foreground")}>{etiket}</p>
      <p className={cn("mt-1 truncate text-[22px] font-extrabold leading-none tabular-nums", fremhaev && "text-[hsl(var(--cph-emerald))]")}>{vaerdi}</p>
      {note && <p className={cn("mt-1 text-[12px]", moerk ? "text-[hsl(var(--cph-light-blue)/0.72)]" : "text-muted-foreground")}>{note}</p>}
    </div>
  );
}

export function NoegletalRaekke({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>{children}</div>;
}

/** Det store tal i et mørkt kort: etiket i emerald, tal i clamp(36–72 px). */
export function StortTal({ etiket, vaerdi, note, className }: { etiket: ReactNode; vaerdi: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <Etiket tone="emerald">{etiket}</Etiket>
      <p className="mt-3 text-[clamp(36px,11vw,72px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{vaerdi}</p>
      {note && <p className="mt-2 text-[15px] leading-[1.5] text-[hsl(var(--cph-light-blue)/0.72)]">{note}</p>}
    </div>
  );
}

/** Fremdrift 0–100 %. `tone="moerk"` på onyx-kort, ellers lys. */
/** `etiket` er påkrævet: en unavngiven progressbar er meningsløs for skærmlæsere [Codex D0]. */
export function Fremdrift({ andel, tone = "lys", etiket, className }: { andel: number; tone?: "lys" | "moerk"; etiket: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(andel)));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={etiket}
      className={cn("relative h-2 w-full overflow-hidden rounded-full", tone === "moerk" ? "bg-[hsl(var(--cph-light-blue)/0.14)]" : "bg-[hsl(var(--cph-light-blue))]", className)}>
      <div className="h-full rounded-full bg-[hsl(var(--cph-emerald))] transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
