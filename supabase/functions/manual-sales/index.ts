import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sharedCorsHeaders } from "../_shared/auth.ts";

const corsHeaders = sharedCorsHeaders;

const TEAM_UNITED_ID = "ed095592-cc72-4dc5-b4d7-cc4a65250cac";
const CLIENT_NAME = "Tryg";
const CAMPAIGN_NAME = "Tryg Products";
// Only these product names are selectable in Tast selv salg
const ALLOWED_PRODUCT_NAMES = ["Lederne"];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function svcClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getCallerContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const svc = svcClient();
  const { data: userRes, error: userErr } = await svc.auth.getUser(token);
  if (userErr || !userRes?.user) return null;

  const authUserId = userRes.user.id;

  // Look up employee
  const { data: employee } = await svc
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email, is_active, auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!employee || !employee.is_active) return null;

  // Check team membership OR owner/manager
  const { data: teamMemberships } = await svc
    .from("team_members")
    .select("team_id")
    .eq("employee_id", employee.id);

  const onUnited = (teamMemberships || []).some((m) => m.team_id === TEAM_UNITED_ID);

  let isManager = false;
  if (!onUnited) {
    const { data: mgr } = await svc.rpc("is_manager_or_above", { _user_id: authUserId });
    isManager = !!mgr;
  }

  if (!onUnited && !isManager) return null;

  return { svc, employee };
}

async function resolveCampaignId(svc: ReturnType<typeof svcClient>) {
  const { data: client } = await svc
    .from("clients")
    .select("id")
    .ilike("name", CLIENT_NAME)
    .maybeSingle();
  if (!client) return null;

  const { data: campaign } = await svc
    .from("client_campaigns")
    .select("id")
    .eq("client_id", client.id)
    .ilike("name", CAMPAIGN_NAME)
    .maybeSingle();

  return campaign?.id ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ctx = await getCallerContext(req);
    if (!ctx) return json(401, { error: "Unauthorized" });
    const { svc, employee } = ctx;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "POST" ? "create" : "list");

    const campaignId = await resolveCampaignId(svc);
    if (!campaignId) {
      return json(400, {
        error: `Klient '${CLIENT_NAME}' med kampagne '${CAMPAIGN_NAME}' er ikke oprettet endnu. Opret den i MgTest først.`,
      });
    }

    if (action === "products") {
      const { data: products, error } = await svc
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk")
        .eq("client_campaign_id", campaignId)
        .eq("is_active", true)
        .in("name", ALLOWED_PRODUCT_NAMES)
        .order("name", { ascending: true });
      if (error) return json(500, { error: error.message });
      return json(200, { products: products ?? [] });
    }

    if (action === "list") {
      const { data: sales, error } = await svc
        .from("sales")
        .select("id, sale_datetime, customer_phone, validation_status, raw_payload, sale_items(display_name, mapped_commission, mapped_revenue)")
        .eq("source", "manual_entry")
        .eq("client_campaign_id", campaignId)
        .ilike("agent_email", employee.work_email ?? "")
        .order("sale_datetime", { ascending: false })
        .limit(200);
      if (error) return json(500, { error: error.message });
      return json(200, { sales: sales ?? [] });
    }

    if (action === "create" && req.method === "POST") {
      const body = await req.json().catch(() => null) as {
        product_id?: string;
        customer_phone?: string;
        sale_datetime?: string;
      } | null;

      if (!body?.product_id || !body?.customer_phone) {
        return json(400, { error: "product_id og customer_phone er påkrævet" });
      }

      const phone = String(body.customer_phone).trim();
      if (phone.length < 4) return json(400, { error: "Ugyldigt telefonnummer" });

      // Fetch product
      const { data: product, error: pErr } = await svc
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk, client_campaign_id, is_active")
        .eq("id", body.product_id)
        .maybeSingle();
      if (pErr || !product) return json(400, { error: "Produkt ikke fundet" });
      if (
        product.client_campaign_id !== campaignId ||
        !product.is_active ||
        !ALLOWED_PRODUCT_NAMES.includes(product.name)
      ) {
        return json(400, { error: "Produktet kan ikke tastes manuelt" });
      }

      const agentName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
      const saleDatetime = body.sale_datetime ?? new Date().toISOString();

      // Insert sale
      const { data: sale, error: sErr } = await svc
        .from("sales")
        .insert({
          source: "manual_entry",
          integration_type: "manual",
          sale_datetime: saleDatetime,
          customer_phone: phone,
          agent_name: agentName,
          agent_email: employee.work_email,
          client_campaign_id: campaignId,
          validation_status: "pending",
          raw_payload: {
            manual_entry: true,
            entered_by_employee_id: employee.id,
            product_name: product.name,
          },
        })
        .select("id")
        .single();
      if (sErr || !sale) return json(500, { error: sErr?.message ?? "Kunne ikke oprette salg" });

      // Insert sale_item (pricing from product baseline; pricing-rules can rematch later)
      const { error: siErr } = await svc.from("sale_items").insert({
        sale_id: sale.id,
        product_id: product.id,
        display_name: product.name,
        quantity: 1,
        mapped_commission: product.commission_dkk ?? 0,
        mapped_revenue: product.revenue_dkk ?? 0,
      });
      if (siErr) {
        // roll back sale
        await svc.from("sales").delete().eq("id", sale.id);
        return json(500, { error: siErr.message });
      }

      return json(200, { ok: true, sale_id: sale.id });
    }

    return json(400, { error: "Ukendt action" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[manual-sales] error", msg);
    return json(500, { error: msg });
  }
});
