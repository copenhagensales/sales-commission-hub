// SR2 krav 1: ét guidet forløb – kladde → prøv → godkend → aktivér i én dialog. Databasen håndhæver stadig hvert skridt (samme RPC'er som SR1).
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  forklarToerkoersel,
  useAktiverSletteregel,
  useGaeldendeTaelling,
  useGemKladde,
  useGodkendSletteregel,
  useProevSletteregel,
  useSletKladde,
  type SletteregelAendring,
  type SletteregelMaal,
  type SletteregelStatus,
  type Taelling,
} from "@/hooks/useSletteregler";

export type SletteregelDialogMaal = {
  maal: SletteregelMaal;
  titel: string;
  /** effektiv gældende frist for målet (klientfrist / kampagnens effektive frist / kolonnefrist) */
  gaeldende: number | null;
  /** kampagne: hvor den gældende frist kommer fra (egen eller fra klient) */
  kilde?: "klient" | "kampagne" | null;
  /** kampagne: klientens frist (til »følg klienten«) */
  klientfrist?: number | null;
  /** dialer-kampagner og klientkampagner, der bruges til »i dag«-sammenligningen (tom for kolonne) */
  kampagner: string[];
  klientkampagner: string[];
};

const TRIN: { status: SletteregelStatus | "ny"; label: string }[] = [
  { status: "kladde", label: "1 Frist" }, { status: "proevet", label: "2 Prøvet" }, { status: "godkendt", label: "3 Godkendt" }, { status: "aktiv", label: "4 Aktiv" },
];
const ORDEN: Record<string, number> = { ny: 0, kladde: 1, proevet: 2, godkendt: 3, aktiv: 4 };

export type ProevSnapshot = { klientfrist: number | null; klientkampagner: string[] };

