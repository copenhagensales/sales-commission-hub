import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function LeagueRulesSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Info className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[70vh]">
        <SheetHeader>
          <SheetTitle>📋 Sådan fungerer Salgsligaen</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5 overflow-y-auto pb-4">
          <div>
            <h4 className="font-semibold mb-1.5 text-green-400">✅ Oprykning</h4>
            <p className="text-sm text-muted-foreground">
              Top 2 i hver division rykker automatisk op til divisionen over.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-orange-400">⚔️ Duel</h4>
            <p className="text-sm text-muted-foreground">
              #8 i en division spiller duel mod #3 i divisionen under. Vinderen spiller oppe.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-red-400">⬇️ Nedrykning</h4>
            <p className="text-sm text-muted-foreground">
              #9 og #10 rykker automatisk ned til divisionen under.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-yellow-400">🏆 Point</h4>
            <p className="text-sm text-muted-foreground">
              Point gives baseret på din placering i divisionen. Højere divisioner giver flere point.
              Samlet pointsum over alle runder afgør den overordnede rangering.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1.5 text-primary">📅 Runder</h4>
            <p className="text-sm text-muted-foreground">
              Hver uge er en runde. Din provision i ugen bestemmer din placering inden for divisionen.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
