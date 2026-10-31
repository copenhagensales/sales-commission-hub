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
  daekningNoegle,
  useKaldFeltDaekning,
  useKaldFeltKatalog,
  useOpdaterKatalogFelt,
  type Daekning,
  type KatalogFelt,
  type KatalogKlassifikation,
} from "@/hooks/useKaldFeltKatalog";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  aktiv: { label: "Aktiv", variant: "default" },
  inaktiv: { label: "Fravalgt", variant: "secondary" },
  forslag: { label: "Forslag", variant: "outline" },
  skabelon: { label: "Skabelon", variant: "outline" },
};

const DAEKNING_DAGE = 7;

function maalTekst(f: KatalogFelt): string {
  if (f.maal_kolonne) return `${f.maal_tabel}.${f.maal_kolonne}`;
  if (f.metadata_noegle) return `${f.maal_tabel}.${f.maal_tabel === "dialer_leads" ? "felter" : "metadata"}.${f.metadata_noegle}`;
  return "gemmes ikke";
}

function DaekningCelle({ felt, daekning }: { felt: KatalogFelt; daekning?: Map<string, Daekning> }) {
  const n = daekningNoegle(felt);
  const d = n && daekning ? daekning.get(n) : undefined;
  if (!n) return <span className="text-xs text-muted-foreground">–</span>;
  if (!d || d.total === 0) return <span className="text-xs text-muted-foreground">0 rækker</span>;
  const pct = Math.round((d.antal / d.total) * 100);
  return (
    <span className={`text-xs ${pct === 0 ? "text-muted-foreground" : ""}`}>
      {d.antal.toLocaleString("da-DK")}/{d.total.toLocaleString("da-DK")} <span className="text-muted-foreground">({pct} %)</span>
    </span>
  );
}

