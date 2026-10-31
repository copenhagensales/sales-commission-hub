import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plug } from "lucide-react";
import { ApiDetalje } from "@/components/integrationer/ApiDetalje";
import { Datakobling } from "@/components/integrationer/Datakobling";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_PROVIDERE, API_STATUS_LABEL, RETNING_LABEL, useApiRegister, useDialerKonti } from "@/hooks/useApiRegister";
import { useKaldFeltKatalog } from "@/hooks/useKaldFeltKatalog";

const API_PARAM = "api";

/**
 * Administration › Integrationer (Mathias 31/10, efter Plectos datakilde-model): én liste over alle API'er, én underside pr. API med
 * fanerne Oversigt · Felter · Sletteregler · Kørsel · Log. Registret er data (api_register); kun Adversus er redigerbar i denne leverance.
 */
export default function Integrationer() {
  const [params] = useSearchParams();
  const valgt = params.get(API_PARAM);
  const { data: register = [], isLoading, error } = useApiRegister();
  const { data: katalog = [] } = useKaldFeltKatalog();
  const alleProvidere = useMemo(() => Object.values(API_PROVIDERE).flat(), []);
  const { data: konti = [] } = useDialerKonti(alleProvidere);

  const tilbage = useMemo(() => {
    const p = new URLSearchParams(params);
    p.delete(API_PARAM);
    const s = p.toString();
    return s ? `?${s}` : "?";
  }, [params]);

  const linkTil = (noegle: string) => {
    const p = new URLSearchParams(params);
    p.set(API_PARAM, noegle);
    return `?${p.toString()}`;
  };

  const api = valgt ? register.find((r) => r.noegle === valgt) : undefined;

  return (
    <MainLayout>
      <div className="space-y-6">
        {!api && (
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><Plug className="h-7 w-7" /> Integrationer</h1>
            <p className="text-muted-foreground">Alle API'er, Stork henter fra eller sender til: hvad der hentes, hvor det gemmes, og hvilke sletteregler der gælder.</p>
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Henter registret…</div>
        )}
        {error && <div className="text-destructive text-sm">Registret kunne ikke hentes: {(error as Error).message}</div>}
        {!isLoading && !error && api && <ApiDetalje api={api} tilbage={tilbage} />}
        {!isLoading && !error && valgt && !api && <div className="text-sm text-muted-foreground">Ukendt API »{valgt}«. <Link to={tilbage} className="text-primary underline">Til listen</Link></div>}
        {!isLoading && !error && !valgt && (
          <Tabs defaultValue="apier">
            <TabsList>
              <TabsTrigger value="apier">API'er</TabsTrigger>
              <TabsTrigger value="datakobling">Datakobling på tværs</TabsTrigger>
            </TabsList>
            <TabsContent value="apier">
          <Card>
            <CardHeader>
              <CardTitle>Alle API'er</CardTitle>
              <CardDescription>Klik på en API for felter, sletteregler, kørsel og log. Kun API'er markeret »Redigerbar« kan ændres nu; resten vises uændret.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>API</TableHead>
                    <TableHead>Leverandør</TableHead>
                    <TableHead>Retning</TableHead>
                    <TableHead>Konti</TableHead>
                    <TableHead>Felter i kataloget</TableHead>
                    <TableHead>Skriver til</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {register.map((r) => {
                    const providere = API_PROVIDERE[r.noegle] ?? [];
                    const antalKonti = konti.filter((k) => providere.includes(k.provider)).length;
                    const felter = katalog.filter((f) => f.kilde === r.noegle).length;
                    const status = API_STATUS_LABEL[r.status] ?? API_STATUS_LABEL.laast;
                    return (
                      <TableRow key={r.noegle}>
                        <TableCell>
                          <Link to={linkTil(r.noegle)} className="font-medium text-primary underline">{r.navn}</Link>
                          {r.beskrivelse && <div className="max-w-md text-xs text-muted-foreground">{r.beskrivelse}</div>}
                        </TableCell>
                        <TableCell>{r.leverandoer ?? "–"}</TableCell>
                        <TableCell>{RETNING_LABEL[r.retning] ?? r.retning}</TableCell>
                        <TableCell>{providere.length ? antalKonti : "–"}</TableCell>
                        <TableCell>{felter > 0 ? felter : <span className="text-muted-foreground">–</span>}</TableCell>
                        <TableCell className="text-xs">{r.tabeller.length ? r.tabeller.map((t) => <Badge key={t} variant="outline" className="mr-1 font-mono">{t}</Badge>) : <span className="text-muted-foreground">–</span>}</TableCell>
                        <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
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
