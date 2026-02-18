import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Webhook } from "lucide-react";

export function WebhookActivity() {
  const { data: webhookStats = [] } = useQuery({
    queryKey: ["system-stability-webhook-activity"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Count webhook-related logs from integration_logs
      const { data } = await supabase
        .from("integration_logs")
        .select("integration_name, status, created_at")
        .gte("created_at", since)
        .or("message.ilike.%webhook%,integration_name.ilike.%webhook%")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!data || data.length === 0) {
        // Fallback: count adversus_events as webhook activity
        const { count: adversusCount } = await supabase
          .from("adversus_events")
          .select("id", { count: "exact", head: true })
          .gte("received_at", since);

        if (adversusCount && adversusCount > 0) {
          return [{ name: "Adversus Webhook", count: adversusCount, lastAt: null }];
        }
        return [];
      }

      // Group by integration_name
      const grouped: Record<string, { count: number; lastAt: string | null }> = {};
      for (const log of data) {
        const name = log.integration_name || "Ukendt webhook";
        if (!grouped[name]) grouped[name] = { count: 0, lastAt: null };
        grouped[name].count++;
        if (!grouped[name].lastAt || log.created_at > grouped[name].lastAt!) {
          grouped[name].lastAt = log.created_at;
        }
      }

      return Object.entries(grouped).map(([name, stats]) => ({
        name,
        count: stats.count,
        lastAt: stats.lastAt,
      }));
    },
    refetchInterval: 60000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          Webhook-aktivitet (24 timer)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Webhooks modtager data passivt og påvirker normalt ikke rate limits
        </p>
      </CardHeader>
      <CardContent>
        {webhookStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen webhook-aktivitet registreret</p>
        ) : (
          <div className="space-y-2">
            {webhookStats.map((wh) => (
              <div key={wh.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{wh.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {wh.count} modtaget
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
