import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users } from "lucide-react";
import { useSaetKontoKlienter, type Klient } from "@/hooks/useApiRegister";

/** Vælg klient/klienter for kontoen (flervalg). */
export function KlientVaelger({ kontoId, valgte, klienter }: { kontoId: string; valgte: string[]; klienter: Klient[] }) {
  const saet = useSaetKontoKlienter();
  const navne = klienter.filter((k) => valgte.includes(k.id)).map((k) => k.name);
  const skift = (id: string, til: boolean) => {
    if (saet.isPending) return;  // én gemning ad gangen – ellers regner to klik på samme gamle mængde (Codex P1)
    const ny = til ? [...new Set([...valgte, id])] : valgte.filter((v) => v !== id);
    saet.mutate({ kontoId, clientIds: ny });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 max-w-xs justify-start gap-2 truncate font-normal" disabled={saet.isPending}>
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{navne.length ? navne.join(", ") : "Vælg klient(er)"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="mb-1 px-1 text-xs text-muted-foreground">Klienter kontoen arbejder for</div>
        <div className="max-h-72 space-y-1 overflow-auto">
          {klienter.map((k) => (
            <label key={k.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
              <Checkbox checked={valgte.includes(k.id)} disabled={saet.isPending} onCheckedChange={(v) => skift(k.id, v === true)} />
              {k.name}
            </label>
          ))}
          {klienter.length === 0 && <div className="px-1 text-sm text-muted-foreground">Ingen klienter</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