function FeltRaekke({ felt, laast, daekning }: { felt: KatalogFelt; laast: boolean; daekning?: Map<string, Daekning> }) {
  const opdater = useOpdaterKatalogFelt();
  const [retention, setRetention] = useState<string>(felt.retention_dage == null ? "" : String(felt.retention_dage));
  const [begrundelse, setBegrundelse] = useState<string>(felt.begrundelse ?? "");
  const afledt = felt.felt_sti.startsWith("afledt:");
  const skabelon = felt.status === "skabelon";
  const spaerret = laast || skabelon || opdater.isPending;

  const gem = (aendring: Parameters<typeof opdater.mutate>[0]["aendring"]) => opdater.mutate({ id: felt.id, aendring });

  return (
    <TableRow className={felt.hentes ? undefined : "opacity-60"}>
      <TableCell className="align-top">
        <div className="font-medium">{felt.felt_navn}</div>
        <div className="text-xs text-muted-foreground font-mono">
          {felt.felt_sti}
          {felt.kampagne_ekstern_id && <span className="ml-1">· kampagne {felt.kampagne_ekstern_id}</span>}
        </div>
        {felt.beskrivelse && <div className="text-xs text-muted-foreground mt-1 max-w-md">{felt.beskrivelse}</div>}
        {afledt && felt.afledt_af.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">Afledt af: {felt.afledt_af.join(", ")}</div>
        )}
      </TableCell>
      <TableCell className="align-top text-xs">{felt.datatype}</TableCell>
      <TableCell className="align-top text-xs font-mono">
        {maalTekst(felt)}
        {felt.kanonisk_felt && <div className="text-muted-foreground mt-1">fælles: {felt.kanonisk_felt}</div>}
        {felt.eksempel && <div className="text-muted-foreground mt-1">fx {felt.eksempel}</div>}
      </TableCell>
      <TableCell className="align-top">
        <Switch
          checked={felt.hentes}
          disabled={spaerret}
          onCheckedChange={(v) => gem({ hentes: v, status: v ? "aktiv" : "inaktiv" })}
          aria-label={`Hent ${felt.felt_navn}`}
        />
      </TableCell>
      <TableCell className="align-top">
        <Select value={felt.klassifikation} disabled={spaerret} onValueChange={(v) => gem({ klassifikation: v as KatalogKlassifikation })}>
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
          placeholder="politik"
          value={retention}
          disabled
          title="Frister pr. felt afgøres samlet i F5 – indtil da gælder kampagne-/klientpolitikken"
          onChange={(e) => setRetention(e.target.value)}
          onBlur={() => {
            const ny = retention === "" ? null : Number(retention);
            if (ny !== felt.retention_dage) gem({ retention_dage: ny });
          }}
        />
      </TableCell>
      <TableCell className="align-top">
        <DaekningCelle felt={felt} daekning={daekning} />
      </TableCell>
      <TableCell className="align-top">
        <Input
          className="w-56 h-8 text-xs"
          placeholder="Begrundelse"
          value={begrundelse}
          disabled={spaerret}
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

export interface KaldFeltKatalogProps {
  /** API-nøgle (api_register.noegle). Uden: alle kilder. */
  kilde?: string;
  /** Låst API (Integrationer-siden): kataloget vises, men kan ikke ændres. */
  laast?: boolean;
  /** Vises som fane på en API-underside (kortere titel/tekst). */
  indlejret?: boolean;
  /** Kontoens kampagner: kampagnefelter for andre kampagner skjules (fælles felter vises altid). */
  kampagner?: string[];
}

/** Feltkataloget (plan v2.5 F1b): hvad en API leverer, hvor det gemmes, om det hentes, klassifikation, frist og dækning. Kun ejer/superadmin kan gemme (RLS). */
export function KaldFeltKatalog({ kilde, laast = false, indlejret = false, kampagner }: KaldFeltKatalogProps) {
  const { data, isLoading, error } = useKaldFeltKatalog(kilde);
  const { data: daekning } = useKaldFeltDaekning(DAEKNING_DAGE);
  const [soeg, setSoeg] = useState("");

  const prEndpoint = useMemo(() => {
    const m = new Map<string, KatalogFelt[]>();
    const q = soeg.trim().toLowerCase();
    for (const f of data ?? []) {
      if (kampagner && f.kampagne_ekstern_id && !kampagner.includes(f.kampagne_ekstern_id)) continue;
      if (q && !`${f.felt_navn} ${f.felt_sti} ${f.beskrivelse ?? ""} ${f.metadata_noegle ?? ""} ${f.maal_kolonne ?? ""} ${f.kampagne_ekstern_id ?? ""}`.toLowerCase().includes(q)) continue;
      const liste = m.get(f.endpoint) ?? [];
      liste.push(f);
      m.set(f.endpoint, liste);
    }
    return m;
  }, [data, soeg, kampagner]);

  const synlige = useMemo(() => (data ?? []).filter((f) => !(kampagner && f.kampagne_ekstern_id && !kampagner.includes(f.kampagne_ekstern_id))), [data, kampagner]);
  const endpoints = useMemo(() => {
    const kendte = KATALOG_ENDPOINTS.filter((e) => (data ?? []).some((f) => f.endpoint === e.endpoint));
    const kendteNavne = kendte.map((e) => e.endpoint);
    const ekstra = [...new Set((data ?? []).map((f) => f.endpoint))].filter((e) => !kendteNavne.includes(e)).map((e) => ({ endpoint: e, label: e }));
    return [...kendte, ...ekstra];
  }, [data]);

  const total = synlige.length;
  const hentes = synlige.filter((f) => f.hentes).length;
  const uklassificeret = synlige.filter((f) => f.klassifikation === "ukendt").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseIcon className="h-5 w-5" />
          {indlejret ? "Felter" : "Feltkatalog"}
        </CardTitle>
        <CardDescription>
          {laast
            ? "Låst: felterne vises, men kan først ændres, når denne API flyttes over på kataloget i en senere leverance."
            : "Alle felter API'en kan levere: hvor de gemmes, om de hentes, klassifikation, frist og dækning. Standard er »hent alt«; kataloget klassificerer og sætter frister. Ændringer logges."}
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
        {!isLoading && !error && total === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Ingen felter registreret for denne API endnu. Felterne registreres, når API'en flyttes over på kataloget.
          </div>
        )}
        {!isLoading && !error && total > 0 && (
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
                            <TooltipContent>Slås fra: feltet kasseres ved næste hentning, og gemte værdier ryddes efter fristen.</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead>Klassifikation</TableHead>
                        <TableHead>
                          <Tooltip>
                            <TooltipTrigger>Frist (dage)</TooltipTrigger>
                            <TooltipContent>Tom = kampagnens/klientens opbevaringspolitik som i dag. Egne frister pr. felt afgøres samlet i F5 og kan ikke sættes her endnu.</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead>
                          <Tooltip>
                            <TooltipTrigger>Dækning ({DAEKNING_DAGE} d)</TooltipTrigger>
                            <TooltipContent>Rækker med værdi i feltet af alle rækker de sidste {DAEKNING_DAGE} dage.</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead>Begrundelse</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(prEndpoint.get(e.endpoint) ?? []).map((f) => (
                        <FeltRaekke key={f.id} felt={f} laast={laast} daekning={daekning} />
                      ))}
                      {(prEndpoint.get(e.endpoint) ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
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
