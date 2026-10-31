import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plug } from "lucide-react";
import { ApiDetalje } from "@/components/integrationer/ApiDetalje";
import { Datakobling } from "@/components/integrationer/Datakobling";
import { KlientVaelger } from "@/components/integrationer/KlientVaelger";
import {
  API_STATUS_LABEL,
  useApiKonti,
  useApiRegister,
  useDialerKonti,
  useKlienter,
  useKontoKlienter,
  useOpdaterKonto,
  type ApiKonto,
} from "@/hooks/useApiRegister";
import { useKaldFeltKatalog } from "@/hooks/useKaldFeltKatalog";

const KONTO_PARAM = "konto";

function tid(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" }) : "–";
}

/** Kontoens navn – redigeres direkte (RLS: kun ejer/superadmin kan gemme). */
function NavnFelt({ konto }: { konto: ApiKonto }) {
  const opdater = useOpdaterKonto();
  const [navn, setNavn] = useState(konto.navn);
  return (
    <Input
      className="h-8 w-56 font-medium"
      value={navn}
      disabled={opdater.isPending}
      onChange={(e) => setNavn(e.target.value)}
      onBlur={() => {
        const ny = navn.trim();
        if (!ny) { setNavn(konto.navn); return; }
        if (ny !== konto.navn) opdater.mutate({ id: konto.id, aendring: { navn: ny } });
      }}
      aria-label="Kontonavn"
    />
  );
}

/**
 * Administration › Integrationer (Mathias 31/10, efter Plectos datakilde-model): én linje pr. KONTO (hver Adversus-/Enreach-konto står for sig,
 * øvrige API'er én linje hver). Navn og klienter redigeres direkte i listen. Klik åbner kontoens underside med Oversigt · Felter · Sletteregler ·
 * Kørsel · Log. Registret og kontiene er data (api_register, api_konto, api_konto_klient); kun Adversus' katalog er redigerbart nu.
 */
export default function Integrationer() {
  const [params] = useSearchParams();
  const valgt = params.get(KONTO_PARAM);
  const { data: register = [], isLoading: l1, error: e1 } = useApiRegister();
  const { data: konti = [], isLoading: l2, error: e2 } = useApiKonti();
  const { data: kontoKlienter } = useKontoKlienter();
  const { data: klienter = [] } = useKlienter();
  const { data: katalog = [] } = useKaldFeltKatalog();
  const integrationIds = useMemo(() => konti.map((k) => k.integration_id).filter((x): x is string => !!x), [konti]);
  const { data: dialer = [] } = useDialerKonti(integrationIds);
  const apiAf = useMemo(() => new Map(register.map((r) => [r.noegle, r] as const)), [register]);
  const dialerAf = useMemo(() => new Map(dialer.map((d) => [d.id, d] as const)), [dialer]);

  const tilbage = useMemo(() => {
    const p = new URLSearchParams(params);
    p.delete(KONTO_PARAM);
    const s = p.toString();
    return s ? `?${s}` : "?";
  }, [params]);
  const linkTil = (id: string) => {
    const p = new URLSearchParams(params);
    p.set(KONTO_PARAM, id);
    return `?${p.toString()}`;
  };

  const konto = valgt ? konti.find((k) => k.id === valgt) : undefined;
  const api = konto ? apiAf.get(konto.api_noegle) : undefined;
  const isLoading = l1 || l2;
  const error = e1 ?? e2;

  return (
    <MainLayout>
      <div className="space-y-6">
        {!konto && (
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><Plug className="h-7 w-7" /> Integrationer</h1>
            <p className="text-muted-foreground">Alle konti og API'er, Stork henter fra eller sender til – hver for sig: navn, klienter, hvad der hentes, og hvilke sletteregler der gælder.</p>
          </div>
        )}
        {isLoading && <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Henter…</div>}
        {error && <div className="text-destructive text-sm">Kunne ikke hente integrationer: {(error as Error).message}</div>}
        {!isLoading && !error && konto && api && (
          <ApiDetalje konto={konto} api={api} klienter={klienter} valgteKlienter={kontoKlienter?.get(konto.id) ?? []} tilbage={tilbage} />
        )}
        {!isLoading && !error && valgt && !konto && <div className="text-sm text-muted-foreground">Ukendt konto. <Link to={tilbage} className="text-primary underline">Til listen</Link></div>}
        {!isLoading && !error && !valgt && (
          <Tabs defaultValue="konti">
            <TabsList>
              <TabsTrigger value="konti">Konti og API'er</TabsTrigger>
              <TabsTrigger value="datakobling">Datakobling på tværs</TabsTrigger>
            </TabsList>
            <TabsContent value="konti">
              <Card>
                <CardHeader>
                  <CardTitle>Alle konti</CardTitle>
                  <CardDescription>
                    Ret navn direkte i feltet og vælg klient(er) pr. konto. Klik »Åbn« for felter, sletteregler, kørsel og log. »Redigerbar« gælder
                    kataloget: kun Adversus kan ændres nu; resten vises uændret.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Konto</TableHead>
                        <TableHead>API</TableHead>
                        <TableHead>Klient(er)</TableHead>
                        <TableHead>Aktiv</TableHead>
                        <TableHead>Sidste sync</TableHead>
                        <TableHead>Felter i kataloget</TableHead>
                        <TableHead>Katalog</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {konti.map((k) => {
                        const a = apiAf.get(k.api_noegle);
                        const d = k.integration_id ? dialerAf.get(k.integration_id) : undefined;
                        const status = API_STATUS_LABEL[a?.status ?? "laast"] ?? API_STATUS_LABEL.laast;
                        const felter = katalog.filter((f) => f.kilde === k.api_noegle).length;
                        return (
                          <TableRow key={k.id}>
                            <TableCell className="align-top">
                              <NavnFelt konto={k} />
                              {k.note && <div className="mt-1 max-w-xs text-xs text-muted-foreground">{k.note}</div>}
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline">{a?.navn ?? k.api_noegle}</Badge>
                              {a?.leverandoer && <div className="mt-1 text-xs text-muted-foreground">{a.leverandoer}</div>}
                            </TableCell>
                            <TableCell className="align-top"><KlientVaelger kontoId={k.id} valgte={kontoKlienter?.get(k.id) ?? []} klienter={klienter} /></TableCell>
                            <TableCell className="align-top">{d ? (d.is_active ? "Ja" : "Nej") : k.aktiv ? "Ja" : "Nej"}</TableCell>
                            <TableCell className="align-top text-xs">{d ? tid(d.last_sync_at) : <span className="text-muted-foreground">–</span>}</TableCell>
                            <TableCell className="align-top">{felter > 0 ? felter : <span className="text-muted-foreground">–</span>}</TableCell>
                            <TableCell className="align-top"><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                            <TableCell className="align-top"><Button asChild variant="ghost" size="sm"><Link to={linkTil(k.id)}>Åbn</Link></Button></TableCell>
                          </TableRow>
                        );
                      })}
                      {konti.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Ingen konti registreret.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="datakobling">
              <Datakobling />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
