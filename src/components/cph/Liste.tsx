// D0: liste af rækker (ikon, titel, undertekst, værdi til højre). En række kan være link, knap eller ren visning.
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Liste({ children, className, etiket }: { children: ReactNode; className?: string; etiket?: string }) {
  return <ul aria-label={etiket} className={cn("divide-y divide-border overflow-hidden rounded-3xl bg-card", className)}>{children}</ul>;
}

export function Raekke({ ikon, titel, undertekst, hoejre, til, onClick, className }: {
  ikon?: ReactNode; titel: ReactNode; undertekst?: ReactNode; hoejre?: ReactNode; til?: string; onClick?: () => void; className?: string;
}) {
  const aktiv = !!til || !!onClick;
  const indhold = (
    <>
      {ikon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--cph-light-blue))] text-foreground [&>svg]:h-5 [&>svg]:w-5">{ikon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold text-foreground">{titel}</span>
        {undertekst && <span className="block truncate text-[13px] text-muted-foreground">{undertekst}</span>}
      </span>
      {hoejre && <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-foreground">{hoejre}</span>}
      {aktiv && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  );
  const klasser = cn("flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left", aktiv && "hover:bg-[hsl(var(--cph-light-blue))] active:bg-muted", className);
  return (
    <li>
      {til ? <Link to={til} className={klasser} onClick={onClick}>{indhold}</Link>
        : onClick ? <button type="button" onClick={onClick} className={klasser}>{indhold}</button>
        : <div className={klasser}>{indhold}</div>}
    </li>
  );
}
