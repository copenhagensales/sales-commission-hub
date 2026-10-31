import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Database as DatabaseIcon, Loader2 } from "lucide-react";
import {
  KATALOG_ENDPOINTS,
  KATALOG_KLASSIFIKATIONER,
  useKaldFeltKatalog,
  useOpdaterKatalogFelt,
  type KatalogFelt,
  type KatalogKlassifikation,
} from "@/hooks/useKaldFeltKatalog";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  aktiv: { label: "Aktiv", variant: "default" },
  inaktiv: { label: "Fravalgt", variant: "secondary" },
  forslag: { label: "Forslag", variant: "outline" },
  skabelon: { label: "Skabelon", variant: "outline" },
};

function maalTekst(f: KatalogFelt): string {
  if (f.maal_kolonne) return `${f.maal_tabel}.${f.maal_kolonne}`;
  if (f.metadata_noegle) return `${f.maal_tabel}.metadata.${f.metadata_noegle}`;
  return "gemmes ikke";
}

function FeltRaekke({ felt }: { felt: KatalogFelt }) {
  const opdater = useOpdaterKatalogFelt();
  const [retention, setRetention] = useState<string>(felt.retention_dage == null ? "" : String(felt.retention_dage));
  const [begrundelse, setBegrundelse] = useState<string>(felt.begrundelse ?? "");
  const afledt = felt.felt_sti.startsWith("afledt:");
  const laast = felt.status === "skabelon";

  const gem = (aendring: Parameters<typeof opdater.mutate>[0]["aendring"]) => opdater.mutate({ id: felt.id, aendring });

  return (
    <TableRow className={felt.hentes ? undefined : "opacity-60"}>
      <TableCell className="align-top">
        <div className="font-medium">{felt.felt_navn}</div>
        <div className="text-xs text-muted-foreground font-mono">{felt.felt_sti}</div>
        {felt.beskrivelse && <div className="text-xs text-muted-foreground mt-1 max-w-md">{felt.beskrivelse}</div>}
        {afledt && felt.afledt_af.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">Afledt af: {felt.afledt_af.join(", ")}</div>
        )}
      </TableCell>
      <TableCell className="align-top text-xs">{felt.datatype}</TableCell>
      <TableCell className="align-top text-xs font-mono">
        {maalTekst(felt)}
        {felt.eksempel && <div className="text-muted-foreground mt-1">fx {felt.eksempel}</div>}
      </TableCell>
      <TableCell className="align-top">
        <Switch
          checked={felt.hentes}
          disabled={laast || opdater.isPending}
          onCheckedChange={(v) => gem({ hentes: v, status: v ? "aktiv" : "inaktiv" })}
          aria-label={`Hent ${felt.felt_navn}`}
        />
      </TableCell>
      <TableCell className="align-top">
        <Select
          value={felt.klassifikation}
          disabled={opdater.isPending}
          onValueChange={(v) => gem({ klassifikation: v as KatalogKlassifikation })}
        >
          <SelectTrigger className="w-[170px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KATALOG_KLASSIFIKATIONER.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="align-top">
        <Input
          type="number"
          min={0}
          max={3650}
          className="w-24 h-8 text-xs"
          placeholder="tabellens"
          value={retention}
          disabled={opdater.isPending}
          onChange={(e) => setRetention(e.target.value)}
          onBlur={() => {
            const ny = retention === "" ? null : Number(retention);
            if (ny !== felt.retention_dage) gem({ retention_dage: ny });
          }}
        />
      </TableCell>
      <TableCell className="align-top">
        <Input
          className="w-56 h-8 text-xs"
          placeholder="Begrundelse"
          value={begrundelse}
          disabled={opdater.isPending}
          onChange={(e) => setBegrundelse(e.target.value)}
          onBlur={() => {
            const ny = begrundelse.trim() === "" ? null : begrundelse.trim();
            if (ny !== (felt.begrundelse ?? null)) gem({ begrundelse: ny });
          }}
        />
      </TableCell>
      <TableCell className="align-top">
        <Badge variant={STATUS_LABEL[felt.status]?.variant ?? "outline"}>{STATUS_LABEL[felt.status]?.label ?? felt.status}</Badge>
      </TableCell>
    </TableRow>
  );
}

