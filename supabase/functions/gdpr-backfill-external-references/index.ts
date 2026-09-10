/**
 * One-off backfill: clears OPP number and Sales ID on sales that were already
 * anonymised by the OLD cleanup logic (which preserved the two references),
 * plus the matching cancellation_queue.opp_group copies.
 *
 * Defaults to dry_run = true. Nothing is written unless the caller passes
 * { "dry_run": false } explicitly. Every run is written to gdpr_cleanup_log.
 *
 * Auth: owner or the GDPR cron token (same guard as the other GDPR functions).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeGdprRequest, corsHeaders } from "../_shared/gdpr-auth.ts";

const PAGE_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await authorizeGdprRequest(req);
    if (authResult instanceof Response) return authResult;

    let dryRun = true;
    try {
      const body = await req.json();
      if (body && body.dry_run === false) dryRun = false;
    } catch {
      // no body -> dry run
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // A sale is "already anonymised" when the cleanup job has dropped the
    // payload and the phone number (customer_company = 'Anonymiseret').
    let salesRefsCleared = 0;
    let salesIdsCleared = 0;
    let from = 0;

    for (;;) {
      const { data, error } = await supabase
        .from("sales")
        .select("id, external_reference_number, external_sales_id")
        .is("raw_payload", null)
        .is("customer_phone", null)
        .or("external_reference_number.not.is.null,external_sales_id.not.is.null")
        .order("id")
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data) {
        const patch: Record<string, unknown> = {};
        if (row.external_reference_number) {
          patch.external_reference_number = null;
          salesRefsCleared++;
        }
        if (row.external_sales_id) {
          patch.external_sales_id = null;
          salesIdsCleared++;
        }
        if (Object.keys(patch).length === 0) continue;
        if (!dryRun) {
          const { error: updErr } = await supabase.from("sales").update(patch).eq("id", row.id);
          if (updErr) throw updErr;
        }
      }

      if (data.length < PAGE_SIZE) break;
      // In a live run the rows drop out of the filter, so keep the offset at 0.
      from = dryRun ? from + PAGE_SIZE : 0;
    }

    // cancellation_queue.opp_group copies belonging to already-anonymised sales.
    let oppGroupsCleared = 0;
    const { data: queueRows, error: queueErr } = await supabase
      .from("cancellation_queue")
      .select("id, sale_id, opp_group")
      .not("opp_group", "is", null);

    if (queueErr) throw queueErr;

    const saleIds = [...new Set((queueRows ?? []).map((r) => r.sale_id).filter(Boolean))] as string[];
    const anonymisedSaleIds = new Set<string>();
    for (let i = 0; i < saleIds.length; i += 200) {
      const chunk = saleIds.slice(i, i + 200);
      const { data: sales, error: sErr } = await supabase
        .from("sales")
        .select("id")
        .in("id", chunk)
        .is("raw_payload", null)
        .is("customer_phone", null);
      if (sErr) throw sErr;
      for (const s of sales ?? []) anonymisedSaleIds.add(s.id as string);
    }

    for (const row of queueRows ?? []) {
      if (!row.sale_id || !anonymisedSaleIds.has(row.sale_id as string)) continue;
      oppGroupsCleared++;
      if (!dryRun) {
        const { error: updErr } = await supabase
          .from("cancellation_queue")
          .update({ opp_group: null })
          .eq("id", row.id);
        if (updErr) throw updErr;
      }
    }

    const details = {
      dry_run: dryRun,
      sales_external_reference_number_cleared: salesRefsCleared,
      sales_external_sales_id_cleared: salesIdsCleared,
      cancellation_queue_opp_group_cleared: oppGroupsCleared,
    };

    await supabase.from("gdpr_cleanup_log").insert({
      action: dryRun
        ? "backfill_external_references_dry_run"
        : "backfill_external_references",
      records_affected: salesRefsCleared + salesIdsCleared + oppGroupsCleared,
      details,
      triggered_by: authResult.caller,
    });

    return new Response(JSON.stringify({ success: true, ...details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
