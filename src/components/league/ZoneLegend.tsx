import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus, HelpCircle, Flame, Zap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface ZoneLegendProps {
  className?: string;
}

export function ZoneLegend({ className }: ZoneLegendProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-7 w-7 rounded-full", className)}>
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto" side="bottom" align="end">
        <div className="space-y-4 text-sm">
          <h4 className="font-semibold text-foreground">Symbolforklaring</h4>

          {/* Placering */}
          <section className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Placering</p>
            <div className="flex items-center gap-2">
              <span className="text-base">🥇🥈🥉</span>
              <span>Top 3 i divisionen</span>
            </div>
          </section>

          {/* Zoner */}
          <section className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Zoner</p>
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <span>Oprykker (1-3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-orange-500" />
                <span>Playoff (4-5 / 10-11)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-red-500" />
                <span>Nedrykker (12-14)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-yellow-500" />
                <span>Top 3 samlet</span>
              </div>
            </div>
          </section>

          {/* Aktivitet */}
          <section className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Aktivitet i dag</p>
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span>Har solgt i dag</span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                <span>#1 sælger i dag (alle divisioner)</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                <span>#2-3 sælger i dag (alle divisioner)</span>
              </div>
            </div>
          </section>

          {/* Trend */}
          <section className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Ugentlig trend</p>
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <svg width={32} height={12} viewBox="0 0 32 12" className="shrink-0">
                  <polyline points="2,10 8,7 14,8 20,5 26,3 30,2" fill="none" stroke="hsl(142 71% 45%)" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span>Stigende formkurve</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width={32} height={12} viewBox="0 0 32 12" className="shrink-0">
                  <polyline points="2,3 8,5 14,4 20,7 26,9 30,10" fill="none" stroke="hsl(0 84% 60%)" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
                <TrendingDown className="h-3 w-3 text-rose-400" />
                <span>Faldende formkurve</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width={32} height={12} viewBox="0 0 32 12" className="shrink-0">
                  <polyline points="2,6 8,5 14,7 20,5 26,6 30,6" fill="none" stroke="hsl(217 91% 60%)" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
                <Minus className="h-3 w-3 text-slate-400" />
                <span>Stabil formkurve</span>
              </div>
            </div>
          </section>

          {/* Bevægelse */}
          <section className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Placeringsændring</p>
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-500 font-mono text-xs">+2</span>
                <span>Rykket 2 pladser op siden i går</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-red-500 font-mono text-xs">-1</span>
                <span>Rykket 1 plads ned siden i går</span>
              </div>
            </div>
          </section>

          {/* Op/nedrykket */}
          <section className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Divisionsskift</p>
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2 text-green-600">
                <ArrowUp className="h-3.5 w-3.5" />
                <span>Oprykket til højere division</span>
              </div>
              <div className="flex items-center gap-2 text-red-600">
                <ArrowDown className="h-3.5 w-3.5" />
                <span>Nedrykket til lavere division</span>
              </div>
            </div>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}
