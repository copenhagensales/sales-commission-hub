// SR3b-UI: beskyt/ophæv en kolonne gennem de samme fire trin som frister (kladde → prøvet → godkendt → aktivér).
// Aktivering sætter kolonnen i flyttetilstand (status »aktiverer«); flytteren (cron) flytter værdierne i batches og afslutter ændringen. Databasen håndhæver hvert skridt.
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAktiverSletteregel, useFortrydAendring, useGodkendSletteregel, useOpretBeskyttelse, useProevSletteregel, type SletteregelAendring, type SletteregelStatus } from "@/hooks/useSletteregler";
import type { KatalogFelt } from "@/hooks/useKaldFeltKatalog";

const TRIN: { status: SletteregelStatus; label: string }[] = [
  { status: "kladde", label: "1 Kladde" }, { status: "proevet", label: "2 Prøvet" }, { status: "godkendt", label: "3 Godkendt" }, { status: "aktiverer", label: "4 Aktiverer" },
];
const ORDEN: Record<string, number> = { ny: 0, kladde: 1, proevet: 2, godkendt: 3, aktiverer: 4, aktiv: 5 };
type Toerkoersel = { raekker?: number; roller?: string[]; brugere?: number; bemaerkning?: string; kolonne?: string; grundlag?: { maal_tabel?: string; metadata_noegle?: string; kampagne_ekstern_id?: string | null } };

