import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { COMPLIANCE_REVIEW_AREAS } from "@/config/complianceDocuments";
import {
  useComplianceAreaReviews,
  useConfirmComplianceReview,
} from "@/hooks/useComplianceAreaReviews";
import { useCanManageDpaDocuments } from "@/hooks/useDpaDocuments";

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDa(date: Date): string {
  return date.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

export function ComplianceReviewPanel() {
  const navigate = useNavigate();
  const { data: reviews = [], isLoading } = useComplianceAreaReviews();
  const { data: canConfirm } = useCanManageDpaDocuments();
  const confirm = useConfirmComplianceReview();

  const latestByArea = new Map<string, string>();
  for (const r of reviews) {
    if (!latestByArea.has(r.area_key)) latestByArea.set(r.area_key, r.reviewed_at);
  }

  const handleConfirm = (areaKey: string, title: string) => {
    confirm.mutate(
      { areaKey },
      {
        onSuccess: () => toast.success(`Gennemgang bekræftet: ${title}`),
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Kunne ikke bekræfte gennemgangen"),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Årlig gennemgang</CardTitle>
        <p className="text-sm text-muted-foreground">
          Bekræft at området er gennemgået. Bekræftelsen gemmes med dato og navn og kan ikke
          ændres bagefter.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {COMPLIANCE_REVIEW_AREAS.map((area) => {
          const last = latestByArea.get(area.key);
          const lastDate = last ? new Date(last) : null;
          const due = lastDate ? addMonths(lastDate, area.reviewIntervalMonths) : null;
          const overdue = !due || due.getTime() < Date.now();

          return (
            <div
              key={area.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
            >
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => navigate(area.href)}
                  className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  {area.title}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <p className="text-xs text-muted-foreground">
                  {isLoading
                    ? "Henter..."
                    : lastDate
                      ? `Senest gennemgået ${formatDa(lastDate)} · næste inden ${formatDa(due!)}`
                      : "Ingen gennemgang registreret endnu"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    overdue
                      ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                  }
                >
                  {overdue ? "Skal gennemgås" : "Gyldig"}
                </Badge>
                {canConfirm &&
                  (overdue ? (
                    <Button
                      size="sm"
                      disabled={confirm.isPending}
                      onClick={() => handleConfirm(area.key, area.title)}
                    >
                      {confirm.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Bekræft gennemgang
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Bekræftet {lastDate ? formatDa(lastDate) : ""}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
