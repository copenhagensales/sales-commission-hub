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
  useAdminOpretFiberSalg, useAendrFiberAdgang, useFiberKolleger, useMineFiberSalgIDag, useMinFiberRolle, useOpretFiberSalg, useRetFiberSalg, useSletFiberSalg, useTdcFiberAccess, type Kollega, type MitFiberSalg,
} from "@/hooks/useTdcFiberSales";
import { datoIDag, normaliserCvr, oversaetFejl, periodeStart, valider, validerAdmin, type FiberKladde, type FiberType, type FiberVariant } from "@/lib/tdcFiber";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BottomSheet, useIsPhone } from "@/components/mobile";
import { CalendarPlus, Users } from "lucide-react";

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
    <div className="space-y-3">
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
    </div>
  );
}

function AdminPopup({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const phone = useIsPhone();
  const titel = "Hvem må taste fibersalg";
  if (phone) return <BottomSheet open={open} onOpenChange={onOpenChange} title={titel}><div className="px-4 pb-4"><AdminBoks /></div></BottomSheet>;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{titel}</DialogTitle></DialogHeader><AdminBoks /></DialogContent>
    </Dialog>
  );
}

function FiberFelter({ k, setK, fejl, visFejl, kolleger, udeluk, idPrefix }: {
  k: FiberKladde; setK: (k: FiberKladde) => void; fejl: ReturnType<typeof valider>; visFejl: boolean;
  kolleger: Kollega[]; udeluk: string | null; idPrefix: string;
}) {
  return (
    <>
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
        <Label htmlFor={`${idPrefix}-cvr`} className="text-base">CVR-nummer</Label>
        <Input id={`${idPrefix}-cvr`} inputMode="numeric" autoComplete="off" maxLength={11} className="min-h-11 text-base" value={k.cvr} onChange={(e) => setK({ ...k, cvr: e.target.value })} placeholder="8 cifre" />
        {visFejl && fejl.cvr && <p className="text-sm text-destructive">{fejl.cvr}</p>}
      </div>
      {k.type === "lukket" && (
        <div className="space-y-2">
          <Label className="text-base">Leadgiver</Label>
          <Grupperet kolleger={kolleger} value={k.leadgiverId} onChange={(v) => setK({ ...k, leadgiverId: v })} placeholder="Vælg hvem der gav leadet" udeluk={udeluk ? [udeluk] : []} />
          {visFejl && fejl.leadgiver && <p className="text-sm text-destructive">{fejl.leadgiver}</p>}
        </div>
      )}
    </>
  );
}

function RetPopup({ salg, saelgerId, kolleger, onClose }: { salg: MitFiberSalg; saelgerId: string | null; kolleger: Kollega[]; onClose: () => void }) {
  const { toast } = useToast();
  const phone = useIsPhone();
  const ret = useRetFiberSalg();
  const [k, setK] = useState<FiberKladde>({ type: salg.type, variant: salg.variant, mobilevoice: salg.mobilevoice, cvr: salg.cvr, leadgiverId: salg.leadgiverId });
  const [visFejl, setVisFejl] = useState(false);
  const [nyLeadId] = useState(() => crypto.randomUUID());
  const fejl = valider(k, saelgerId);
  const gem = () => {
    setVisFejl(true);
    if (Object.keys(fejl).length || !k.type || !k.variant) return;
    ret.mutate(
      { salgId: salg.id, nyLeadId, type: k.type, variant: k.variant, mobilevoice: k.mobilevoice, cvr: normaliserCvr(k.cvr), leadgiverId: k.type === "lukket" ? k.leadgiverId : null },
      {
        onSuccess: (status) => {
          if (status !== "rettet") { toast({ title: "Ukendt svar", description: "Tjek listen, før du retter igen.", variant: "destructive" }); return; }
          toast({ title: "Salget er rettet" }); onClose();
        },
        onError: (e) => toast({ title: "Ikke gemt", description: oversaetFejl(e as { code?: string; message?: string }) ?? "Ukendt fejl – tjek listen, før du prøver igen.", variant: "destructive" }),
      },
    );
  };
  const indhold = (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Sælger: {salg.saelger ?? "—"}</p>
      <FiberFelter k={k} setK={setK} fejl={fejl} visFejl={visFejl} kolleger={kolleger} udeluk={saelgerId} idPrefix="ret" />
      {salg.type === "lukket" && k.type === "fuldt" && <p className="text-sm text-muted-foreground">Leadgiverens del afvises og giver 0 kr.; sælgeren får fuld provision.</p>}
      <Button className="min-h-11 w-full text-base" disabled={ret.isPending} onClick={gem}>{ret.isPending ? "Gemmer …" : "Gem rettelse"}</Button>
    </div>
  );
  const titel = "Ret fibersalg";
  if (phone) return <BottomSheet open onOpenChange={(v) => !v && onClose()} title={titel}><div className="px-4 pb-4">{indhold}</div></BottomSheet>;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{titel}</DialogTitle></DialogHeader>{indhold}</DialogContent>
    </Dialog>
  );
}

