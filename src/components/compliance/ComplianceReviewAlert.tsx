import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useComplianceReviewStatus } from "@/hooks/useComplianceReviewStatus";

const severityLabel: Record<string, string> = {
  overdue: "Overskredet",
  due_soon: "Snart",
  missing: "Mangler",
};

export function ComplianceReviewAlert() {
  const navigate = useNavigate();
  const { items, isLoading, hasOverdue } = useComplianceReviewStatus();

  if (isLoading) return null;

  if (items.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-foreground">
            Alt er gennemgået og gyldigt. Ingen compliance-dokumenter afventer review.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={
        hasOverdue
          ? "border-destructive/40 bg-destructive/5"
          : "border-amber-500/40 bg-amber-500/5"
      }
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={
              hasOverdue
                ? "h-5 w-5 text-destructive mt-0.5 shrink-0"
                : "h-5 w-5 text-amber-600 mt-0.5 shrink-0"
            }
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {items.length} {items.length === 1 ? "punkt" : "punkter"} afventer review
            </p>
            <p className="text-xs text-muted-foreground">
              Gennemgå punkterne, så dokumentationen er opdateret og gyldig.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.href)}
              className="w-full text-left rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={
                      item.severity === "overdue"
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                    }
                  >
                    {severityLabel[item.severity]}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
