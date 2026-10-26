import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Mail, MessageSquare, Bell, Search } from "lucide-react";
import { Samleside } from "@/components/layout/Samleside";
import { useAdminSynlighed } from "@/hooks/useAdminSynlighed";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/mobile";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useUdsendelsestyper, useOpdaterUdsendelsestype, useUdsendelseLog, useModtagerValg, useSendBesked,
  type LogFilter, type UdsendelseLogRaekke, type Kanal, type SendBesked,
} from "@/hooks/useUdsendelser";
import { PUSH_TEXT } from "@/lib/push/pushText";
import * as P from "@/routes/pages";

const KANAL_IKON: Record<string, typeof Mail> = { mail: Mail, sms: MessageSquare, push: Bell };
const KanalIkon = ({ kanal }: { kanal: string }) => {
  const I = KANAL_IKON[kanal] ?? Mail;
  return <span className="inline-flex items-center gap-1 text-sm"><I className="h-4 w-4" aria-hidden />{kanal === "sms" ? "SMS" : kanal === "push" ? "Push" : "Mail"}</span>;
};
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" }) : "–");

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sendt: "default", sent: "default", fejl: "destructive", failed: "destructive", error: "destructive",
};

function TekstFelt({ vaerdi, gem, flere }: { vaerdi: string; gem: (v: string) => void; flere?: boolean }) {
  const [v, setV] = useState(vaerdi);
  const ud = () => { if (v !== vaerdi) gem(v); };
  return flere
    ? <Textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={ud} rows={2} className="min-w-[12rem] text-base md:text-sm" />
    : <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={ud} className="min-w-[10rem] text-base md:text-sm" />;
}

