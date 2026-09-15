import { useState } from "react";
import { AlertTriangle, Info, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useViewAsStatus } from "@/hooks/useViewAs";
import {
  useAcknowledgeQualityFeedback,
  useMyQualityFeedback,
  type QualityFeedbackRow,
} from "@/hooks/useQualityFeedback";

/**
 * Kvalitetsfeedback på forsiden — samme kasse for sælger og teamledelse.
 *
 * Tager aldrig fokus: ingen modal, intet overlay, ingen lyd og ingen
 * opmærksomhedskrævende animation. Alle ukvitterede sager vises som en liste,
 * så man ser hele billedet med det samme i stedet for at bladre.
 */

const VISIBLE_BY_DEFAULT = 3;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

function FeedbackRow({
  row,
  onAcknowledge,
  disabled,
  pending,
}: {
  row: QualityFeedbackRow;
  onAcknowledge: () => void;
  disabled: boolean;
  pending: boolean;
}) {
  const rejected = row.result === "afvist";
  const isLeader = row.role !== "saelger";

  return (
    <div
      className={`rounded-md border p-3 ${
        rejected ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rejected ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-warning" />
            )}
            <Badge
              variant={rejected ? "destructive" : "outline"}
              className={rejected ? "" : "border-warning/50 text-warning"}
            >
              {rejected ? "Afvist i kvalitetskontrollen" : "Feedback — salget står ved magt"}
            </Badge>
            {isLeader && (
              <span className="truncate text-sm font-medium">
                {row.seller_name ?? "Ukendt sælger"}
                {row.team_name ? ` · ${row.team_name}` : ""}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">kl. {formatTime(row.occurred_at)}</span>
            {" · "}
            {formatDate(row.occurred_at)}
            {" · "}
            {row.campaign_name ?? "Ukendt kampagne"}
            {" · "}
            {row.search_key ?? "Ingen reference"}
          </p>

          {row.reason_labels && row.reason_labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.reason_labels.map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  className={
                    rejected
                      ? "border-destructive/40 text-destructive"
                      : "border-warning/40 text-warning"
                  }
                >
                  {label}
                </Badge>
              ))}
            </div>
          )}

          {row.comment && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-background/70 px-3 py-2">
              <MessageSquare className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-sm leading-snug text-foreground/90">{row.comment}</p>
            </div>
          )}
        </div>

        <Button
          size="sm"
          onClick={onAcknowledge}
          disabled={disabled}
          className={`shrink-0 font-semibold shadow-sm ${
            rejected
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-warning text-warning-foreground hover:bg-warning/90"
          }`}
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLeader ? "Set — fjern" : "OK, forstået"}
        </Button>

      </div>
    </div>
  );
}

export function QualityFeedbackInbox() {
  const { data: rows = [], isLoading } = useMyQualityFeedback();
  const acknowledge = useAcknowledgeQualityFeedback();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ackAllPending, setAckAllPending] = useState(false);
  // "Se som" er ren læseadgang: kvittering skal bindes til den, der er logget ind.
  const { data: viewAs } = useViewAsStatus();
  const viewAsActive = viewAs?.active === true;

  if (isLoading || rows.length === 0) return null;

  const visible = expanded ? rows : rows.slice(0, VISIBLE_BY_DEFAULT);
  const hidden = rows.length - visible.length;

  const ack = async (row: QualityFeedbackRow) => {
    setPendingId(row.review_id);
    try {
      await acknowledge.mutateAsync({ reviewId: row.review_id, role: row.role });
    } catch (error) {
      toast({
        title: "Kunne ikke kvittere",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
    }
  };

  const ackAll = async () => {
    setAckAllPending(true);
    try {
      for (const row of rows) {
        await acknowledge.mutateAsync({ reviewId: row.review_id, role: row.role });
      }
    } catch (error) {
      toast({
        title: "Kunne ikke kvittere alle",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setAckAllPending(false);
    }
  };

  const busy = ackAllPending || pendingId !== null;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Kvalitetskontrol · {rows.length} {rows.length === 1 ? "tilbagemelding" : "tilbagemeldinger"}
        </h2>
        <div className="flex items-center gap-3">
          {viewAsActive && (
            <span className="text-xs text-muted-foreground">
              Du ser Stork som en anden — kvittering er slået fra.
            </span>
          )}
          {rows.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => void ackAll()} disabled={busy || viewAsActive}>
              {ackAllPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kvitter alle
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {visible.map((row) => (
          <FeedbackRow
            key={row.review_id}
            row={row}
            onAcknowledge={() => void ack(row)}
            disabled={busy || viewAsActive}
            pending={pendingId === row.review_id}
          />
        ))}
      </div>

      {hidden > 0 && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setExpanded(true)}>
          Vis alle ({rows.length})
        </Button>
      )}
      {expanded && rows.length > VISIBLE_BY_DEFAULT && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setExpanded(false)}>
          Vis færre
        </Button>
      )}
    </div>
  );
}