export function BeskyttelseDialog({ felt, retning, aaben, open, onOpenChange, kanRedigere, erSuperadmin, roller }: {
  felt: KatalogFelt | null; retning: "beskyt" | "ophaev"; aaben?: SletteregelAendring; open: boolean; onOpenChange: (o: boolean) => void; kanRedigere: boolean; erSuperadmin: boolean;
  /** roller med nøglen »se beskyttede kaldsfelter« (til forklaringen) */
  roller: string[];
}) {
  const opret = useOpretBeskyttelse(); const proev = useProevSletteregel(); const godkend = useGodkendSletteregel(); const aktiver = useAktiverSletteregel(); const fortryd = useFortrydAendring();
  const [begrundelse, setBegrundelse] = useState("");
  const [faerdig, setFaerdig] = useState<string | null>(null);
  useEffect(() => { if (open) { setFaerdig(null); setBegrundelse(""); } }, [open]);
  if (!felt) return null;
  const status = (faerdig ? "aktiverer" : (aaben?.status ?? "ny")) as SletteregelStatus | "ny";
  const r = (aaben?.proevet_resultat ?? null) as Toerkoersel | null;
  const kolonne = `${felt.maal_tabel}.${felt.maal_tabel === "dialer_leads" ? "felter" : "metadata"}.${felt.metadata_noegle}`;
  // grundlaget (tabel, nøgle, kampagne) må ikke have flyttet sig siden tørkørslen – databasen afviser ellers aktiveringen
  const grundlagAendret = !!r?.grundlag && (r.grundlag.maal_tabel !== felt.maal_tabel || r.grundlag.metadata_noegle !== felt.metadata_noegle || (r.grundlag.kampagne_ekstern_id ?? null) !== (felt.kampagne_ekstern_id ?? null));
  const klar = !!aaben?.proevet && !grundlagAendret;
  const travl = opret.isPending || proev.isPending || godkend.isPending || aktiver.isPending || fortryd.isPending;
  const trinNu = ORDEN[status];
  const proevNu = async () => { try { const id = aaben?.id ?? (await opret.mutateAsync({ katalog_id: felt.id, type: retning })); await proev.mutateAsync(id); } catch { /* toast */ } };
  const godkendNu = async () => { if (aaben && klar) { try { await godkend.mutateAsync(aaben.id); } catch { /* toast */ } } };
  const aktiverNu = async () => {
    if (!aaben || !klar) return;
    try {
      await aktiver.mutateAsync({ id: aaben.id, begrundelse });
      setFaerdig(retning === "beskyt"
        ? "Beskyttelsen er aktiveret. Værdierne flyttes nu til den lukkede tabel i baggrunden (batches hvert 2. minut). Kolonnen viser »aktiverer – N tilbage«, til alt er flyttet; derefter kan kun brugere med nøglen slå værdierne op, og hvert opslag logges."
        : "Ophævelsen er aktiveret. Værdierne flyttes tilbage til den åbne kolonne i baggrunden. Kolonnen viser »ophæves – N tilbage«, til alt er flyttet.");
    } catch { /* toast */ }
  };
  const fortrydNu = async () => { if (aaben && aaben.status !== "aktiv" && aaben.status !== "aktiverer") { try { await fortryd.mutateAsync(aaben.id); onOpenChange(false); } catch { /* toast */ } } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="break-words">{retning === "beskyt" ? "Beskyt kolonne" : "Ophæv beskyttelse"}: {felt.felt_navn}</DialogTitle>
          <DialogDescription>{kolonne}{felt.kampagne_ekstern_id ? ` · kampagne ${felt.kampagne_ekstern_id}` : " · alle kampagner"}. Ændringen gælder først, når superadmin aktiverer den.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1" aria-label="Trin">
          {TRIN.map((t) => <Badge key={t.status} variant={ORDEN[t.status] === trinNu || (trinNu === 0 && t.status === "kladde") ? "default" : ORDEN[t.status] < trinNu ? "secondary" : "outline"}>{t.label}</Badge>)}
        </div>
        {faerdig ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">{faerdig}</div>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              {retning === "beskyt"
                ? <>Værdierne i <span className="font-mono">{kolonne}</span> flyttes til en lukket tabel, som browseren ikke kan læse. Kun brugere med rettigheden »se beskyttede kaldsfelter« kan slå dem op (roller i dag: {roller.length ? roller.join(", ") : "ingen"}), og hvert opslag logges under Compliance › Adgangslog. Oprydningen rydder værdierne efter fristen som hidtil. KPI'er og tavler påvirkes ikke.</>
                : <>Værdierne flyttes tilbage til <span className="font-mono">{kolonne}</span> og læses igen som i dag. En nyere åben værdi vinder; værdier, som en anden beskyttelse stadig dækker, bliver lukkede.</>}
            </p>
            {aaben?.proevet && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <div className="font-medium">Tørkørsel {new Date(aaben.proevet).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" })}</div>
                <p>{(r?.raekker ?? 0).toLocaleString("da-DK")} {r?.raekker === 1 ? "række" : "rækker"} {retning === "beskyt" ? "har værdien i dag og flyttes til den lukkede tabel" : "ligger lukket i dag og flyttes tilbage"}.</p>
                <p>Nøglen »se beskyttede kaldsfelter«: {r?.roller?.length ? r.roller.join(", ") : "ingen roller"} · {r?.brugere ?? 0} {r?.brugere === 1 ? "bruger" : "brugere"}.</p>
                {r?.bemaerkning && <p className="text-muted-foreground">{r.bemaerkning}</p>}
              </div>
            )}
            {grundlagAendret && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">Kolonnens tabel, nøgle eller kampagne er ændret siden tørkørslen – tryk »Prøv igen«.</p>}
            {status === "godkendt" && klar && !erSuperadmin && <p className="rounded-md border p-2">Godkendt – afventer superadmin. Beskyttelsen aktiveres, når en superadmin trykker Aktivér.</p>}
            {status === "godkendt" && klar && erSuperadmin && kanRedigere && (
              <div className="space-y-1">
                <div className="font-medium">Aktivér med begrundelse</div>
                <Textarea value={begrundelse} onChange={(e) => setBegrundelse(e.target.value)} placeholder="Påkrævet, fx »kundens telefonnummer er personoplysning – kun ledere må se det«" rows={2} />
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {aaben && aaben.status !== "aktiv" && aaben.status !== "aktiverer" && !faerdig && kanRedigere && <Button variant="ghost" className="text-destructive" disabled={travl} onClick={fortrydNu}>Fortryd ændring</Button>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{faerdig ? "Luk" : "Annullér"}</Button>
            {!faerdig && kanRedigere && (status === "ny" || status === "kladde" || grundlagAendret) && <Button disabled={travl} onClick={proevNu}>{proev.isPending || opret.isPending ? "Tæller …" : grundlagAendret ? "Prøv igen" : "Prøv"}</Button>}
            {!faerdig && kanRedigere && status === "proevet" && klar && <Button disabled={travl} onClick={godkendNu}>Godkend</Button>}
            {!faerdig && kanRedigere && status === "proevet" && klar && <Button variant="ghost" disabled={travl} onClick={proevNu}>Prøv igen</Button>}
            {!faerdig && erSuperadmin && kanRedigere && status === "godkendt" && klar && <Button disabled={travl || begrundelse.trim() === ""} onClick={aktiverNu}>{aktiver.isPending ? "Aktiverer …" : "Aktivér"}</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
