import { Info, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function LeagueRulesSheet({ compact = false }: { compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 hover:bg-primary/20 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer">
            <Info className="h-3 w-3" />
            <span>Turneringsregler</span>
          </button>
        ) : (
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
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Sådan fungerer Superligaen</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-5">
          {/* Oprykning */}
          <div>
            <h4 className="font-semibold mb-1.5 text-green-400">✅ Oprykning</h4>
            <p className="text-sm text-muted-foreground">
              Top 3 i hver division rykker automatisk op til divisionen over efter hver runde. Jo højere division du er i, desto flere point kan du optjene.
            </p>
          </div>

          {/* Playoff */}
          <div>
            <h4 className="font-semibold mb-1.5 text-orange-400">⚔️ Playoff</h4>
            <p className="text-sm text-muted-foreground">
              #4-5 i en division spiller playoff mod #10-11 i divisionen over. Den med højest provision i ugen vinder pladsen i den øverste division. Playoff-zonerne markeres med orange i divisionen.
            </p>
          </div>

          {/* Nedrykning */}
          <div>
            <h4 className="font-semibold mb-1.5 text-red-400">⬇️ Nedrykning</h4>
            <p className="text-sm text-muted-foreground">
              #12-14 rykker automatisk ned til divisionen under. Disse pladser markeres med rød i divisionen, så du altid kan se farezonen.
            </p>
          </div>

          {/* Point */}
          <div>
            <h4 className="font-semibold mb-1.5 text-yellow-400">🏆 Point</h4>
            <p className="text-sm text-muted-foreground">
              Point gives baseret på din placering i divisionen. #1 i divisionen får flest point, og hvert trin ned koster 5 point. Højere divisioner giver 20 ekstra basispoint per niveau – så selv sidstepladsen i en højere division slår førstepladsen i divisionen under.
            </p>
            <div className="text-sm text-muted-foreground mt-1.5 space-y-0.5">
              <p className="font-medium text-foreground/80">Eksempel (5 divisioner, ×1.0):</p>
              <p>Superliga: #1 = 100 pt, #2 = 95, … #14 = 35 pt</p>
              <p>1. Division: #1 = 80 pt, #2 = 75, … #14 = 15 pt</p>
              <p>2. Division: #1 = 60 pt, #2 = 55 pt, …</p>
              <p>3. Division: #1 = 40 pt, #2 = 35 pt, …</p>
              <p>4. Division: #1 = 20 pt, #2 = 15 pt, … #4 = 5 pt</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              En runde-multiplikator stiger fra ×1.0 til ×2.0 henover sæsonens 6 runder, så de sidste runder tæller mest og der altid er mulighed for et comeback.
            </p>
          </div>

          {/* Runder */}
          <div>
            <h4 className="font-semibold mb-1.5 text-primary">📅 Runder</h4>
            <p className="text-sm text-muted-foreground">
              Sæsonen består af 1 kvalifikationsuge + 6 aktive runder. Hver uge er én runde. Din provision i ugen bestemmer din placering inden for divisionen. 14 spillere pr. division.
            </p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Kvalifikationsugen sætter startdivisionerne – derefter begynder point at tælle.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700" />

          {/* Vindertitler */}
          <div>
            <h4 className="font-semibold mb-1.5 text-yellow-400">👑 Vindertitler</h4>
            <p className="text-sm text-muted-foreground">
              De 3 store titler med præmie, baseret på samlet pointstilling ved sæsonens afslutning:
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span>🥇</span>
                <span><span className="text-yellow-400 font-medium">Nr. 1</span> – Sæsonens vinder. Flest samlede point.</span>
              </li>
              <li className="flex items-start gap-2">
                <span>🥈</span>
                <span><span className="text-slate-300 font-medium">Nr. 2</span> – Andenpladsen i samlet point.</span>
              </li>
              <li className="flex items-start gap-2">
                <span>🥉</span>
                <span><span className="text-amber-600 font-medium">Nr. 3</span> – Tredjepladsen i samlet point.</span>
              </li>
            </ul>
          </div>

          {/* Anerkendelser */}
          <div>
            <h4 className="font-semibold mb-1.5 text-purple-400">🎖️ Anerkendelser</h4>
            <p className="text-sm text-muted-foreground">
              3 særlige titler der hyldes ved sæsonens afslutning:
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span>🔥</span>
                <span><span className="text-red-400 font-medium">Sæsonens Bedste Runde</span> – Spilleren med flest point i en enkelt runde.</span>
              </li>
              <li className="flex items-start gap-2">
                <span>⭐</span>
                <span><span className="text-purple-400 font-medium">Sæsonens Talent</span> – Nye medarbejdere (&lt; 3 mdr.) med flest point. Friske ben der har vist talent!</span>
              </li>
              <li className="flex items-start gap-2">
                <span>🚀</span>
                <span><span className="text-emerald-400 font-medium">Sæsonens Comeback</span> – Størst stigning i placering fra runde 1 til slutstillingen. Beviset på, at det aldrig er for sent.</span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