function AdminOpretPopup({ open, onOpenChange, kolleger }: { open: boolean; onOpenChange: (v: boolean) => void; kolleger: Kollega[] }) {
  const { toast } = useToast();
  const phone = useIsPhone();
  const opret = useAdminOpretFiberSalg();
  const { data: liste = [] } = useTdcFiberAccess();
  const saelgere = useMemo(() => liste.map((r) => ({ id: r.employee_id, navn: r.navn, team: "Fibersælgere" })).sort((a, b) => a.navn.localeCompare(b.navn, "da")), [liste]);
  const idag = new Date();
  const [k, setK] = useState<FiberKladde>(TOM);
  const [lukker, setLukker] = useState<string | null>(null);
  const [dato, setDato] = useState(() => datoIDag(new Date()));
  const [visFejl, setVisFejl] = useState(false);
  const [ids, setIds] = useState(() => ({ salg: crypto.randomUUID(), lead: crypto.randomUUID() }));
  const fejl = validerAdmin(k, lukker, dato, idag);
  const send = () => {
    setVisFejl(true);
    if (Object.keys(fejl).length || !k.type || !k.variant || !lukker) return;
    opret.mutate(
      { salgId: ids.salg, leadSalgId: k.type === "lukket" ? ids.lead : null, type: k.type, variant: k.variant, mobilevoice: k.mobilevoice, cvr: normaliserCvr(k.cvr), leadgiverId: k.type === "lukket" ? k.leadgiverId : null, lukkerId: lukker, dato },
      {
        onSuccess: (status) => {
          if (status !== "oprettet" && status !== "findes") { toast({ title: "Ukendt svar", description: "Tjek salgene, før du opretter igen.", variant: "destructive" }); return; }
          toast({ title: status === "findes" ? "Salget var allerede oprettet" : "Salg oprettet" });
          setK(TOM); setLukker(null); setVisFejl(false); setIds({ salg: crypto.randomUUID(), lead: crypto.randomUUID() }); onOpenChange(false);
        },
        onError: (e) => toast({ title: "Ikke oprettet", description: oversaetFejl(e as { code?: string; message?: string }) ?? "Ukendt fejl – tjek salgene, før du prøver igen.", variant: "destructive" }),
      },
    );
  };
  const indhold = (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-base">Sælger (lukker)</Label>
        <Grupperet kolleger={saelgere} value={lukker} onChange={setLukker} placeholder="Vælg sælger" />
        {visFejl && fejl.lukker && <p className="text-sm text-destructive">{fejl.lukker}</p>}
      </div>
      <FiberFelter k={k} setK={setK} fejl={fejl} visFejl={visFejl} kolleger={kolleger} udeluk={lukker} idPrefix="admin" />
      <div className="space-y-2">
        <Label htmlFor="admin-dato" className="text-base">Salgsdato</Label>
        <Input id="admin-dato" type="date" className="min-h-11 text-base" min={periodeStart(idag)} max={datoIDag(idag)} value={dato} onChange={(e) => setDato(e.target.value)} />
        {visFejl && fejl.dato && <p className="text-sm text-destructive">{fejl.dato}</p>}
      </div>
      <Button className="min-h-11 w-full text-base" disabled={opret.isPending} onClick={send}>{opret.isPending ? "Opretter …" : "Opret salg"}</Button>
    </div>
  );
  const titel = "Opret salg for sælger";
  if (phone) return <BottomSheet open={open} onOpenChange={onOpenChange} title={titel}><div className="px-4 pb-4">{indhold}</div></BottomSheet>;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>{titel}</DialogTitle></DialogHeader>{indhold}</DialogContent>
    </Dialog>
  );
}

