// D0: faner som runde piller (Huset/Team i Storkbook). Tastatur: pil venstre/højre, Home/End.
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Fane { id: string; label: ReactNode; taeller?: number | null }

export function Faner({ punkter, vaerdi, onSkift, etiket, praefiks, className }: { punkter: Fane[]; vaerdi: string; onSkift: (id: string) => void; etiket: string; /** Sæt sammen med fanePanel(), så fane og panel kobles. */ praefiks?: string; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tast = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = punkter.findIndex((p) => p.id === vaerdi);
    const n = punkter.length;
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % n;
    else if (e.key === "ArrowLeft") j = (i - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    onSkift(punkter[j].id);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[j]?.focus();
  };
  return (
    <div ref={ref} role="tablist" aria-label={etiket} onKeyDown={tast} className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-card p-1", className)}>
      {punkter.map((p) => {
        const aktiv = p.id === vaerdi;
        return (
          <button key={p.id} type="button" role="tab" aria-selected={aktiv} tabIndex={aktiv ? 0 : -1} onClick={() => onSkift(p.id)}
            id={praefiks ? `${praefiks}-fane-${p.id}` : undefined} aria-controls={praefiks ? `${praefiks}-panel-${p.id}` : undefined}
            className={cn("min-h-[44px] shrink-0 rounded-full px-4 text-[14px] font-extrabold transition-colors md:min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--cph-emerald))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--cph-onyx))]",
              aktiv ? "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))]" : "text-foreground hover:bg-[hsl(var(--cph-light-blue))]")}>
            {p.label}
            {p.taeller != null && <span className="ml-1.5 tabular-nums opacity-70">{p.taeller}</span>}
          </button>
        );
      })}
    </div>
  );
}
