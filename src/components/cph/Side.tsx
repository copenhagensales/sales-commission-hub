// D0 designgrundlag: fælles sideramme i Hjem/Storkbook-udtrykket. Kun visning – ingen data, ingen rettigheder.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Lille overskrift med versaler (»eyebrow«) – som i hero-kortet på Hjem. */
export function Etiket({ children, tone = "lys", className }: { children: ReactNode; tone?: "lys" | "emerald" | "moerk"; className?: string }) {
  return (
    <p className={cn("text-[11px] font-extrabold uppercase tracking-[0.14em]",
      tone === "emerald" ? "text-[hsl(var(--cph-emerald))]" : tone === "moerk" ? "text-[hsl(var(--cph-light-blue)/0.72)]" : "text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** Sideramme: baggrund, bredde, sidehoved (etiket, titel, undertitel, handlinger) og lodret rytme. */
export function Side({ titel, undertitel, etiket, ikon, handlinger, bred = false, children, className }: {
  titel: ReactNode; undertitel?: ReactNode; etiket?: ReactNode; ikon?: ReactNode; handlinger?: ReactNode; bred?: boolean; children: ReactNode; className?: string;
}) {
  // Samme ramme som Hjem (inde i MainLayout): på telefon giver PageShell selv sidepolstring og plads til bundbjælken [Codex D0].
  return (
    <div className={cn("min-h-screen bg-background px-4 pb-16 pt-6 md:px-10 md:pt-8 max-md:min-h-0 max-md:px-0 max-md:pb-4 max-md:pt-1", className)}>
      <div className={cn("mx-auto w-full", bred ? "max-w-[1400px]" : "max-w-[1004px]")}>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {etiket && <Etiket>{etiket}</Etiket>}
            <h1 className="mt-1 flex items-center gap-3 text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-foreground md:text-[34px]">
              {ikon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-foreground [&>svg]:h-5 [&>svg]:w-5">{ikon}</span>}
              <span className="min-w-0 break-words">{titel}</span>
            </h1>
            {undertitel && <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">{undertitel}</p>}
          </div>
          {handlinger && <div className="flex flex-wrap items-center gap-2">{handlinger}</div>}
        </header>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

/** Afsnit med overskrift og valgfri handling til højre. */
export function Afsnit({ titel, handling, children, className }: { titel: ReactNode; handling?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-extrabold leading-tight text-foreground">{titel}</h2>
        {handling}
      </div>
      {children}
    </section>
  );
}
