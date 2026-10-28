import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Message, useBegrundelse, useAfgoer, useFjernFil, BEGRUNDELSE_TEKST, serverTekst, erForaeldet,
} from "@/hooks/useChat";

interface Props {
  message: Message;
  conversationId: string;
  currentEmployeeId?: string;
  onRet: () => void;
}

/** Status for egne beskeder (tjekkes / afventer_afsender) integreret i MessageBubble. */
export function BeskedStatus({ message, conversationId, currentEmployeeId, onRet }: Props) {
  const afventer = message.status === "afventer_afsender";
  const begr = useBegrundelse(currentEmployeeId, message.id, message.revision, afventer);
  const afgoer = useAfgoer();
  const fjern = useFjernFil();
  const optaget = afgoer.isPending || fjern.isPending;

  if (message.status === "tjekkes") {
    return (
      <p className="mt-1 flex items-center gap-1 text-[14px] text-muted-foreground" aria-live="polite">
        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Tjekkes …
      </p>
    );
  }
  if (!afventer) return null;

  const fejl = (e: unknown, fast: string) => {
    if (erForaeldet(e)) toast.error("Beskeden er ændret – prøv igen");
    else toast.error(serverTekst(e, fast));
  };
  const vars = { messageId: message.id, revision: message.revision, conversationId };
  const kode = begr.data ?? null;
  const kanSende = !!kode && kode !== "cpr_fil" && kode !== "ikke_tjekket_fil";

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
      <div className="mt-2 grid grid-cols-2 gap-2">
        {kanSende && (
          <Button size="sm" className="min-h-11" disabled={optaget}
            onClick={() => afgoer.mutate({ ...vars, handling: "send" }, { onError: (e) => fejl(e, "Kunne ikke sende beskeden") })}>
            {afgoer.isPending && afgoer.variables?.handling === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send alligevel"}
          </Button>
        )}
        <Button size="sm" variant="outline" className="min-h-11" disabled={optaget} onClick={onRet}>Ret</Button>
        {message.attachment_path && (
          <Button size="sm" variant="outline" className="min-h-11" disabled={optaget}
            onClick={() => fjern.mutate(vars, { onError: (e) => fejl(e, "Kunne ikke fjerne filen") })}>
            {fjern.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fjern fil"}
          </Button>
        )}
        <Button size="sm" variant="outline" className="min-h-11 text-destructive" disabled={optaget}
          onClick={() => afgoer.mutate({ ...vars, handling: "traek" }, { onError: (e) => fejl(e, "Kunne ikke trække beskeden tilbage") })}>
          {afgoer.isPending && afgoer.variables?.handling === "traek" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Træk tilbage"}
        </Button>
      </div>
    </div>
  );
}
