import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAdjustmentProductNames, usePricingAdjustments, useToggleAdjustment } from "@/hooks/usePricingAdjustments";

function conditionText(conditions: unknown): string {
  if (!conditions || typeof conditions !== "object") return "–";
  return Object.entries(conditions as Record<string, unknown>)
    .map(([k, v]) => `${k} = ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" og ");
}

export function PricingAdjustmentsTab() {
  const { data: rules = [], isLoading, error } = usePricingAdjustments();
  const excludedIds = [...new Set(rules.flatMap((r) => r.excluded_product_ids ?? []))];
  const { data: productNames } = useAdjustmentProductNames(excludedIds);
  const toggle = useToggleAdjustment();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Justeringer til sidst</CardTitle>
        <CardDescription>
          Anvendes efter at satsen er fundet via prisregel eller grundpris. Reduktionen gælder både provision og
          omsætning. Ændringer slår igennem på eksisterende salg ved næste genberegning af priser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Indlæser …</p>}
        {error && <p className="text-sm text-destructive">Kunne ikke hente justeringer.</p>}
        {!isLoading && rules.length === 0 && <p className="text-sm text-muted-foreground">Ingen justeringer.</p>}
        {rules.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <Badge variant="secondary">−{Number(r.percent_reduction)} %</Badge>
                <Badge variant="outline">{r.clients?.name ?? "Ukendt kunde"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Betingelse: {conditionText(r.conditions)}</p>
              <p className="text-sm text-muted-foreground">
                Gælder fra {r.effective_from ?? "altid"}
                {r.effective_to ? ` til ${r.effective_to}` : ""}
              </p>
              {(r.excluded_product_ids ?? []).length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Undtaget: {(r.excluded_product_ids ?? []).map((id) => productNames?.get(id) ?? id).join(", ")}
                </p>
              )}
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              Aktiv
              <Switch
                checked={r.is_active}
                disabled={toggle.isPending}
                onCheckedChange={(v) =>
                  toggle.mutate(
                    { id: r.id, isActive: v },
                    { onError: () => toast.error("Kunne ikke ændre justeringen") },
                  )
                }
              />
            </label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
