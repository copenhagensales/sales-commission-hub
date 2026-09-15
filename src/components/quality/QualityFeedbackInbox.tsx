import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useAcknowledgeQualityFeedback,
  useMyQualityFeedback,
  type QualityFeedbackRow,
} from "@/hooks/useQualityFeedback";

/**
 * Kvalitetsfeedback på forsiden — samme kasse for sælger og teamledelse.
 *
 * Tager aldrig fokus: ingen modal, intet overlay, ingen lyd og ingen
 * opmærksomhedskrævende animation. Pladsen er reserveret, så forsiden ikke
 * hopper når en sag drypper ind. Flere sager vises som én kø ("1 af 3").
 */

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

export function QualityFeedbackInbox() {
  const { data: rows = [], isLoading } = useMyQualityFeedback();
  const acknowledge = useAcknowledgeQualityFeedback();
  const { toast } = useToast();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index > rows.length - 1) setIndex(rows.length > 0 ? rows.length - 1 : 0);
  }, [rows.length, index]);

  if (isLoading || rows.length === 0) return null;

  const row: QualityFeedbackRow | undefined = rows[index];
  if (!row) return null;

  const rejected = row.result === "afvist";
  const isLeader = row.role !== "saelger";

  const handleAck = async () => {
    try {
      await acknowledge.mutateAsync({ reviewId: row.review_id, role: row.role });
    } catch (error) {
      toast({
        title: "Kunne ikke kvittere",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-[168px]">
      <div
        className={`rounded-lg border bg-card p-4 shadow-sm ${
          rejected ? "border-destructive/50" : "border-warning/50"
        }`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {rejected ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Info className="h-4 w-4 text-warning" />
            )}
            <Badge variant={rejected ? "destructive" : "outline"} className={rejected ? "" : "border-warning/50 text-warning"}>
              {rejected ? "Afvist i kvalitetskontrollen" : "Feedback"}
            </Badge>
            {isLeader && (
              <span className="text-xs text-muted-foreground">
                {row.seller_name ?? "Ukendt sælger"}
                {row.team_name ? ` · ${row.team_name}` : ""}
              </span>
            )}
          </div>

          {rows.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="Forrige tilbagemelding"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {index + 1} af {rows.length}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={index >= rows.length - 1}
                onClick={() => setIndex((i) => Math.min(rows.length - 1, i + 1))}
                aria-label="Næste tilbagemelding"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className="text-2xl font-semibold leading-none">kl. {formatTime(row.occurred_at)}</p>
          <p className="text-sm text-muted-foreground">{formatDate(row.occurred_at)}</p>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            Kampagne: <span className="text-foreground">{row.campaign_name ?? "Ukendt"}</span>
          </span>
          <span className="text-muted-foreground">
            Kunde/salg: <span className="text-foreground">{row.search_key ?? "Ingen reference"}</span>
          </span>
        </div>

        {row.reason_labels && row.reason_labels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {row.reason_labels.map((label) => (
              <Badge
                key={label}
                variant="outline"
                className={rejected ? "border-destructive/40 text-destructive" : "border-warning/40 text-warning"}
              >
                {label}
              </Badge>
            ))}
          </div>
        )}

        {row.comment && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
            <MessageSquare className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-snug text-foreground/90">{row.comment}</p>
          </div>
        )}

        <p className="mt-3 text-xs leading-snug text-muted-foreground">
          {isLeader
            ? rejected
              ? "Salget er afvist i kvalitetskontrollen. Det påvirker ikke sælgerens provision, løn eller annulleringer."
              : "Salget står ved magt. Det er en tilbagemelding til sælgeren — ikke en anmærkning."
            : rejected
              ? "Salget er afvist i kvalitetskontrollen. Det påvirker ikke din provision."
              : "Salget står ved magt. Det er en tilbagemelding — ikke en anmærkning, og det påvirker ikke din provision."}
        </p>

        <div className="mt-3 flex items-center justify-end gap-3">
          {viewAsActive && (
            <span className="text-xs text-muted-foreground">
              Du ser Stork som en anden — kvittering er slået fra.
            </span>
          )}
          <Button
            size="sm"
            onClick={() => void handleAck()}
            disabled={acknowledge.isPending || viewAsActive}
          >
            {acknowledge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLeader ? "Set" : "OK"}
          </Button>
        </div>
      </div>
    </div>
  );
}
