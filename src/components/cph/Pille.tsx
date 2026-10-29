// D0: den ene knap. Rund, 44 px høj, fed tekst. Varianter følger Hjem/Storkbook (onyx, lys blå, hvid, emerald-kontur, rød).
import type React from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const VARIANT = {
  primaer: "bg-[hsl(var(--cph-onyx))] text-[hsl(var(--cph-light-blue))] hover:bg-[hsl(var(--cph-onyx-pressed))]",
  sekundaer: "bg-[hsl(var(--cph-light-blue))] text-foreground hover:bg-muted",
  lys: "bg-card text-foreground hover:bg-[hsl(var(--cph-light-blue))]",
  kontur: "border border-[hsl(var(--cph-emerald)/0.45)] bg-transparent text-[hsl(var(--cph-emerald))] hover:bg-[hsl(var(--cph-emerald)/0.1)]",
  fare: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
} as const;
// »lille« er 40 px på pc, men aldrig under 44 px på telefon (tap-flade) [Codex D0].
const STOERRELSE = { normal: "min-h-[44px] px-5 text-[14px]", lille: "min-h-[44px] px-4 text-[13px] md:min-h-[40px]", ikon: "h-11 w-11 p-0" } as const;
// Fokusring: emerald med onyx-kant, så den ses på både lyse og mørke flader [Codex D0].
const BASE = "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--cph-emerald))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--cph-onyx))] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4";

export type PilleProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  stoerrelse?: keyof typeof STOERRELSE;
  ikon?: ReactNode;
  /** Intern rute: knappen bliver et link (react-router). */
  til?: string;
};

export function Pille({ variant = "primaer", stoerrelse = "normal", ikon, til, className, children, type = "button", disabled, onClick, ...rest }: PilleProps) {
  const klasser = cn(BASE, VARIANT[variant], STOERRELSE[stoerrelse], className);
  // Link: onClick, id, title og aria-* følger med; en deaktiveret »linkknap« er en rigtig deaktiveret knap (navigerer ikke) [Codex D0].
  if (til && !disabled) {
    const { id, title, ...aria } = rest;
    const ariaProps = Object.fromEntries(Object.entries(aria).filter(([k]) => k.startsWith("aria-") || k.startsWith("data-")));
    return <Link to={til} id={id} title={title} className={klasser} onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>} {...ariaProps}>{ikon}{children}</Link>;
  }
  return <button type={type} className={klasser} disabled={disabled} onClick={onClick} {...rest}>{ikon}{children}</button>;
}
