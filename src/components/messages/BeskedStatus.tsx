import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Message, useBegrundelse, useAfgoer, useFjernFil, BEGRUNDELSE_TEKST, handlingsTekst, tagHandling, useHandling, rydUkendt,
} from "@/hooks/useChat";
import { useQueryClient } from "@tanstack/react-query";
import { fastholdEjer, ejerGyldig, type OperationsEjer } from "@/lib/sbKladder";

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
  const qc = useQueryClient();
  // B2b-2 §4: fælles lås pr. bruger/besked (også for boblen); overlever kortets afmontering.
  const laas = useHandling(currentEmployeeId, conversationId, message.id);
  const optaget = !!laas.art;

  if (message.status === "tjekkes") {
    return (
      <p className="mt-1 flex items-center gap-1 text-[14px] text-muted-foreground" aria-live="polite">
        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Tjekkes …
      </p>
    );
  }
  if (!afventer) return null;

  // Fejl vises kun i den session/kontekst, handlingen blev startet i.
  const fejl = (ejer: OperationsEjer, e: unknown, fast: string) => {
    if (!ejerGyldig(ejer)) return;
    const t = handlingsTekst(e, fast);
    if (t) toast.error(t);
  };
  /** B2b-1 §3: kontekst og den viste rækkes revision fastholdes synkront ved trykket; uden ejer ingen handling. */
  const start = () => {
    const ejer = fastholdEjer(currentEmployeeId, conversationId, authBrugerId);
    return ejer ? { ejer, vars: { messageId: message.id, revision: message.revision, conversationId, ejer } } : null;
  };
  const kode = begr.data ?? null;
  const kanSende = !!kode && kode !== "cpr_fil" && kode !== "ikke_tjekket_fil";
  const afgoerKlik = (handling: "send" | "traek", fast: string) => {
    const s = start();
    if (!s || !tagHandling(s.ejer, message.id, handling)) return; // ignoreret klik: ingen mutation, ingen toast
    afgoer.mutate({ ...s.vars, handling }, { onError: (e) => fejl(s.ejer, e, fast) });
  };
  const fjernKlik = () => {
    const s = start();
    if (!s || !tagHandling(s.ejer, message.id, "fjern")) return;
    fjern.mutate(s.vars, { onError: (e) => fejl(s.ejer, e, "Kunne ikke fjerne filen") });
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
      {laas.ukendt && !laas.art && currentEmployeeId && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[14px]" role="alert">Udfaldet kunne ikke bekræftes</p>
          <Button size="sm" variant="outline" className="min-h-11"
            onClick={() => { rydUkendt(currentEmployeeId, conversationId, message.id); void qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] }); }}>
            Tjek igen
          </Button>
        </div>
      )}
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
