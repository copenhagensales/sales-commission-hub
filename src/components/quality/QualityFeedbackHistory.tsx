import { AlertTriangle, Info, Loader2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQualityFeedbackHistory } from "@/hooks/useQualityFeedback";

/**
 * Permanent historik over kvalitetstilbagemeldinger på medarbejderens profil.
 * Bruges til den ugentlige 1-1 medlyt. Kvalitetsstatus påvirker ikke løn,
 * provision, afregning eller annulleringer.
 */
export function QualityFeedbackHistory({ employeeId }: { employeeId?: string | null }) {
  const { data: rows = [], isLoading, error } = useQualityFeedbackHistory(employeeId);

  const formatted = (iso: string) =>
    new Intl.DateTimeFormat("da-DK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Copenhagen",
    }).format(new Date(iso));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kvalitetstilbagemeldinger</CardTitle>
        <CardDescription>
          Tilbagemeldinger fra kvalitetskontrollen. De påvirker ikke provision, løn eller
          annulleringer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Henter …
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">Ingen adgang til kvalitetshistorikken.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen tilbagemeldinger endnu.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const rejected = row.result === "afvist";
              return (
                <div
                  key={row.review_id}
                  className={`rounded-md border-l-2 bg-muted/30 px-3 py-2 ${
                    rejected ? "border-l-destructive" : "border-l-warning"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {rejected ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Info className="h-3.5 w-3.5 text-warning" />
                    )}
                    <span className="text-sm font-medium">{formatted(row.occurred_at)}</span>
                    <Badge
                      variant="outline"
                      className={
                        rejected
                          ? "border-destructive/40 text-destructive"
                          : "border-warning/40 text-warning"
                      }
                    >
                      {rejected ? "Afvist" : "Feedback"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {row.campaign_name ?? "Ukendt kampagne"}
                      {row.search_key ? ` · ${row.search_key}` : ""}
                    </span>
                  </div>

                  {row.reason_labels && row.reason_labels.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fejltype: {row.reason_labels.join(" · ")}
                    </p>
                  )}

                  {row.comment && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground/90">
                      <MessageSquare className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {row.comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