function Overblik() {
  const { data, isLoading } = useUdsendelsestyper();
  const opd = useOpdaterUdsendelsestype();
  const [sog, setSog] = useState("");
  const [bekraeft, setBekraeft] = useState<{ noegle: string; navn: string; aktiv: boolean } | null>(null);
  type Raekke = NonNullable<typeof data>[number];
  const gem = (noegle: string, ret: Parameters<typeof opd.mutate>[0]) =>
    opd.mutate({ ...ret, noegle }, { onSuccess: () => toast.success("Gemt"), onError: () => toast.error("Kunne ikke gemme") });

  const rows = useMemo(() => {
    const s = sog.trim().toLowerCase();
    return (data ?? []).filter((t) => !s || [t.navn, t.noegle, t.afsenderfunktion, t.beskrivelse].some((x) => x?.toLowerCase().includes(s)));
  }, [data, sog]);

  const cols: ResponsiveColumn<Raekke>[] = [
    { key: "navn", header: "Navn", isTitle: true, cell: (t) => <TekstFelt vaerdi={t.navn} gem={(v) => gem(t.noegle, { noegle: t.noegle, navn: v })} /> },
    { key: "kanal", header: "Kanal", isKey: true, cell: (t) => <KanalIkon kanal={t.kanal} /> },
    { key: "aktiv", header: "Til/fra", isKey: true, cell: (t) => (
      <Switch checked={t.aktiv} aria-label={`${t.navn} til/fra`} onCheckedChange={(v) => setBekraeft({ noegle: t.noegle, navn: t.navn, aktiv: v })} />
    ) },
    { key: "sidst", header: "Sidst sendt", isKey: true, cell: (t) => fmt(t.sidstSendt) },
    { key: "antal", header: "30 dage", isKey: true, cell: (t) => t.antal30 },
    { key: "udloeser", header: "Udløser", cell: (t) => t.udloeser },
    { key: "afsender", header: "Afsenderfunktion", cell: (t) => <code className="text-xs">{t.afsenderfunktion}</code> },
    { key: "stille", header: "Stille timer", cell: (t) => (
      <div className="flex items-center gap-1">
        <Input type="time" aria-label="Stille fra" defaultValue={t.stille_fra?.slice(0, 5) ?? ""} className="w-28 text-base md:text-sm"
          onBlur={(e) => { const v = e.target.value || null; if (v !== (t.stille_fra?.slice(0, 5) ?? null)) gem(t.noegle, { noegle: t.noegle, stille_fra: v }); }} />
        <span aria-hidden>–</span>
        <Input type="time" aria-label="Stille til" defaultValue={t.stille_til?.slice(0, 5) ?? ""} className="w-28 text-base md:text-sm"
          onBlur={(e) => { const v = e.target.value || null; if (v !== (t.stille_til?.slice(0, 5) ?? null)) gem(t.noegle, { noegle: t.noegle, stille_til: v }); }} />
      </div>
    ) },
    { key: "regel", header: "Modtagerregel", cell: (t) => <TekstFelt flere vaerdi={t.modtagerregel} gem={(v) => gem(t.noegle, { noegle: t.noegle, modtagerregel: v })} /> },
    { key: "beskrivelse", header: "Beskrivelse", cell: (t) => <TekstFelt flere vaerdi={t.beskrivelse} gem={(v) => gem(t.noegle, { noegle: t.noegle, beskrivelse: v })} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={sog} onChange={(e) => setSog(e.target.value)} placeholder="Søg i udsendelser" className="pl-9 text-base md:text-sm" />
      </div>
      {isLoading ? <p className="text-muted-foreground">Henter…</p> : (
        <>
          <p className="text-sm text-muted-foreground">{rows.length} typer</p>
          <ResponsiveTable columns={cols} rows={rows} rowKey={(t) => t.noegle} />
        </>
      )}
      <AlertDialog open={!!bekraeft} onOpenChange={(o) => !o && setBekraeft(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bekraeft?.aktiv ? `Slå ${bekraeft?.navn} til?` : `Slå ${bekraeft?.navn} fra?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {bekraeft?.aktiv ? "Udsendelsen sendes igen fra nu af." : "Ingen får den, før den slås til igen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={() => bekraeft && gem(bekraeft.noegle, { noegle: bekraeft.noegle, aktiv: bekraeft.aktiv })}>
              {bekraeft?.aktiv ? "Slå til" : "Slå fra"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Vaelg({ label, value, onChange, valg }: { label: string; value: string; onChange: (v: string) => void; valg: { v: string; l: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11 text-base md:text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{valg.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Log() {
  const { data: typer } = useUdsendelsestyper();
  const [f, setF] = useState<LogFilter>({ kanal: "alle", type: "alle", status: "alle", periode: "7", tekst: "", historik: false });
  const log = useUdsendelseLog(f);
  const navn = useMemo(() => new Map((typer ?? []).map((t) => [t.noegle, t.navn])), [typer]);
  const rows = log.data?.pages.flat() ?? [];
  const cols: ResponsiveColumn<UdsendelseLogRaekke>[] = [
    { key: "tid", header: "Tidspunkt", isKey: true, cell: (r) => fmt(r.tidspunkt) },
    { key: "kanal", header: "Kanal", isKey: true, cell: (r) => <KanalIkon kanal={r.kanal} /> },
    { key: "type", header: "Type", isTitle: true, cell: (r) => navn.get(r.type_noegle) ?? r.type_noegle },
    { key: "modtager", header: "Modtager", isKey: true, cell: (r) => <span className="break-all">{r.modtager}</span> },
    { key: "emne", header: "Emne", cell: (r) => r.emne ?? "–" },
    { key: "status", header: "Status", isKey: true, cell: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge> },
    { key: "fejl", header: "Fejl", cell: (r) => <span className="text-destructive break-words">{r.fejl ?? ""}</span> },
  ];
  const set = (p: Partial<LogFilter>) => setF((x) => ({ ...x, ...p }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Vaelg label="Kanal" value={f.kanal} onChange={(v) => set({ kanal: v })} valg={[{ v: "alle", l: "Alle" }, { v: "mail", l: "Mail" }, { v: "sms", l: "SMS" }, { v: "push", l: "Push" }]} />
        <Vaelg label="Type" value={f.type} onChange={(v) => set({ type: v })} valg={[{ v: "alle", l: "Alle" }, ...(typer ?? []).map((t) => ({ v: t.noegle, l: t.navn }))]} />
        <Vaelg label="Status" value={f.status} onChange={(v) => set({ status: v })}
          valg={["alle", "sendt", "fejl", "fravalgt", "slaaet_fra", "stille_timer", "ingen_tilmelding", "planlagt"].map((v) => ({ v, l: v === "alle" ? "Alle" : v }))} />
        <Vaelg label="Periode" value={f.periode} onChange={(v) => set({ periode: v as LogFilter["periode"] })}
          valg={[{ v: "i-dag", l: "I dag" }, { v: "7", l: "7 dage" }, { v: "30", l: "30 dage" }]} />
        <div className="space-y-1">
          <Label className="text-sm" htmlFor="log-sog">Modtager/emne</Label>
          <Input id="log-sog" value={f.tekst} onChange={(e) => set({ tekst: e.target.value })} className="min-h-11 text-base md:text-sm" />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <Switch checked={f.historik} onCheckedChange={(v) => set({ historik: v })} /> Vis historik før i dag
      </label>
      {log.isLoading ? <p className="text-muted-foreground">Henter…</p> : log.error ? (
        <p className="text-destructive">Kunne ikke hente loggen.</p>
      ) : (
        <ResponsiveTable columns={cols} rows={rows} rowKey={(r) => r.id} empty={<p className="p-4 text-muted-foreground">Ingen udsendelser i perioden.</p>} />
      )}
      {log.hasNextPage && (
        <Button variant="outline" className="min-h-11" onClick={() => log.fetchNextPage()} disabled={log.isFetchingNextPage}>Vis flere</Button>
      )}
    </div>
  );
}

function Send() {
  const valg = useModtagerValg();
  const send = useSendBesked();
  const [kanal, setKanal] = useState<Kanal>("push");
  const [maal, setMaal] = useState<"roller" | "teams" | "medarbejder">("roller");
  const [ids, setIds] = useState<string[]>([]);
  const [emne, setEmne] = useState("");
  const [tekst, setTekst] = useState("");
  const [bekraeft, setBekraeft] = useState<number | null>(null);
  const liste = maal === "roller" ? (valg.data?.roller ?? []).map((r) => ({ id: r.key, l: r.label }))
    : maal === "teams" ? (valg.data?.teams ?? []).map((t) => ({ id: t.id, l: t.name }))
    : (valg.data?.medarbejdere ?? []).map((e) => ({ id: e.id, l: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() }));
  const body = (b: Partial<SendBesked>): SendBesked => ({ kanal, maal, ids, emne, tekst, ...b });
  const resultat = (d: { antal: number; sendt?: number; sprunget?: number; fejl?: number }) =>
    toast.success(`Sendt: ${d.sendt ?? 0} af ${d.antal}${d.sprunget ? ` · sprunget over: ${d.sprunget}` : ""}${d.fejl ? ` · fejl: ${d.fejl}` : ""}`);
  const fejl = (e: unknown) => toast.error(e instanceof Error ? e.message : "Fejl");
  const klar = tekst.trim().length > 0;

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-4 pt-6">
        <Vaelg label="Kanal" value={kanal} onChange={(v) => setKanal(v as Kanal)} valg={[{ v: "push", l: "Push" }, { v: "mail", l: "Mail" }, { v: "sms", l: "SMS" }]} />
        <Vaelg label="Modtagere" value={maal} onChange={(v) => { setMaal(v as typeof maal); setIds([]); }}
          valg={[{ v: "roller", l: "Roller" }, { v: "teams", l: "Teams" }, { v: "medarbejder", l: "Én medarbejder" }]} />
        <div className="max-h-56 overflow-y-auto rounded-xl border border-border p-2">
          {liste.map((o) => (
            <label key={o.id} className="flex min-h-11 items-center gap-3 px-2 text-sm">
              <input type={maal === "medarbejder" ? "radio" : "checkbox"} name="modtager" className="h-5 w-5"
                checked={ids.includes(o.id)}
                onChange={(e) => setIds(maal === "medarbejder" ? [o.id] : e.target.checked ? [...ids, o.id] : ids.filter((x) => x !== o.id))} />
              {o.l}
            </label>
          ))}
        </div>
        {kanal !== "sms" && (
          <div className="space-y-1">
            <Label htmlFor="send-emne">{kanal === "push" ? "Titel" : "Emne"}</Label>
            <Input id="send-emne" value={emne} onChange={(e) => setEmne(e.target.value)} className="text-base md:text-sm" maxLength={200} />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="send-tekst">Tekst</Label>
          <Textarea id="send-tekst" value={tekst} onChange={(e) => setTekst(e.target.value)} rows={5} className="text-base md:text-sm" maxLength={5000} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="min-h-11" disabled={!klar || send.isPending}
            onClick={() => send.mutate(body({ maal: "mig", ids: [] }), { onSuccess: resultat, onError: fejl })}>Send til mig først</Button>
          <Button className="min-h-11" disabled={!klar || !ids.length || send.isPending}
            onClick={() => send.mutate(body({ kunAntal: true }), { onSuccess: (d) => setBekraeft(d.antal), onError: fejl })}>Send til alle valgte</Button>
        </div>
      </CardContent>
      <AlertDialog open={bekraeft !== null} onOpenChange={(o) => !o && setBekraeft(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send til {bekraeft} modtagere?</AlertDialogTitle>
            <AlertDialogDescription>Beskeden sendes som {kanal === "sms" ? "SMS" : kanal} til {bekraeft} aktive medarbejdere. Det kan ikke fortrydes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction disabled={!bekraeft} onClick={() => send.mutate(body({}), { onSuccess: resultat, onError: fejl })}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Tekster() {
  return (
    <Tabs defaultValue="mail">
      <TabsList>
        <TabsTrigger value="mail">Mail</TabsTrigger>
        <TabsTrigger value="sms">SMS</TabsTrigger>
        <TabsTrigger value="push">Push</TabsTrigger>
      </TabsList>
      <TabsContent value="mail"><P.SystemEmailTemplates /></TabsContent>
      <TabsContent value="sms"><P.SmsTemplates /></TabsContent>
      <TabsContent value="push">
        <Card>
          <CardHeader><CardTitle className="text-base">Push-tekster (skrivebeskyttet)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Flyttes til data senere.</p>
            {Object.entries(PUSH_TEXT).map(([k, t]) => (
              <div key={k} className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold">{t.title} <code className="ml-2 text-xs text-muted-foreground">{k}</code></p>
                <p className="text-sm">{t.body}</p>
                <p className="text-xs text-muted-foreground">Åbner {t.url}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

export default function Udsendelser() {
  const ejer = useAdminSynlighed().har.udsendelser;
  return (
    <Samleside titel="Udsendelser" faner={[
      { id: "overblik", label: "Overblik", element: <Overblik />, synlig: ejer },
      { id: "log", label: "Log", element: <Log />, synlig: ejer },
      { id: "send", label: "Send", element: <Send />, synlig: ejer },
      { id: "tekster", label: "Tekster", element: <Tekster />, synlig: ejer },
    ]} />
  );
}