/** Indstillinger → »Kaldsdata«: feltkataloget (plan v2.5 F1b). Kun ejer/superadmin kan gemme (RLS); andre ser kataloget. */
export function KaldFeltKatalog() {
  const { data, isLoading, error } = useKaldFeltKatalog();
  const [soeg, setSoeg] = useState("");

  const prEndpoint = useMemo(() => {
    const m = new Map<string, KatalogFelt[]>();
    const q = soeg.trim().toLowerCase();
    for (const f of data ?? []) {
      if (q && !`${f.felt_navn} ${f.felt_sti} ${f.beskrivelse ?? ""} ${maalTekst(f)}`.toLowerCase().includes(q)) continue;
      const liste = m.get(f.endpoint) ?? [];
      liste.push(f);
      m.set(f.endpoint, liste);
    }
    return m;
  }, [data, soeg]);

  const endpoints = useMemo(() => {
    const kendte = KATALOG_ENDPOINTS.map((e) => e.endpoint);
    const ekstra = [...new Set((data ?? []).map((f) => f.endpoint))].filter((e) => !kendte.includes(e)).map((e) => ({ endpoint: e, label: e }));
    return [...KATALOG_ENDPOINTS, ...ekstra];
  }, [data]);

  const total = data?.length ?? 0;
  const hentes = (data ?? []).filter((f) => f.hentes).length;
  const uklassificeret = (data ?? []).filter((f) => f.klassifikation === "ukendt").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseIcon className="h-5 w-5" />
          Kaldsdata – feltkatalog
        </CardTitle>
        <CardDescription>
          Alle felter Adversus kan levere for kald, sessioner, emner og optagelser: hvor de gemmes, om de hentes, klassifikation og
          opbevaringsfrist. Standard er »hent alt«; kataloget klassificerer og sætter frister. Ændringer logges.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge variant="outline">{total} felter</Badge>
          <Badge variant="outline">{hentes} hentes</Badge>
          <Badge variant={uklassificeret > 0 ? "destructive" : "outline"}>{uklassificeret} ikke klassificeret</Badge>
          <Input className="ml-auto w-64 h-8" placeholder="Søg felt…" value={soeg} onChange={(e) => setSoeg(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Henter kataloget…
          </div>
        )}
        {error && <div className="text-destructive text-sm py-4">Kataloget kunne ikke hentes: {(error as Error).message}</div>}
        {!isLoading && !error && (
          <TooltipProvider>
            <Tabs defaultValue={endpoints[0]?.endpoint}>
              <TabsList className="flex flex-wrap h-auto">
                {endpoints.map((e) => (
                  <TabsTrigger key={e.endpoint} value={e.endpoint}>
                    {e.label} <span className="ml-1 text-xs text-muted-foreground">({prEndpoint.get(e.endpoint)?.length ?? 0})</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {endpoints.map((e) => (
                <TabsContent key={e.endpoint} value={e.endpoint}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Felt</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Gemmes i</TableHead>
                        <TableHead>
                          <Tooltip>
                            <TooltipTrigger>Hentes</TooltipTrigger>
                            <TooltipContent>Slås fra: feltet kasseres ved næste hentning, og gemte værdier ryddes efter fristen (fra F1b-2).</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead>Klassifikation</TableHead>
                        <TableHead>
                          <Tooltip>
                            <TooltipTrigger>Frist (dage)</TooltipTrigger>
                            <TooltipContent>Tom = kampagnens/klientens opbevaringspolitik som i dag. Egne frister pr. felt afgøres i F5.</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead>Begrundelse</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(prEndpoint.get(e.endpoint) ?? []).map((f) => (
                        <FeltRaekke key={f.id} felt={f} />
                      ))}
                      {(prEndpoint.get(e.endpoint) ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                            Ingen felter
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}
            </Tabs>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
