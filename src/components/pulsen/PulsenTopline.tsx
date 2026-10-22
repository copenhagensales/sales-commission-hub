import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import type { PulsenTopline as Topline } from "@/hooks/usePulsen";
import { cn } from "@/lib/utils";

/** Pil mod samme ugedag sidste uge på samme klokkeslæt: emerald op, neutral lig, light-blue/72 % ned (ingen rød). */
function Trend({ now, before }: { now: number; before: number }) {
  if (now > before) return <ArrowUp className="h-3.5 w-3.5 text-[hsl(var(--cph-emerald))]" aria-label={`op fra ${before}`} />;
  if (now === before) return <Equal className="h-3.5 w-3.5 text-[hsl(var(--cph-light-blue))]" aria-label="samme som sidste uge" />;
  return <ArrowDown className="h-3.5 w-3.5 text-[hsl(var(--cph-light-blue)/0.72)]" aria-label={`ned fra ${before}`} />;
}

/** Tynd onyx-bjælke: husets (eller valgt teams) salg i dag + én chip pr. team. Kun aggregater. */
export function PulsenTopline({ data, teamId }: { data: Topline; teamId?: string | null }) {
  const teams = teamId ? data.teams.filter((t) => t.id === teamId) : data.teams;
  const headline = teamId ? teams[0] ?? { today: 0, lastWeek: 0 } : data.house;
  const leaderId = data.teams.length && data.teams[0].today > 0 ? data.teams[0].id : null;
  return (
    <div
      className="flex min-h-[44px] items-center gap-4 overflow-x-auto rounded-full bg-[hsl(var(--cph-onyx))] px-4 py-1.5 text-[hsl(var(--cph-light-blue))]"
      aria-label="Salg i dag"
    >
      <div className="flex flex-none items-center gap-1.5 text-[13px]">
        <span className="font-extrabold uppercase tracking-[0.12em] text-[11px] opacity-80">{teamId ? "Teamet i dag" : "Huset i dag"}</span>
        <span className="text-[15px] font-black tabular-nums">{headline.today}</span>
        <Trend now={headline.today} before={headline.lastWeek} />
      </div>
      {!teamId && (
        <ul className="flex flex-none items-center gap-3">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center gap-1.5 text-[13px]" title={t.name}>
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black",
                  t.id === leaderId ? "bg-[hsl(var(--cph-emerald))] text-[hsl(var(--cph-onyx))]" : "bg-[hsl(var(--cph-light-blue)/0.15)]",
                )}
                aria-label={t.name}
              >
                {t.name.charAt(0).toUpperCase()}
              </span>
              <span className={cn("font-extrabold tabular-nums", t.id === leaderId && "text-[hsl(var(--cph-emerald))]")}>{t.today}</span>
              <Trend now={t.today} before={t.lastWeek} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
