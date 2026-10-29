import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Message, useBegrundelse, useAfgoer, useFjernFil, BEGRUNDELSE_TEKST, tagHandling, useHandling, tjekUdfaldIgen,
} from "@/hooks/useChat";
import { useQueryClient } from "@tanstack/react-query";
import { fastholdEjer } from "@/lib/sbKladder";
import { useState } from "react";

/**
 * B2b-3a §1: fælles visning af ukendt/uopdateret udfald (statuskort, leveret boble og editor).
 * »Tjek igen« læser kun og vurderer det bevarede snapshot; fejlet læsning bevarer tilstanden. onAfklaret får vurderingen.
 */
export function UkendtUdfald({ emp, conversationId, messageId, onAfklaret }: {
  emp: string; conversationId: string; messageId: string; onAfklaret?: (v: "bekraeftet" | "konflikt") => void;
}) {
  const qc = useQueryClient();
  const laas = useHandling(emp, conversationId, messageId);
  const [ulaest, setUlaest] = useState(false);
  // Åben editor ('ret') rydder/skjuler ikke tilstanden; under en anden skrivende handling er snapshottet erstattet.
  if (!laas.ukendt || (laas.art && laas.art !== "ret")) return null;
  const tjek = async () => {
    const v = await tjekUdfaldIgen(qc, emp, conversationId, messageId);
    setUlaest(v === "ukendt");
    if (v === "konflikt") toast.error("Beskeden er ændret – prøv igen");
    if (v === "bekraeftet" || v === "konflikt") onAfklaret?.(v);
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="text-[14px]" role="alert">
        {laas.bekraeftet ? "Handlingen er gennemført, men visningen kunne ikke opdateres" : "Udfaldet kunne ikke bekræftes"}
        {ulaest && !laas.tjekker ? " – stadig ikke afklaret" : ""}
      </p>
      <Button size="sm" variant="outline" className="min-h-11" disabled={laas.tjekker} onClick={() => void tjek()}>
        {laas.tjekker ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tjek igen"}
      </Button>
    </div>
  );
}

interface Props {
  message: Message;
  conversationId: string;
  currentEmployeeId?: string;
  /** Auth-bruger-id til operationskonteksten (B2b-1). */
  authBrugerId?: string | null;
  onRet: () => void;
}

/** Status for egne beskeder (tjekkes / afventer_afsender) integreret i MessageBubble. */
export function BeskedStatus({ message, conversationId, currentEmployeeId, authBrugerId = null, onRet }: Props) {
  const afventer = message.status === "afventer_afsender";
  const begr = useBegrundelse(currentEmployeeId, message.id, message.revision, afventer);
  const afgoer = useAfgoer();
  const fjern = useFjernFil();
  // B2b-2 §4: fælles lås pr. bruger/besked (også for boblen); overlever kortets afmontering.
  const laas = useHandling(currentEmployeeId, conversationId, message.id);
  // B2b-4a §1: et igangværende »Tjek igen« spærrer også for nye skrivekald.
  const optaget = !!laas.art || laas.tjekker;

  if (message.status === "tjekkes") {
    return (
      <p className="mt-1 flex items-center gap-1 text-[14px] text-muted-foreground" aria-live="polite">
        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Tjekkes …
      </p>
    );
  }
  if (!afventer) return null;

  /** B2b-1 §3: kontekst og den viste rækkes revision fastholdes synkront ved trykket; uden ejer ingen handling. */
  const start = () => {
    const ejer = fastholdEjer(currentEmployeeId, conversationId, authBrugerId);
    return ejer ? { ejer, vars: { messageId: message.id, revision: message.revision, conversationId, ejer } } : null;
  };
  // B2b-3a §2a: den viste rækkes grundlag; et bekræftet men ikke genhentet resultat spærrer for det gamle grundlag.
  const vis = { revision: message.revision, status: message.status };
  const kode = begr.data ?? null;
  const kanSende = !!kode && kode !== "cpr_fil" && kode !== "ikke_tjekket_fil";
  const afgoerKlik = (handling: "send" | "traek", fast: string) => {
    const s = start();
    if (!s || !tagHandling(s.ejer, message.id, handling, vis)) return; // ignoreret klik: ingen mutation, ingen toast
    afgoer.mutate({ ...s.vars, handling, startStatus: message.status, fejltekst: fast });
  };
  const fjernKlik = () => {
    const s = start();
    if (!s || !tagHandling(s.ejer, message.id, "fjern", vis)) return;
    // B2b-3a §1: filreferencen fra handlingens start fastholdes.
    fjern.mutate({ ...s.vars, filRef: message.attachment_path ?? null, fejltekst: "Kunne ikke fjerne filen" });
  };

  return (
    <div className="mt-2 w-full min-w-0 rounded-lg border border-border bg-card p-3 text-card-foreground" role="status">
      <p className="text-[14px] font-medium">Din besked afventer dig</p>
      {begr.isLoading || (!kode && !begr.isError && begr.isFetching) ? (
        <p className="mt-1 text-[14px] text-muted-foreground">Henter begrundelse …</p>
      ) : begr.isError || !kode ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-[14px] text-muted-foreground">Henter begrundelse …</p>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => void begr.refetch()}>Prøv igen</Button>
        </div>
      ) : (
        <p className="mt-1 text-[14px]">{BEGRUNDELSE_TEKST[kode]}</p>
      )}
      {currentEmployeeId && <UkendtUdfald emp={currentEmployeeId} conversationId={conversationId} messageId={message.id} />}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {kanSende && (
          <Button size="sm" className="min-h-11" disabled={optaget}
            onClick={() => afgoerKlik("send", "Kunne ikke sende beskeden")}>
            {laas.art === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send alligevel"}
          </Button>
        )}
        <Button size="sm" variant="outline" className="min-h-11" disabled={optaget} onClick={onRet}>Ret</Button>
        {message.attachment_path && (
          <Button size="sm" variant="outline" className="min-h-11" disabled={optaget} onClick={fjernKlik}>
            {laas.art === "fjern" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fjern fil"}
          </Button>
        )}
        <Button size="sm" variant="outline" className="min-h-11 text-destructive" disabled={optaget}
          onClick={() => afgoerKlik("traek", "Kunne ikke trække beskeden tilbage")}>
          {laas.art === "traek" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Træk tilbage"}
        </Button>
      </div>
    </div>
  );
}