export function SletteregelDialog({ maal, aaben, open, onOpenChange, kanRedigere, erSuperadmin, snapshots, setSnapshot }: {
  maal: SletteregelDialogMaal | null; aaben?: SletteregelAendring; open: boolean; onOpenChange: (o: boolean) => void; kanRedigere: boolean; erSuperadmin: boolean;
  /** snapshot af grundlaget ved »Prøv« pr. ændrings-id – ejes af fanen, så det overlever genåbning af dialogen (Codex SR2 r3 P1-2) */
  snapshots: Map<string, ProevSnapshot>; setSnapshot: (id: string, s: ProevSnapshot) => void;
}) {
  const gem = useGemKladde(); const slet = useSletKladde(); const proev = useProevSletteregel(); const godkend = useGodkendSletteregel(); const aktiver = useAktiverSletteregel();
  const [frist, setFrist] = useState("");
  const [ingen, setIngen] = useState(false);
  const [begrundelse, setBegrundelse] = useState("");
  const [faerdig, setFaerdig] = useState<string | null>(null);
  const status = (faerdig ? "aktiv" : (aaben?.status ?? "ny")) as SletteregelStatus | "ny";
  const dbFrist = aaben ? aaben.frist_dage : undefined;
  useEffect(() => {  // nulstilles kun, når dialogen åbnes (ikke når ændringen forsvinder efter aktivering)
    if (!open) return;
    setFaerdig(null); setBegrundelse("");
    if (aaben) { setIngen(aaben.frist_dage == null); setFrist(aaben.frist_dage == null ? "" : String(aaben.frist_dage)); }
    else { setIngen(false); setFrist(maal?.gaeldende != null ? String(maal.gaeldende) : ""); }
  }, [open]);  // eslint-disable-line react-hooks/exhaustive-deps
  const resultat0 = (aaben?.proevet_resultat ?? null) as (Taelling & { kampagner?: string[]; kolonne?: string }) | null;
  const proevedeKampagner = resultat0?.kampagner ?? maal?.kampagner ?? [];
  const erKolonne = maal?.maal.maal === "kolonne";
  const gaeldendeQ = useGaeldendeTaelling(proevedeKampagner, erKolonne ? [] : (maal?.klientkampagner ?? []), open && !!maal && !!aaben?.proevet);
  if (!maal) return null;
  const art = maal.maal.maal;
  const ingenTekst = art === "klient" ? "Fjern klientreglen (kampagnerne uden egen frist mister deres regel)" : art === "kampagne" ? (maal.klientfrist != null ? `Ingen egen frist – følg klientens ${maal.klientfrist} dage` : "Ingen egen frist (klienten har ingen regel → kampagnen hentes ikke)") : "Ingen egen frist – følg kampagnens frist";
  const nyVaerdi: number | null = ingen ? null : frist.trim() === "" ? null : Number(frist);
  const gyldig = ingen || (frist.trim() !== "" && Number.isInteger(nyVaerdi) && (nyVaerdi as number) >= (art === "kampagne" || art === "klient" ? 1 : 0) && (nyVaerdi as number) <= 3650);
  const ugemt = aaben ? nyVaerdi !== dbFrist : true;
  // Codex SR2 r1 P1: grundlaget for tørkørslen må ikke have flyttet sig – ellers kræves ny prøve
  const sammeMaengde = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
  const snap = aaben ? snapshots.get(aaben.id) ?? null : null;
  const udenSnapshot = art === "klient" && !!aaben?.proevet && !snap;  // prøvet i en anden session: klientkampagnemængden (salg) kan ikke efterprøves → ny prøve
  const foraeldet = !!aaben?.proevet && (
    (art === "kampagne" && aaben.frist_dage == null && (resultat0?.anvendt_frist ?? null) !== (maal.klientfrist ?? null)) ||
    (art !== "kolonne" && !!resultat0?.kampagner && !sammeMaengde(resultat0.kampagner, maal.kampagner)) ||
    (!!snap && (snap.klientfrist !== (maal.klientfrist ?? null) || !sammeMaengde(snap.klientkampagner, maal.klientkampagner))) ||
    udenSnapshot);  // grundlaget siden Prøv (klientfrist, klientkampagner inkl. salg) – Codex r2/r3 P1-1/P1-2
  const klar = gyldig && !ugemt && !foraeldet;
  const travl = gem.isPending || slet.isPending || proev.isPending || godkend.isPending || aktiver.isPending;
  const resultat = resultat0;
  const forklaring = aaben?.proevet && !ugemt ? forklarToerkoersel(resultat, gaeldendeQ.isError ? null : (gaeldendeQ.data ?? undefined), maal.gaeldende, maal.kilde ?? null) : [];
  const trinNu = ORDEN[status];

  const proevNu = async () => {
    if (!gyldig) return;
    try {
      const id = ugemt || !aaben ? await gem.mutateAsync({ maal: maal.maal, frist_dage: nyVaerdi, aabenId: aaben?.id }) : aaben.id;
      await proev.mutateAsync(id);
      setSnapshot(id, { klientfrist: maal.klientfrist ?? null, klientkampagner: [...maal.klientkampagner] });
    } catch { /* fejl vises som toast */ }
  };
  const godkendNu = async () => { if (aaben && klar) { try { await godkend.mutateAsync(aaben.id); } catch { /* toast */ } } };
  const aktiverNu = async () => {
    if (!aaben || !klar) return;
    try {
      const svar = (await aktiver.mutateAsync({ id: aaben.id, begrundelse })) as { nu?: { retention_days?: number | null; retention_dage?: number | null; frist_dage?: number | null; kampagner?: number; regel_kilde?: string | null } } | null;
      const nu = svar?.nu ?? {};
      const k = (n: number) => `${n} ${n === 1 ? "kampagne" : "kampagner"}`;
      if (art === "klient") setFaerdig(nu.frist_dage == null ? `Klientreglen er fjernet – ${k(nu.kampagner ?? 0)} uden egen frist mistede deres regel.` : `${nu.frist_dage} dage gælder nu for ${k(nu.kampagner ?? 0)}.`);
      else if (art === "kampagne") setFaerdig(nu.retention_days == null ? "Reglen er fjernet – kampagnen hentes ikke, og eksisterende rækker røres ikke." : nu.regel_kilde === "klient" ? `Kampagnen følger nu klientens ${nu.retention_days} dage.` : `${nu.retention_days} dage er nu gældende for kampagnen.`);
      else setFaerdig(nu.retention_dage == null ? "Kolonnen følger nu kampagnens frist." : `${nu.retention_dage} dage er nu gældende for kolonnen.`);
    } catch { /* toast */ }
  };
  const sletNu = async () => { if (aaben && aaben.status === "kladde") { try { await slet.mutateAsync(aaben.id); onOpenChange(false); } catch { /* toast */ } } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle className="break-words">{art === "klient" ? "Klientfrist" : art === "kampagne" ? "Kampagnefrist" : "Kolonnefrist"}: {maal.titel}</DialogTitle>
          <DialogDescription>
            {maal.gaeldende != null ? `Gældende i dag: ${maal.gaeldende} dage${maal.kilde === "klient" ? " (fra klient)" : maal.kilde === "kampagne" ? " (egen)" : ""}.` : "Ingen regel i dag."}
            {" "}Ændringen gælder først, når superadmin aktiverer den.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1" aria-label="Trin">
          {TRIN.map((t) => <Badge key={t.status} variant={ORDEN[t.status] === trinNu || (trinNu === 0 && t.status === "kladde") ? "default" : ORDEN[t.status] < trinNu ? "secondary" : "outline"}>{t.label}</Badge>)}
        </div>
        {faerdig ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">{faerdig} Hentningen følger den fra næste kørsel, oprydning og salgsrensning fra næste nat.</div>
        ) : (
          <div className="space-y-3 text-sm">
            {status !== "aktiv" && kanRedigere && (
              <div className="space-y-2">
                <label className="flex min-h-11 items-center gap-2 py-1"><input type="radio" className="h-5 w-5" checked={!ingen} onChange={() => setIngen(false)} /> <span>Frist i dage</span>
                  <Input type="number" min={art === "kolonne" ? 0 : 1} max={3650} className="h-11 w-28 text-base sm:h-9 sm:text-sm" value={frist} disabled={ingen || travl} onChange={(e) => setFrist(e.target.value)} aria-label="Antal dage" />
                </label>
                <label className="flex min-h-11 items-center gap-2 py-1"><input type="radio" className="h-5 w-5 flex-none" checked={ingen} onChange={() => setIngen(true)} /> <span>{ingenTekst}</span></label>
              </div>
            )}
            {aaben?.proevet && !ugemt && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <div className="font-medium">Tørkørsel {new Date(aaben.proevet).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" })}</div>
                {forklaring.map((l) => <p key={l} className={l === resultat?.advarsel ? "text-destructive" : undefined}>{l}</p>)}
                {gaeldendeQ.isLoading && <p className="text-muted-foreground">Sammenligner med den gældende regel …</p>}
                {gaeldendeQ.isError && <p className="text-destructive">Sammenligningen kunne ikke hentes: {(gaeldendeQ.error as Error).message} <Button size="sm" variant="link" className="h-auto p-0" onClick={() => void gaeldendeQ.refetch()}>Prøv igen</Button></p>}
              </div>
            )}
            {aaben && ugemt && status !== "aktiv" && <p className="text-muted-foreground">Fristen er ændret – tryk »Prøv« for at tælle igen (ændringen bliver en ny kladde).</p>}
            {aaben && !ugemt && foraeldet && status !== "aktiv" && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">{udenSnapshot ? "Tørkørslen er lavet i en tidligere session, så grundlaget (klientens kampagner) kan ikke efterprøves." : "Grundlaget har ændret sig siden tørkørslen (klientens frist eller kampagnerne)."} Tryk »Prøv igen«, før du godkender eller aktiverer.</p>}
            {status === "godkendt" && klar && !erSuperadmin && <p className="rounded-md border p-2">Godkendt – afventer superadmin. Reglen aktiveres, når en superadmin trykker Aktivér.</p>}
            {status === "godkendt" && klar && erSuperadmin && kanRedigere && (
              <div className="space-y-1">
                <div className="font-medium">Aktivér med begrundelse</div>
                <Textarea value={begrundelse} onChange={(e) => setBegrundelse(e.target.value)} placeholder="Påkrævet, fx »aftalt med klienten 4/11«" rows={2} />
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {aaben?.status === "kladde" && !faerdig && kanRedigere && <Button variant="ghost" className="text-destructive" disabled={travl} onClick={sletNu}>Slet kladde</Button>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{faerdig ? "Luk" : "Annullér"}</Button>
            {!faerdig && kanRedigere && status !== "aktiv" && (ugemt || foraeldet || status === "kladde" || !aaben) && <Button disabled={!gyldig || travl} onClick={proevNu}>{proev.isPending || gem.isPending ? "Tæller …" : foraeldet || status === "proevet" || status === "godkendt" ? "Prøv igen" : "Prøv"}</Button>}
            {!faerdig && kanRedigere && status === "proevet" && klar && <Button disabled={travl} onClick={godkendNu}>Godkend</Button>}
            {!faerdig && kanRedigere && status === "proevet" && klar && <Button variant="ghost" disabled={travl} onClick={proevNu}>Prøv igen</Button>}
            {!faerdig && erSuperadmin && kanRedigere && status === "godkendt" && klar && <Button disabled={travl || begrundelse.trim() === ""} onClick={aktiverNu}>{aktiver.isPending ? "Aktiverer …" : "Aktivér"}</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
