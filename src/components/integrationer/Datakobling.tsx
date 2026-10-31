import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useKaldFeltKatalog, type KatalogFelt } from "@/hooks/useKaldFeltKatalog";
import { useApiRegister } from "@/hooks/useApiRegister";

const OBJEKT_LABEL: Record<string, string> = { kald: "Kald", session: "Session", emne: "Emne", optagelse: "Optagelse" };

/**
 * Datakobling på tværs af API'er (Mathias 31/10; plan v2.5 F1c): samme oplysning fra flere kilder vises under ét kanonisk navn
 * (kald_felt_katalog.kanonisk_felt). Værdioversættelser (telefonudfald, sessionsudfald, salgsstatus) kommer i F1c som data (kald_vaerdi_mapping).
 */
export function Datakobling() {
  const { data: felter = [], isLoading } = useKaldFeltKatalog();
  const { data: register = [] } = useApiRegister();

  const kilder = useMemo(() => {
    const brugte = new Set(felter.filter((f) => f.kanonisk_felt).map((f) => f.kilde));
    return register.filter((r) => brugte.has(r.noegle));
  }, [felter, register]);

  const raekker = useMemo(() => {
    const m = new Map<string, Map<string, KatalogFelt[]>>();
    for (const f of felter) {
      if (!f.kanonisk_felt) continue;
      const pr = m.get(f.kanonisk_felt) ?? new Map<string, KatalogFelt[]>();
      const liste = pr.get(f.kilde) ?? [];
      liste.push(f);
      pr.set(f.kilde, liste);
      m.set(f.kanonisk_felt, pr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, "da"));
  }, [felter]);

  const udenKobling = felter.filter((f) => !f.kanonisk_felt && (f.maal_kolonne || f.metadata_noegle)).length;
  const paaTvaers = raekker.filter(([, pr]) => pr.size > 1).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datakobling på tværs af API'er</CardTitle>
        <CardDescription>
          Samme oplysning fra flere kilder samles under ét fælles navn, så kald, sessioner og emner kan sammenlignes uanset dialer. Kildespecifikke
          felter (uden fælles navn) ligger kun under den enkelte API. Oversættelse af værdier (telefonudfald, sessionsudfald og salgsstatus holdes adskilt)
          bygges som data i næste leverance (F1c).
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="outline">{raekker.length} fælles felter</Badge>
          <Badge variant="outline">{paaTvaers} koblet på tværs af flere API'er</Badge>
          <Badge variant="outline">{udenKobling} kildespecifikke felter</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="py-6 text-center text-sm text-muted-foreground">Henter…</div>}
        {!isLoading && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fælles felt</TableHead>
                <TableHead>Objekt</TableHead>
                {kilder.map((k) => (
                  <TableHead key={k.noegle}>{k.navn}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {raekker.map(([navn, pr]) => {
                const [objekt, felt] = navn.split(".");
                return (
                  <TableRow key={navn}>
                    <TableCell className="font-mono text-xs">{felt}</TableCell>
                    <TableCell>{OBJEKT_LABEL[objekt] ?? objekt}</TableCell>
                    {kilder.map((k) => {
                      const liste = pr.get(k.noegle) ?? [];
                      return (
                        <TableCell key={k.noegle} className="text-xs">
                          {liste.length === 0 && <span className="text-muted-foreground">–</span>}
                          {liste.map((f) => (
                            <div key={f.id} className={f.hentes ? undefined : "line-through opacity-60"}>
                              <span className="font-mono">{f.endpoint} · {f.felt_sti}</span>
                              <span className="ml-1 text-muted-foreground">({f.felt_navn})</span>
                            </div>
                          ))}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
              {raekker.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2 + kilder.length} className="py-6 text-center text-muted-foreground">Ingen fælles felter registreret endnu.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
