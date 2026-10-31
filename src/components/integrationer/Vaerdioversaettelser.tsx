import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  BEGREB_LABEL,
  MAPPING_STATUS_LABEL,
  useKanoniskeVaerdier,
  useObserveredeVaerdier,
  useOpdaterKanonisk,
  useOpdaterMapping,
  useOpretMapping,
  useVaerdiMapping,
  type Begreb,
  type KanoniskVaerdi,
  type ObserveretVaerdi,
  type VaerdiMapping,
} from "@/hooks/useKaldVaerdier";
import { useApiRegister } from "@/hooks/useApiRegister";

const OBS_DAGE = 30;
const BEGREBER: Begreb[] = ["telefonudfald", "sessionsudfald", "emnestatus"];

type Raekke = { mapping?: VaerdiMapping; obs?: ObserveretVaerdi; kilde: string; endpoint: string; felt_sti: string; kildevaerdi: string; begreb: string };

function noegle(r: { kilde: string; endpoint: string; felt_sti: string; kildevaerdi: string; kampagne_ekstern_id?: string | null }) {
  return `${r.kilde}|${r.endpoint}|${r.felt_sti}|${r.kildevaerdi}|${r.kampagne_ekstern_id ?? ""}`;
}

function MappingRaekke({ r, kanoniske, apiNavn, obsUkendt }: { r: Raekke; kanoniske: KanoniskVaerdi[]; apiNavn: (k: string) => string; obsUkendt: boolean }) {
  const opdater = useOpdaterMapping();
  const opret = useOpretMapping();
  const travl = opdater.isPending || opret.isPending;
  const status = r.mapping ? (MAPPING_STATUS_LABEL[r.mapping.status] ?? MAPPING_STATUS_LABEL.ny) : MAPPING_STATUS_LABEL.ny;
  const valgt = r.mapping?.kanonisk_noegle ?? "ukendt";
  const saet = (kanonisk: string) => {
    if (r.mapping) opdater.mutate({ id: r.mapping.id, aendring: { kanonisk_noegle: kanonisk, status: kanonisk === "ukendt" ? "ny" : "aktiv" } });
    else opret.mutate({ kilde: r.kilde, endpoint: r.endpoint, felt_sti: r.felt_sti, begreb: r.begreb, kildevaerdi: r.kildevaerdi, kanonisk_noegle: kanonisk });
  };
  return (
    <TableRow className={!r.mapping || r.mapping.status === "ny" ? "bg-destructive/5" : undefined}>
      <TableCell className="text-xs">{apiNavn(r.kilde)}</TableCell>
      <TableCell className="font-mono text-xs">{r.endpoint} · {r.felt_sti}{r.mapping?.kampagne_ekstern_id && <span className="ml-1 text-muted-foreground">(kampagne {r.mapping.kampagne_ekstern_id})</span>}</TableCell>
      <TableCell className="font-mono text-xs font-medium">{r.kildevaerdi}</TableCell>
      <TableCell className="text-xs">{obsUkendt ? <span className="text-muted-foreground" title="Observationer kunne ikke hentes">ukendt</span> : r.obs ? r.obs.antal.toLocaleString("da-DK") : <span className="text-muted-foreground">0</span>}</TableCell>
      <TableCell>
        <Select value={valgt} disabled={travl} onValueChange={saet}>
          <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {kanoniske.map((k) => (
              <SelectItem key={k.noegle} value={k.noegle}>{k.label_da}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {r.mapping?.status === "forslag" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={travl} onClick={() => opdater.mutate({ id: r.mapping!.id, aendring: { status: "aktiv" } })}>Bekræft</Button>
          )}
        </div>
        {r.mapping?.begrundelse && <div className="mt-1 max-w-xs text-xs text-muted-foreground">{r.mapping.begrundelse}</div>}
      </TableCell>
    </TableRow>
  );
}

function KanoniskeTabel({ begreb, vaerdier }: { begreb: Begreb; vaerdier: KanoniskVaerdi[] }) {
  const opdater = useOpdaterKanonisk();
  const visRelevans = begreb !== "telefonudfald";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fælles værdi</TableHead>
          <TableHead>Nøgle</TableHead>
          <TableHead>Beskrivelse</TableHead>
          {visRelevans && <TableHead>Optagelse hentes uanset længde</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {vaerdier.map((k) => (
          <TableRow key={k.noegle}>
            <TableCell className="font-medium">{k.label_da}</TableCell>
            <TableCell className="font-mono text-xs">{k.noegle}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{k.beskrivelse}</TableCell>
            {visRelevans && (
              <TableCell>
                <Switch checked={k.samtale_relevant} disabled={opdater.isPending || k.noegle === "ukendt"} onCheckedChange={(v) => opdater.mutate({ begreb: k.begreb, noegle: k.noegle, aendring: { samtale_relevant: v } })} aria-label={`Samtalerelevant: ${k.label_da}`} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * F1c – værdioversættelser på tværs af API'er: hvad Adversus' og Enreach' udfaldsværdier betyder i Stork. Tre begreber holdes adskilt.
 * Værdier set i data uden oversættelse vises som »Ny – ikke mappet« (= ukendt) og indgår aldrig stiltiende i en nævner. Læsere (KPI'er) skiftes i F1c-2.
 */
export function Vaerdioversaettelser() {
  const { data: kanoniske = [], isLoading: l1 } = useKanoniskeVaerdier();
  const { data: mapping = [], isLoading: l2 } = useVaerdiMapping();
  const { data: observeret = [], isError: obsFejl, error: obsFejlTekst } = useObserveredeVaerdier(OBS_DAGE);
  const { data: register = [] } = useApiRegister();
  const apiNavn = (k: string) => register.find((r) => r.noegle === k)?.navn ?? k;

  const raekkerPrBegreb = useMemo(() => {
    const m = new Map<string, Raekke[]>();
    const set = new Map<string, Raekke>();
    for (const mp of mapping) set.set(noegle(mp), { mapping: mp, kilde: mp.kilde, endpoint: mp.endpoint, felt_sti: mp.felt_sti, kildevaerdi: mp.kildevaerdi, begreb: mp.begreb });
    for (const o of observeret) {
      const n = noegle(o);
      const eks = set.get(n);
      if (eks) eks.obs = o;
      else set.set(n, { obs: o, kilde: o.kilde, endpoint: o.endpoint, felt_sti: o.felt_sti, kildevaerdi: o.kildevaerdi, begreb: o.begreb });
    }
    for (const r of set.values()) m.set(r.begreb, [...(m.get(r.begreb) ?? []), r]);
    for (const liste of m.values()) liste.sort((a, b) => (a.mapping ? 1 : 0) - (b.mapping ? 1 : 0) || a.kilde.localeCompare(b.kilde) || a.endpoint.localeCompare(b.endpoint) || a.felt_sti.localeCompare(b.felt_sti) || a.kildevaerdi.localeCompare(b.kildevaerdi));
    return m;
  }, [mapping, observeret]);

  const umappede = [...raekkerPrBegreb.values()].flat().filter((r) => !r.mapping || r.mapping.status === "ny").length;
  const forslag = mapping.filter((m) => m.status === "forslag").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Værdioversættelser</CardTitle>
        <CardDescription>
          Hvad kildernes udfaldsværdier betyder i Stork. Telefonudfald (telefonen), sessionsudfald (samtalen) og emnestatus (emnet) holdes adskilt og blandes
          aldrig. Værdier set i data de sidste {OBS_DAGE} dage uden oversættelse står som »Ny – ikke mappet« og regnes som ukendt. »Forslag« er sat ud fra
          kildernes dokumentation og tæller først, når de er bekræftet. Ændringer gælder fremad; KPI'er skifter først til de fælles værdier i næste leverance.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant={umappede > 0 ? "destructive" : "outline"}>{obsFejl ? "ikke mappet: ukendt" : `${umappede} ikke mappet`}</Badge>
          <Badge variant="outline">{forslag} forslag til bekræftelse</Badge>
          <Badge variant="outline">{mapping.filter((m) => m.status === "aktiv").length} bekræftet</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {obsFejl && <div className="mb-3 text-sm text-destructive">Værdier set i data kunne ikke hentes ({(obsFejlTekst as Error)?.message ?? "fejl"}) – antallene vises som ukendt.</div>}
        {(l1 || l2) && <div className="py-6 text-center text-sm text-muted-foreground">Henter…</div>}
        {!l1 && !l2 && (
          <Tabs defaultValue="telefonudfald">
            <TabsList>
              {BEGREBER.map((b) => (
                <TabsTrigger key={b} value={b}>{BEGREB_LABEL[b]} <span className="ml-1 text-xs text-muted-foreground">({raekkerPrBegreb.get(b)?.length ?? 0})</span></TabsTrigger>
              ))}
            </TabsList>
            {BEGREBER.map((b) => (
              <TabsContent key={b} value={b} className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>API</TableHead>
                      <TableHead>Felt</TableHead>
                      <TableHead>Kildeværdi</TableHead>
                      <TableHead>Set ({OBS_DAGE} d)</TableHead>
                      <TableHead>Betyder i Stork</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(raekkerPrBegreb.get(b) ?? []).map((r) => (
                      <MappingRaekke key={noegle({ ...r, kampagne_ekstern_id: r.mapping?.kampagne_ekstern_id })} r={r} kanoniske={kanoniske.filter((k) => k.begreb === b)} apiNavn={apiNavn} obsUkendt={obsFejl} />
                    ))}
                    {(raekkerPrBegreb.get(b) ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Ingen værdier</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                <div>
                  <div className="mb-2 text-sm font-medium">Fælles værdier for {BEGREB_LABEL[b].toLowerCase()}</div>
                  <KanoniskeTabel begreb={b} vaerdier={kanoniske.filter((k) => k.begreb === b)} />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