export default function TdcErhvervFiber() {
  const { toast } = useToast();
  const { isOwner } = usePermissions();
  const { rolle, mitId, isLoading } = useMinFiberRolle();
  const maaSaelge = !!rolle || isOwner;
  const [adminAaben, setAdminAaben] = useState(false);
  const [opretAaben, setOpretAaben] = useState(false);
  const erAdmin = isOwner || rolle === "admin";
  const { data: kolleger = [] } = useFiberKolleger(maaSaelge || erAdmin);
  const { data: mine = [] } = useMineFiberSalgIDag(maaSaelge || erAdmin ? mitId : null, erAdmin);
  const [retter, setRetter] = useState<MitFiberSalg | null>(null);
  const [sletter, setSletter] = useState<MitFiberSalg | null>(null);
  const slet = useSletFiberSalg();
  const opret = useOpretFiberSalg();
  const [k, setK] = useState<FiberKladde>(TOM);
  const [visFejl, setVisFejl] = useState(false);
  const [ids, setIds] = useState(() => ({ salg: crypto.randomUUID(), lead: crypto.randomUUID() }));
  const [bekraeft, setBekraeft] = useState(false);
  const phone = useIsPhone();
  const fejl = valider(k, mitId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const send = () => {
    setVisFejl(true);
    if (Object.keys(fejl).length || !k.type || !k.variant) return;
    setBekraeft(true);
  };

  const indsend = () => {
    setBekraeft(false);
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
      {erAdmin && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="min-h-11" onClick={() => setOpretAaben(true)}><CalendarPlus className="mr-2 h-4 w-4" />Opret salg for sælger</Button>
          <Button variant="outline" className="min-h-11" onClick={() => setAdminAaben(true)}><Users className="mr-2 h-4 w-4" />Administrér sælgere</Button>
        </div>
      )}
      {!maaSaelge && (
        <Card><CardContent className="py-6 text-base text-muted-foreground">Du er ikke på listen over fibersælgere.</CardContent></Card>
      )}

      {maaSaelge && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Registrér fibersalg</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <FiberFelter k={k} setK={setK} fejl={fejl} visFejl={visFejl} kolleger={kolleger} udeluk={mitId} idPrefix="fiber" />
            <p className="text-sm text-muted-foreground">Salgsdato: i dag.</p>
            <Button className="min-h-11 w-full text-base" disabled={opret.isPending} onClick={send}>{opret.isPending ? "Sender …" : "Registrér salg"}</Button>
          </CardContent>
        </Card>
      )}

      {bekraeft && (() => {
        const indhold = (
          <div className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-base">
              <li>Har du lavet første opsigelsesmail til kunden?</li>
              <li>Har du lavet lead til Hunt?</li>
            </ol>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-11 text-base" onClick={() => setBekraeft(false)}>Nej</Button>
              <Button className="min-h-11 text-base" disabled={opret.isPending} onClick={indsend}>Ja</Button>
            </div>
          </div>
        );
        const titel = "Bekræft før registrering";
        if (phone) return <BottomSheet open onOpenChange={(v) => !v && setBekraeft(false)} title={titel}><div className="px-4 pb-4">{indhold}</div></BottomSheet>;
        return (
          <Dialog open onOpenChange={(v) => !v && setBekraeft(false)}>
            <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{titel}</DialogTitle></DialogHeader>{indhold}</DialogContent>
          </Dialog>
        );
      })()}

      {(maaSaelge || erAdmin) && (
        <Card>
          <CardHeader><CardTitle className="text-base">{erAdmin ? "Tastet i dag (alle)" : "Tastet i dag"}</CardTitle></CardHeader>
          <CardContent>
            {mine.length === 0 ? <p className="text-base text-muted-foreground">Ingen salg endnu i dag.</p> : (
              <ul className="divide-y">
                {mine.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-base">{s.produkt ?? "—"}</span>
                      <span className={cn("text-sm text-muted-foreground")}>{s.saelger} · {s.provision.toLocaleString("da-DK")} kr. · CVR {s.cvr} · {new Date(s.tid).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}</span>
                      {s.afAdmin && <span className="text-sm text-muted-foreground">Oprettet af admin</span>}
                      {s.leadgiver && <span className="text-sm text-muted-foreground">Lead: {s.leadgiver} · {(s.leadProvision ?? 0).toLocaleString("da-DK")} kr.</span>}
                    </div>
                    {erAdmin && (
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" className="min-h-11" onClick={() => setRetter(s)}>Ret</Button>
                        <Button variant="destructive" className="min-h-11" onClick={() => setSletter(s)}>Slet</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {retter && <RetPopup salg={retter} saelgerId={retter.saelgerId} kolleger={kolleger} onClose={() => setRetter(null)} />}
      {sletter && (
        <Dialog open onOpenChange={(o) => { if (!o && !slet.isPending) setSletter(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Slet salg?</DialogTitle></DialogHeader>
            <p className="text-base">Vil du slette salget? Det giver 0 kr. og tæller ikke længere.{sletter.leadgiver ? " Leadgiverens del slettes også." : ""}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-11" disabled={slet.isPending} onClick={() => setSletter(null)}>Nej</Button>
              <Button variant="destructive" className="min-h-11" disabled={slet.isPending} onClick={() => slet.mutate(sletter.id, {
                onSuccess: () => { toast({ title: "Salget er slettet" }); setSletter(null); },
                onError: (e) => toast({ title: "Ikke slettet", description: oversaetFejl(e as { code?: string; message?: string }) ?? (e as { message?: string }).message ?? "Ukendt fejl", variant: "destructive" }),
              })}>Ja, slet</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {erAdmin && <AdminOpretPopup open={opretAaben} onOpenChange={setOpretAaben} kolleger={kolleger} />}
      {erAdmin && <AdminPopup open={adminAaben} onOpenChange={setAdminAaben} />}
    </div>
  );
}
