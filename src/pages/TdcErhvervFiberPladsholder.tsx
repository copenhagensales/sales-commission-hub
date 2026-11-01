import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePositionPermissions";
import {
  useAendrFiberAdgang, useFiberKolleger, useMineFiberSalgIDag, useMinFiberRolle, useOpretFiberSalg, useTdcFiberAccess,
} from "@/hooks/useTdcFiberSales";
import { normaliserCvr, oversaetFejl, valider, type FiberKladde, type FiberType, type FiberVariant } from "@/lib/tdcFiber";
import { cn } from "@/lib/utils";

const TOM: FiberKladde = { type: null, variant: null, mobilevoice: false, cvr: "", leadgiverId: null };

function Valg<T extends string>({ value, options, onChange, label }: { value: T | null; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <Button key={o.v} type="button" role="radio" aria-checked={value === o.v} variant={value === o.v ? "default" : "outline"} className="min-h-11 text-base" onClick={() => onChange(o.v)}>
          {o.l}
        </Button>
      ))}
    </div>
  );
}

function Grupperet({ kolleger, value, onChange, placeholder, udeluk = [] }: { kolleger: { id: string; navn: string; team: string }[]; value: string | null; onChange: (v: string) => void; placeholder: string; udeluk?: string[] }) {
  const grupper = useMemo(() => {
    const m = new Map<string, { id: string; navn: string }[]>();
    for (const k of kolleger) if (!udeluk.includes(k.id)) m.set(k.team, [...(m.get(k.team) ?? []), k]);
    return [...m.entries()];
  }, [kolleger, udeluk]);
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="min-h-11 text-base"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {grupper.map(([team, list]) => (
          <SelectGroup key={team}>
            <SelectLabel>{team}</SelectLabel>
            {list.map((k) => <SelectItem key={k.id} value={k.id} className="min-h-11">{k.navn}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function AdminBoks() {
  const { toast } = useToast();
  const { data: liste } = useTdcFiberAccess();
  const { data: kolleger = [] } = useFiberKolleger();
  const aendr = useAendrFiberAdgang();
  const [valgt, setValgt] = useState<string | null>(null);
  const paaListe = (liste ?? []).map((r) => r.employee_id);
  const fejl = (e: unknown) => toast({ title: "Ikke gemt", description: e instanceof Error ? e.message : "Ukendt fejl", variant: "destructive" });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Admin – hvem må taste fibersalg</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1"><Grupperet kolleger={kolleger} value={valgt} onChange={setValgt} placeholder="Vælg medarbejder" udeluk={paaListe} /></div>
          <Button className="min-h-11" disabled={!valgt || aendr.isPending} onClick={() => valgt && aendr.mutate({ handling: "tilfoej", employeeId: valgt }, { onSuccess: () => setValgt(null), onError: fejl })}>Tilføj</Button>
        </div>
        <ul className="divide-y rounded-md border">
          {(liste ?? []).map((r) => (
            <li key={r.employee_id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-base">{r.navn} {r.rolle === "admin" && <span className="text-sm text-muted-foreground">(admin)</span>}</span>
              {r.rolle === "saelger" && (
                <Button variant="ghost" className="min-h-11" disabled={aendr.isPending} onClick={() => aendr.mutate({ handling: "fjern", employeeId: r.employee_id }, { onError: fejl })}>Fjern</Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function TdcErhvervFiber() {
  const { toast } = useToast();
  const { isOwner } = usePermissions();
  const { rolle, mitId, isLoading } = useMinFiberRolle();
  const maaSaelge = !!rolle;
  const erAdmin = isOwner || rolle === "admin";
  const { data: kolleger = [] } = useFiberKolleger(maaSaelge || erAdmin);
  const { data: mine = [] } = useMineFiberSalgIDag(maaSaelge ? mitId : null);
  const opret = useOpretFiberSalg();
  const [k, setK] = useState<FiberKladde>(TOM);
  const [visFejl, setVisFejl] = useState(false);
  const [ids, setIds] = useState(() => ({ salg: crypto.randomUUID(), lead: crypto.randomUUID() }));
  const fejl = valider(k, mitId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const send = () => {
    setVisFejl(true);
    if (Object.keys(fejl).length || !k.type || !k.variant) return;
    opret.mutate(
      { salgId: ids.salg, leadSalgId: k.type === "lukket" ? ids.lead : null, type: k.type, variant: k.variant, mobilevoice: k.mobilevoice, cvr: normaliserCvr(k.cvr), leadgiverId: k.type === "lukket" ? k.leadgiverId : null },
      {
        onSuccess: (status) => {
          if (status !== "oprettet" && status !== "findes") {
            toast({ title: "Ukendt svar", description: "Tjek listen nedenfor, før du taster igen.", variant: "destructive" });
            return;
          }
          toast({ title: status === "findes" ? "Salget var allerede registreret" : "Salg registreret" });
          setK(TOM); setVisFejl(false); setIds({ salg: crypto.randomUUID(), lead: crypto.randomUUID() });
        },
        onError: (e) => toast({ title: "Ikke sendt", description: oversaetFejl(e as { code?: string; message?: string }) ?? "Ukendt fejl – prøv igen. Salget er ikke registreret, medmindre det står i listen.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {!maaSaelge && (
        <Card><CardContent className="py-6 text-base text-muted-foreground">Du er ikke på listen over fibersælgere.{erAdmin ? " Du kan tilføje sælgere herunder." : ""}</CardContent></Card>
      )}

      {maaSaelge && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Registrér fibersalg</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-base">Salgstype</Label>
              <Valg<FiberType> label="Salgstype" value={k.type} onChange={(v) => setK({ ...k, type: v, leadgiverId: v === "fuldt" ? null : k.leadgiverId })} options={[{ v: "fuldt", l: "Fuldt salg" }, { v: "lukket", l: "Lukket salg" }]} />
              {visFejl && fejl.type && <p className="text-sm text-destructive">{fejl.type}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-base">Produkt</Label>
              <Valg<FiberVariant> label="Produkt" value={k.variant} onChange={(v) => setK({ ...k, variant: v })} options={[{ v: "HAP", l: "HAP" }, { v: "VOK", l: "VOK" }]} />
              {visFejl && fejl.variant && <p className="text-sm text-destructive">{fejl.variant}</p>}
            </div>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-base">Inkl. Mobilevoice</span>
              <Switch checked={k.mobilevoice} onCheckedChange={(v) => setK({ ...k, mobilevoice: v })} />
            </label>
            <div className="space-y-2">
              <Label htmlFor="fiber-cvr" className="text-base">CVR-nummer</Label>
              <Input id="fiber-cvr" inputMode="numeric" autoComplete="off" maxLength={11} className="min-h-11 text-base" value={k.cvr} onChange={(e) => setK({ ...k, cvr: e.target.value })} placeholder="8 cifre" />
              {visFejl && fejl.cvr && <p className="text-sm text-destructive">{fejl.cvr}</p>}
            </div>
            {k.type === "lukket" && (
              <div className="space-y-2">
                <Label className="text-base">Leadgiver</Label>
                <Grupperet kolleger={kolleger} value={k.leadgiverId} onChange={(v) => setK({ ...k, leadgiverId: v })} placeholder="Vælg hvem der gav leadet" udeluk={mitId ? [mitId] : []} />
                {visFejl && fejl.leadgiver && <p className="text-sm text-destructive">{fejl.leadgiver}</p>}
              </div>
            )}
            <p className="text-sm text-muted-foreground">Salgsdato: i dag.</p>
            <Button className="min-h-11 w-full text-base" disabled={opret.isPending} onClick={send}>{opret.isPending ? "Sender …" : "Registrér salg"}</Button>
          </CardContent>
        </Card>
      )}

      {maaSaelge && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tastet i dag</CardTitle></CardHeader>
          <CardContent>
            {mine.length === 0 ? <p className="text-base text-muted-foreground">Ingen salg endnu i dag.</p> : (
              <ul className="divide-y">
                {mine.map((s) => (
                  <li key={s.id} className="flex flex-col gap-0.5 py-2">
                    <span className="text-base">{s.produkt ?? "—"}</span>
                    <span className={cn("text-sm text-muted-foreground")}>{s.navn} · {s.provision.toLocaleString("da-DK")} kr. · {new Date(s.tid).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {erAdmin && <AdminBoks />}
    </div>
  );
}
