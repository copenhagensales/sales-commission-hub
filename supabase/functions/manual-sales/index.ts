import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sharedCorsHeaders } from "../_shared/auth.ts";

const corsHeaders = sharedCorsHeaders;

type Channel = {
  key: string;
  label: string;
  team_id: string;
  client_name: string;
  campaign_name: string;
  allowed_products: string[];
};

// Eksplicit allowlist for bulk-import. Samme liste som src/config/bulkSalesAccess.ts
const BULK_SALES_EMAILS = ["fk@copenhagensales.dk", "filipkirketerp@gmail.com"];
function isBulkSalesEmail(email?: string | null): boolean {
  if (!email) return false;
  return BULK_SALES_EMAILS.includes(email.trim().toLowerCase());
}

const CHANNELS: Channel[] = [
  {
    key: "lederne",
    label: "Lederne",
    team_id: "ed095592-cc72-4dc5-b4d7-cc4a65250cac",
    client_name: "Tryg",
    campaign_name: "Tryg Products",
    allowed_products: ["Lederne"],
  },
  {
    key: "hiper",
    label: "Hiper Bredbånd",
    team_id: "0cb1b854-e7b5-4f49-8fdf-30e54e7d2f95",
    client_name: "Hiper",
    campaign_name: "Hiper Bredbånd",
    allowed_products: [],
  },
];

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

type CallerContext = {
  svc: ReturnType<typeof svcClient>;
  employee: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    work_email: string | null;
    is_active: boolean;
    auth_user_id: string | null;
  };
  allowedChannels: Channel[];
  isManager: boolean;
  canBulkImport: boolean;

};

async function getCallerContext(req: Request): Promise<CallerContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const svc = svcClient();
  const { data: userRes, error: userErr } = await svc.auth.getUser(token);
  if (userErr || !userRes?.user) return null;

  const authUserId = userRes.user.id;

  const { data: employee } = await svc
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email, is_active, auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!employee || !employee.is_active) return null;

  const { data: teamMemberships } = await svc
    .from("team_members")
    .select("team_id")
    .eq("employee_id", employee.id);

  const teamIds = new Set((teamMemberships ?? []).map((m) => m.team_id));

  const { data: mgr } = await svc.rpc("is_manager_or_above", { _user_id: authUserId });
  const isManager = !!mgr;

  const { data: owner } = await svc.rpc("is_owner", { _user_id: authUserId });
  const { data: emails } = await svc
    .from("employee_master_data")
    .select("work_email, private_email")
    .eq("id", employee.id)
    .maybeSingle();
  const candidateEmails = [
    userRes.user.email,
    emails?.work_email,
    emails?.private_email,
  ];
  const canBulkImport = !!owner || candidateEmails.some(isBulkSalesEmail);

  const allowedChannels = CHANNELS.filter(
    (c) => isManager || teamIds.has(c.team_id),
  );

  if (allowedChannels.length === 0) return null;

  return { svc, employee, allowedChannels, isManager, canBulkImport };
}

async function resolveChannel(
  svc: ReturnType<typeof svcClient>,
  channel: Channel,
): Promise<{ campaign_id: string } | null> {
  const { data: client } = await svc
    .from("clients")
    .select("id")
    .ilike("name", channel.client_name)
    .maybeSingle();
  if (!client) return null;

  const { data: campaign } = await svc
    .from("client_campaigns")
    .select("id")
    .eq("client_id", client.id)
    .ilike("name", channel.campaign_name)
    .maybeSingle();

  if (!campaign) return null;
  return { campaign_id: campaign.id };
}

function normalizePhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0045")) d = d.slice(4);
  else if (d.length > 8 && d.startsWith("45")) d = d.slice(2);
  return d;
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ctx = await getCallerContext(req);
    if (!ctx) return json(401, { error: "Unauthorized" });
    const { svc, employee, allowedChannels } = ctx;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "POST" ? "create" : "list");
    const channelKey = url.searchParams.get("channel") ?? "lederne";

    // channels action: list allowed channels for caller
    if (action === "channels") {
      return json(200, {
        channels: allowedChannels.map((c) => ({ key: c.key, label: c.label })),
      });
    }

    // list action: return all caller's manual sales across allowed channels
    if (action === "list") {
      const channelCampaigns: Array<{ channel_key: string; campaign_id: string }> = [];
      for (const c of allowedChannels) {
        const resolved = await resolveChannel(svc, c);
        if (resolved) channelCampaigns.push({ channel_key: c.key, campaign_id: resolved.campaign_id });
      }
      if (channelCampaigns.length === 0) return json(200, { sales: [] });

      const campaignIds = channelCampaigns.map((c) => c.campaign_id);
      const { data: sales, error } = await svc
        .from("sales")
        .select("id, sale_datetime, customer_phone, validation_status, raw_payload, client_campaign_id, sale_items(display_name, mapped_commission, mapped_revenue)")
        .eq("source", "manual_entry")
        .in("client_campaign_id", campaignIds)
        .ilike("agent_email", employee.work_email ?? "")
        .order("sale_datetime", { ascending: false })
        .limit(200);
      if (error) return json(500, { error: error.message });

      const campaignToChannel = new Map(channelCampaigns.map((c) => [c.campaign_id, c.channel_key]));
      const enriched = (sales ?? []).map((s: any) => ({
        ...s,
        channel_key: campaignToChannel.get(s.client_campaign_id) ?? null,
      }));
      return json(200, { sales: enriched });
    }

    // For channel-scoped actions: validate channel
    const channel = allowedChannels.find((c) => c.key === channelKey);
    if (!channel) return json(403, { error: "Ingen adgang til denne kanal" });

    const resolved = await resolveChannel(svc, channel);
    if (!resolved) {
      return json(400, {
        error: `Klient '${channel.client_name}' med kampagne '${channel.campaign_name}' er ikke oprettet endnu.`,
      });
    }
    const campaignId = resolved.campaign_id;

    if (action === "products") {
      let query = svc
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk")
        .eq("client_campaign_id", campaignId)
        .eq("is_active", true);
      if (channel.allowed_products.length > 0) {
        query = query.in("name", channel.allowed_products);
      }
      const { data: products, error } = await query.order("name", { ascending: true });
      if (error) return json(500, { error: error.message });
      return json(200, { products: products ?? [] });
    }

    if (action === "bulk_import" && req.method === "POST") {
      if (!ctx.canBulkImport) return json(403, { error: "Kun ledere kan bulk-importere salg" });

      const body = await req.json().catch(() => null) as {
        dry_run?: boolean;
        rows?: Array<{
          mobil?: unknown;
          kampagne?: string | null;
          saelger?: string | null;
          status?: string | null;
          emne_id?: string | null;
          sale_datetime?: string | null;
        }>;
      } | null;

      const dryRun = body?.dry_run === true;


      const rows = body?.rows ?? [];
      if (!Array.isArray(rows) || rows.length === 0) {
        return json(400, { error: "Ingen rækker i filen" });
      }
      if (rows.length > 5000) return json(400, { error: "For mange rækker (max 5000)" });

      // Product for this channel
      let pq = svc
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk")
        .eq("client_campaign_id", campaignId)
        .eq("is_active", true);
      if (channel.allowed_products.length > 0) pq = pq.in("name", channel.allowed_products);
      const { data: prodList } = await pq.order("name", { ascending: true });
      const product = prodList?.[0];
      if (!product) return json(400, { error: "Produktet for denne kanal findes ikke" });

      // Existing sales for dedupe (all time, this channel campaign, manual entries)
      const { data: existing, error: exErr } = await svc
        .from("sales")
        .select("customer_phone, raw_payload")
        .eq("source", "manual_entry")
        .eq("client_campaign_id", campaignId)
        .limit(20000);
      if (exErr) return json(500, { error: exErr.message });

      const existingPhones = new Set<string>();
      const existingSubjects = new Set<string>();
      for (const s of existing ?? []) {
        const p = normalizePhone((s as any).customer_phone);
        if (p) existingPhones.add(p);
        const sid = (s as any).raw_payload?.subject_id;
        if (sid) existingSubjects.add(String(sid));
      }

      // Employee lookup by current and historical full names. Historical names are
      // only accepted when their work email still belongs to an active employee.
      const { data: employees } = await svc
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email, is_active")
        .not("work_email", "is", null);
      // Normaliser navne: fjern alt der ikke er bogstav/ciffer/mellemrum (fx "-" som
      // pladsholder-efternavn), kollaps mellemrum. Unicode-sikkert, så æøå bevares.
      const norm = (v: string) =>
        v
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]+/gu, " ")
          .replace(/\s+/g, " ")
          .trim();
      const byName = new Map<string, { name: string; email: string | null }>();
      const activeEmails = new Map<string, string>();
      for (const e of employees ?? []) {
        const email = e.work_email?.trim();
        if (e.is_active && email) activeEmails.set(email.toLowerCase(), email);
      }
      for (const e of employees ?? []) {
        const email = e.work_email?.trim();
        const activeEmail = email ? activeEmails.get(email.toLowerCase()) : undefined;
        if (!activeEmail) continue;
        const full = norm(`${e.first_name ?? ""} ${e.last_name ?? ""}`);
        if (full) byName.set(full, { name: full, email: activeEmail });
      }

      const errors: Array<{ reason: string; seller: string; subject_id: string }> = [];
      const seenPhones = new Set<string>();
      let created = 0;
      let wouldCreate = 0;


      for (const r of rows) {
        const seller = String(r.saelger ?? "").trim();
        const subjectId = String(r.emne_id ?? "").trim();
        const push = (reason: string) => errors.push({ reason, seller, subject_id: subjectId });

        const status = String(r.status ?? "").trim().toLowerCase();
        if (status && status !== "succes" && status !== "success") {
          push(`Status er "${r.status}" — ikke Succes`);
          continue;
        }

        const phone = normalizePhone(r.mobil);
        if (phone.length < 8) {
          push("Mobil mangler eller er ugyldig");
          continue;
        }
        if (subjectId && existingSubjects.has(subjectId)) {
          push("Emne-ID er allerede importeret");
          continue;
        }
        if (existingPhones.has(phone)) {
          push("Dublet: mobilnummeret er allerede registreret");
          continue;
        }
        if (seenPhones.has(phone)) {
          push("Dublet i filen: mobilnummeret optræder flere gange");
          continue;
        }

        const match = seller ? byName.get(norm(seller)) : undefined;
        if (!match) {
          push("Sælger findes ikke eller er inaktiv");
          continue;
        }
        if (!match.email) {
          push("Sælger mangler arbejdsmail");
          continue;
        }

        if (dryRun) {
          existingPhones.add(phone);
          seenPhones.add(phone);
          if (subjectId) existingSubjects.add(subjectId);
          wouldCreate += 1;
          continue;
        }

        const saleDatetime = r.sale_datetime && !Number.isNaN(Date.parse(r.sale_datetime))
          ? new Date(r.sale_datetime).toISOString()
          : new Date().toISOString();


        const { data: sale, error: sErr } = await svc
          .from("sales")
          .insert({
            source: "manual_entry",
            integration_type: "manual",
            sale_datetime: saleDatetime,
            customer_phone: phone,
            agent_name: seller,
            agent_email: match.email,
            client_campaign_id: campaignId,
            validation_status: "pending",
            raw_payload: {
              manual_entry: true,
              bulk_import: true,
              imported_by_employee_id: employee.id,
              product_name: product.name,
              channel_key: channel.key,
              subject_id: subjectId || null,
              campaign_name: r.kampagne ?? null,
            },
          })
          .select("id")
          .single();

        if (sErr || !sale) {
          push(sErr?.message ?? "Kunne ikke oprette salg");
          continue;
        }

        const { error: siErr } = await svc.from("sale_items").insert({
          sale_id: sale.id,
          product_id: product.id,
          display_name: product.name,
          quantity: 1,
          mapped_commission: product.commission_dkk ?? 0,
          mapped_revenue: product.revenue_dkk ?? 0,
        });
        if (siErr) {
          await svc.from("sales").delete().eq("id", sale.id);
          push(siErr.message);
          continue;
        }

        existingPhones.add(phone);
        seenPhones.add(phone);
        if (subjectId) existingSubjects.add(subjectId);
        created += 1;
      }

      return json(200, {
        ok: true,
        created,
        would_create: wouldCreate,
        skipped: errors.length,
        errors,
      });

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

      const { data: product, error: pErr } = await svc
        .from("products")
        .select("id, name, commission_dkk, revenue_dkk, client_campaign_id, is_active")
        .eq("id", body.product_id)
        .maybeSingle();
      if (pErr || !product) return json(400, { error: "Produkt ikke fundet" });
      if (
        product.client_campaign_id !== campaignId ||
        !product.is_active ||
        (channel.allowed_products.length > 0 && !channel.allowed_products.includes(product.name))
      ) {
        return json(400, { error: "Produktet kan ikke tastes manuelt" });
      }

      const agentName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
      const saleDatetime = body.sale_datetime ?? new Date().toISOString();

      if (!employee.work_email || employee.work_email.trim() === "") {
        return json(400, {
          error: "Din work_email mangler i medarbejder-master. Bed en admin udfylde den før du kan taste salg.",
        });
      }

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
            channel_key: channel.key,
          },
        })
        .select("id")
        .single();
      if (sErr || !sale) return json(500, { error: sErr?.message ?? "Kunne ikke oprette salg" });

      const { error: siErr } = await svc.from("sale_items").insert({
        sale_id: sale.id,
        product_id: product.id,
        display_name: product.name,
        quantity: 1,
        mapped_commission: product.commission_dkk ?? 0,
        mapped_revenue: product.revenue_dkk ?? 0,
      });
      if (siErr) {
        await svc.from("sales").delete().eq("id", sale.id);
        return json(500, { error: siErr.message });
      }

      return json(200, { ok: true, sale_id: sale.id });
    }

    if (action === "delete" && (req.method === "POST" || req.method === "DELETE")) {
      const body = await req.json().catch(() => null) as { sale_id?: string } | null;
      const saleId = body?.sale_id;
      if (!saleId) return json(400, { error: "sale_id er påkrævet" });

      const { data: sale, error: fErr } = await svc
        .from("sales")
        .select("id, source, client_campaign_id, agent_email")
        .eq("id", saleId)
        .maybeSingle();
      if (fErr) return json(500, { error: fErr.message });
      if (!sale) return json(404, { error: "Salg ikke fundet" });

      const allowedCampaignIds = new Set<string>();
      for (const c of allowedChannels) {
        const r = await resolveChannel(svc, c);
        if (r) allowedCampaignIds.add(r.campaign_id);
      }

      if (
        sale.source !== "manual_entry" ||
        !allowedCampaignIds.has(sale.client_campaign_id) ||
        (sale.agent_email ?? "").toLowerCase() !== (employee.work_email ?? "").toLowerCase()
      ) {
        return json(403, { error: "Du kan kun fjerne dine egne manuelle salg" });
      }

      await svc.from("sale_items").delete().eq("sale_id", saleId);
      const { error: dErr } = await svc.from("sales").delete().eq("id", saleId);
      if (dErr) return json(500, { error: dErr.message });
      return json(200, { ok: true });
    }

    return json(400, { error: "Ukendt action" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[manual-sales] error", msg);
    return json(500, { error: msg });
  }
});
