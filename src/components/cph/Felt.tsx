// D0: felt med etiket, hjælpetekst og fejl; Indtast = det runde tekstfelt (16 px tekst, så telefonen ikke zoomer).
import { Children, cloneElement, forwardRef, isValidElement, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const feltKlasser = "min-h-[44px] w-full rounded-2xl border-0 bg-[hsl(var(--cph-light-blue))] px-4 text-[16px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--cph-emerald))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--cph-onyx))] disabled:opacity-50 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive";

export const Indtast = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Indtast({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(feltKlasser, className)} {...rest} />;
});

/** Hjælp/fejl kobles til feltet via aria-describedby og aria-invalid (sættes på det ene barn, der er feltet) [Codex D0]. */
export function Felt({ id, etiket, hjaelp, fejl, children, className }: { id: string; etiket: ReactNode; hjaelp?: ReactNode; fejl?: ReactNode; children: ReactNode; className?: string }) {
  const beskrivelseId = fejl ? `${id}-fejl` : hjaelp ? `${id}-hjaelp` : undefined;
  const boern = Children.map(children, (b) => isValidElement<Record<string, unknown>>(b) && (b.props.id === id || Children.count(children) === 1)
    ? cloneElement(b, { "aria-describedby": [b.props["aria-describedby"], beskrivelseId].filter(Boolean).join(" ") || undefined, "aria-invalid": fejl ? true : b.props["aria-invalid"] })
    : b);
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-extrabold text-foreground">{etiket}</label>
      {boern}
      {fejl ? <p id={`${id}-fejl`} className="mt-1.5 text-[13px] font-semibold text-destructive" role="alert">{fejl}</p>
        : hjaelp ? <p id={`${id}-hjaelp`} className="mt-1.5 text-[13px] text-muted-foreground">{hjaelp}</p> : null}
    </div>
  );
}
