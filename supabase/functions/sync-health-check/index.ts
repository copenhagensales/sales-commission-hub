import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Check if current time is within Danish working hours (08:00-21:00 Europe/Copenhagen)
 */
function isDanishWorkingHours(): boolean {
  const now = new Date();
  const dkHour = parseInt(
    now.toLocaleString('en-US', { 
      hour: 'numeric', hour12: false, timeZone: 'Europe/Copenhagen' 
    })
  );
  return dkHour >= 8 && dkHour < 21;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const alerts: { integration: string; level: string; message: string }[] = [];
    const isWorkingHours = isDanishWorkingHours();

    // 1. Check all active integrations for data freshness
    const { data: integrations } = await supabase
      .from("dialer_integrations")
      .select("id, name, provider, last_sync_at")
      .eq("is_active", true);

    if (integrations) {
      for (const int of integrations) {
        const provider = (int.provider || "").toLowerCase();
        const isOffHours = (provider === "enreach" || provider === "adversus") && !isWorkingHours;

        // Skip freshness check during off-hours
        if (isOffHours) continue;

        if (int.last_sync_at) {
          const minsSince = (Date.now() - new Date(int.last_sync_at).getTime()) / 60000;
          if (minsSince > 30) {
            alerts.push({
              integration: int.name,
              level: minsSince > 60 ? "critical" : "warning",
              message: `Ingen sync i ${Math.floor(minsSince)} minutter`,
            });
          }
        } else {
          alerts.push({
            integration: int.name,
            level: "warning",
            message: "Aldrig synkroniseret",
          });
        }
      }
    }

    // 2. Check circuit breakers
    const { data: breakers } = await supabase
      .from("integration_circuit_breaker")
      .select("integration_id, consecutive_failures, paused_until, last_error")
      .gt("consecutive_failures", 0);

    if (breakers) {
      for (const cb of breakers) {
        const int = integrations?.find((i: any) => i.id === cb.integration_id);
        const name = int?.name || cb.integration_id;
        
        if (cb.paused_until && new Date(cb.paused_until) > new Date()) {
          alerts.push({
            integration: name,
            level: "critical",
            message: `Circuit breaker aktiv: pauset til ${cb.paused_until} (${cb.consecutive_failures} fejl)`,
          });
        } else if (cb.consecutive_failures >= 3) {
          alerts.push({
            integration: name,
            level: "warning",
            message: `${cb.consecutive_failures} konsekutive fejl`,
          });
        }
      }
    }

    // 3. Check quota status per provider
    for (const provider of ["enreach", "adversus"]) {
      const providerIntegrations = integrations?.filter((i: any) => (i.provider || "").toLowerCase() === provider) || [];
      if (providerIntegrations.length === 0) continue;

      const ids = providerIntegrations.map((i: any) => i.id);
      const { data: latestRun } = await supabase
        .from("integration_sync_runs")
        .select("rate_limit_remaining, rate_limit_reset")
        .in("integration_id", ids)
        .not("rate_limit_remaining", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRun && latestRun.rate_limit_remaining !== null && latestRun.rate_limit_remaining <= 0) {
        const resetAt = latestRun.rate_limit_reset;
        const resetInFuture = resetAt && new Date(resetAt) > new Date();
        if (resetInFuture || !resetAt) {
          alerts.push({
            integration: provider.charAt(0).toUpperCase() + provider.slice(1),
            level: "critical",
            message: `API-kvote opbrugt (remaining=0${resetAt ? `, reset: ${resetAt}` : ""})`,
          });
        }
      }
    }

    // 4. Check DLQ for unresolved records
    const { count: dlqCount } = await supabase
      .from("sync_failed_records")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null);

    if (dlqCount && dlqCount > 0) {
      alerts.push({
        integration: "System",
        level: dlqCount > 50 ? "critical" : "warning",
        message: `${dlqCount} uløste poster i Dead Letter Queue`,
      });
    }

    // Log health alerts to integration_logs
    if (alerts.length > 0) {
      const criticalAlerts = alerts.filter(a => a.level === "critical");
      
      await supabase.from("integration_logs").insert({
        integration_type: "system",
        integration_id: null,
        integration_name: "sync-health-check",
        status: criticalAlerts.length > 0 ? "health_alert" : "warning",
        message: `Health check: ${criticalAlerts.length} critical, ${alerts.length - criticalAlerts.length} warnings`,
        duration_ms: 0,
        details: { alerts, timestamp: new Date().toISOString(), isWorkingHours },
      });
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      alertCount: alerts.length,
      criticalCount: alerts.filter(a => a.level === "critical").length,
      alerts,
      isWorkingHours,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
