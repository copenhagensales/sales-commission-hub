import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { SLETTEREGEL_STATUS, forklarToerkoersel, type SletteregelAendring, type SletteregelStatus } from "@/hooks/useSletteregler";
import type { KatalogKlassifikation } from "@/hooks/useKaldFeltKatalog";

/** Rettighedsnøgle som data (masterplan 1.8); databasen håndhæver skridtene (SR1 krav 4). */
export const SLETTEREGEL_NOEGLE = "tab_integrationer_sletteregler";

/** Personfølsom kolonne (SR3 krav 2): klassifikationen foreslår beskyttelse; selve beskyttelsen er et eksplicit valg pr. kolonne (SR3b). */
export const PERSONFOELSOMME: KatalogKlassifikation[] = ["person", "identifikator", "foelsom"];
export const erPersonfoelsom = (k: string) => (PERSONFOELSOMME as string[]).includes(k);

const LEDER_TITLER = ["ejer", "teamleder", "assisterende teamleder", "assisterende teamleder fm", "fieldmarketing leder", "rekruttering"];  // spejler is_teamleder_or_above (tørkørslens krav)

/** Hvem må oprette/prøve/godkende sletteregel-kladder: ejer eller superadmin med lederadgang (Codex SR2 r2 P2-8); databasen afgør endeligt (is_owner/is_superadmin). */
export function useSletteregelRedigering(redigerbar: boolean) {
  const p = usePermissions();
  const { isSuperadmin } = useIsSuperadmin();
  const navn = p.position?.name?.toLowerCase() ?? "";  // samme ejer-afgørelse som Administration (useAdminSynlighed)
  const erEjer = navn === "ejer";
  const erLeder = LEDER_TITLER.includes(navn);
  return { kanRedigere: p.canEdit(SLETTEREGEL_NOEGLE) && redigerbar && (erEjer || (isSuperadmin && erLeder)), kanSe: p.canView(SLETTEREGEL_NOEGLE), isSuperadmin };
}

export function tid(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" }) : "–";
}
export function fristTekst(d: number | null | undefined, tom = "ingen"): string {
  return d == null ? tom : `${d} d`;
}

export function AendringInfo({ a }: { a?: SletteregelAendring }) {
  if (!a) return <span className="text-muted-foreground">–</span>;
  const s = SLETTEREGEL_STATUS[a.status as SletteregelStatus];
  return (
    <div className="text-xs space-y-0.5">
      <div className="flex items-center gap-1"><Badge variant={s?.variant ?? "outline"}>{s?.label ?? a.status}</Badge><span>{fristTekst(a.frist_dage, a.maal === "klient" ? "fjern klientregel" : a.maal === "kampagne" ? "følg klienten / ingen" : "følg kampagnen")}</span></div>
      {a.proevet && <div className="text-muted-foreground" title={`Tørkørsel ${tid(a.proevet)}`}>{forklarToerkoersel(a.proevet_resultat as Parameters<typeof forklarToerkoersel>[0])[0] ?? "–"}</div>}
      {a.proevet && typeof (a.proevet_resultat as { advarsel?: string } | null)?.advarsel === "string" && <div className="text-destructive">{(a.proevet_resultat as { advarsel: string }).advarsel}</div>}
      {a.godkendt && <div className="text-muted-foreground">Godkendt {tid(a.godkendt)}</div>}
    </div>
  );
}

export function Historik({ rader, navne }: { rader: SletteregelAendring[]; navne: Map<string, string> }) {
  if (rader.length === 0) return <div className="text-xs text-muted-foreground">Ingen aktiveringer endnu.</div>;
  return (
    <ul className="text-xs space-y-0.5">
      {rader.slice(0, 5).map((h) => {
        const foer = (h.foer ?? {}) as Record<string, number | boolean | string | null>;
        const foerFrist = (foer.retention_days ?? foer.retention_dage ?? foer.frist_dage) as number | null | undefined;
        const foerKilde = typeof foer.regel_kilde === "string" ? ` (${foer.regel_kilde === "klient" ? "fra klient" : "egen"})` : "";
        const af = h.aktiveret_af ? navne.get(h.aktiveret_af) ?? "superadmin" : "startværdi";
        return <li key={h.id}><span className="text-muted-foreground">{tid(h.aktiveret)}</span> · {fristTekst(h.frist_dage, "ingen frist")} <span className="text-muted-foreground">(før: {fristTekst(foerFrist ?? null)}{foerKilde})</span> · {af} · {h.begrundelse}</li>;
      })}
    </ul>
  );
}
