import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeartPulse, AlertTriangle, CheckCircle2 } from "lucide-react";

interface HealthCheck {
  label: string;
  value: number;
  threshold: number;
  unit: string;
  status: "ok" | "warning" | "critical";
}

export function DataHealthChecks() {
  const { data: checks = [], isLoading } = useQuery({
    queryKey: ["data-health-checks"],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const results: HealthCheck[] = [];

      // 1. Sales without sale_items (last 24h)
      const { count: salesWithoutItems } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .gte("sale_datetime", since24h)
        .not("id", "in", 
          `(SELECT DISTINCT sale_id FROM sale_items)`
        );

      // Fallback: count sales and sale_items separately
      const { count: totalSales24h } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .gte("sale_datetime", since24h);

      const { data: saleIdsWithItems } = await supabase
        .from("sale_items")
        .select("sale_id")
        .gte("created_at", since24h);

      const uniqueSaleIdsWithItems = new Set((saleIdsWithItems || []).map(s => s.sale_id));
      const orphanedSales = (totalSales24h || 0) - uniqueSaleIdsWithItems.size;
      const orphanCount = Math.max(orphanedSales, 0);

      results.push({
        label: "Salg uden sale_items (24t)",
        value: orphanCount,
        threshold: 5,
        unit: "stk",
        status: orphanCount > 10 ? "critical" : orphanCount > 0 ? "warning" : "ok",
      });

      // 2. FM trigger success rate (FM sales vs FM sale_items, 24h)
      const { count: fmSalesCount } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("source", "fieldmarketing")
        .gte("sale_datetime", since24h);

      const { data: fmSaleIds } = await supabase
        .from("sales")
        .select("id")
        .eq("source", "fieldmarketing")
        .gte("sale_datetime", since24h);

      let fmWithItems = 0;
      if (fmSaleIds && fmSaleIds.length > 0) {
        const ids = fmSaleIds.map(s => s.id);
        const batchSize = 200;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          const { data: items } = await supabase
            .from("sale_items")
            .select("sale_id")
            .in("sale_id", batch);
          fmWithItems += new Set((items || []).map(i => i.sale_id)).size;
        }
      }

      const fmTotal = fmSalesCount || 0;
      const fmSuccessRate = fmTotal > 0 ? Math.round((fmWithItems / fmTotal) * 100) : 100;

      results.push({
        label: "FM trigger success rate (24t)",
        value: fmSuccessRate,
        threshold: 95,
        unit: "%",
        status: fmSuccessRate < 80 ? "critical" : fmSuccessRate < 95 ? "warning" : "ok",
      });

      // 3. Unknown/unmatched products (24h)
      const { count: unknownProducts } = await supabase
        .from("sale_items")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24h)
        .or("adversus_product_title.eq.Unknown,adversus_external_id.eq.unknown");

      const unknownCount = unknownProducts || 0;
      results.push({
        label: "Ukendte produkter (24t)",
        value: unknownCount,
        threshold: 3,
        unit: "stk",
        status: unknownCount > 10 ? "critical" : unknownCount > 0 ? "warning" : "ok",
      });

      // 4. Rejected sales ratio (24h)
      const { count: rejectedCount } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("validation_status", "rejected")
        .gte("sale_datetime", since24h);

      const rejectedRatio = (totalSales24h || 0) > 0
        ? Math.round(((rejectedCount || 0) / (totalSales24h || 1)) * 100)
        : 0;

      results.push({
        label: "Afvist-rate (24t)",
        value: rejectedRatio,
        threshold: 15,
        unit: "%",
        status: rejectedRatio > 25 ? "critical" : rejectedRatio > 15 ? "warning" : "ok",
      });

      return results;
    },
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const statusIcon = (status: HealthCheck["status"]) => {
    switch (status) {
      case "ok": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const statusBadge = (status: HealthCheck["status"]) => {
    switch (status) {
      case "ok": return <Badge variant="default" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">OK</Badge>;
      case "warning": return <Badge variant="secondary" className="text-[10px]">Advarsel</Badge>;
      case "critical": return <Badge variant="destructive" className="text-[10px]">Kritisk</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <HeartPulse className="h-4 w-4" />
          Data Health Checks
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Automatisk kontrol af dataintegritet og trigger-sundhed
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Kører health checks...</p>
        ) : checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen health checks tilgængelige</p>
        ) : (
          <div className="space-y-2">
            {checks.map((check, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  {statusIcon(check.status)}
                  <span className="font-medium">{check.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {check.value}{check.unit} (grænse: {check.threshold}{check.unit})
                  </span>
                  {statusBadge(check.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
