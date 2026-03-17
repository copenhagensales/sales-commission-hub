import { useState } from "react";
import { Info, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function LeagueRulesSheet() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition-colors p-3 flex items-center justify-between gap-3 text-left cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/15 shrink-0">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Turneringsregler</p>
              <p className="text-xs text-muted-foreground">Point, op-/nedrykning & præmier</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Sådan fungerer Salgsligaen</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-5">
          <div>
            <h4 className="font-semibold mb-1.5 text-green-400">✅ Oprykning</h4>
            <p className="text-sm text-muted-foreground">
              Top 3 i hver division rykker automatisk op til divisionen over.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-orange-400">⚔️ Playoff</h4>
            <p className="text-sm text-muted-foreground">
              #4-5 i en division spiller playoff mod #10-11 i divisionen over. Højest provision vinder pladsen oppe.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-red-400">⬇️ Nedrykning</h4>
            <p className="text-sm text-muted-foreground">
              #12-14 rykker automatisk ned til divisionen under.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-yellow-400">🏆 Point</h4>
            <p className="text-sm text-muted-foreground">
              Point gives baseret på din placering i divisionen. Højere divisioner giver flere point.
              En runde-multiplikator stiger fra 1.0× til 2.0× henover sæsonens 7 runder, så de sidste runder tæller mest.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-primary">📅 Runder</h4>
            <p className="text-sm text-muted-foreground">
              Hver uge er en runde. Din provision i ugen bestemmer din placering inden for divisionen. 14 spillere pr. division.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-purple-400">🎁 Præmier</h4>
            <p className="text-sm text-muted-foreground">
              6 titler uddeles ved sæsonens afslutning: Nummer 1-3 (samlet), Sæsonens Bedste Runde, Sæsonens Talent (nye medarbejdere) og Sæsonens Comeback (størst fremgang).
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
