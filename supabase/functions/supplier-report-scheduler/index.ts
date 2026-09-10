// Dagligt job: opretter dispatches til godkendelse og sender påmindelser.
// Styrer KUN tidsplan, godkendelsesbesked og påmindelser.
// Selve rapportberegningen ligger i frontenden (SupplierReportTab) og reimplementeres ikke her.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendM365Mail } from "../_shared/m365-mail.ts";
import { buildApprovalRequestEmail } from "../_shared/supplier-report-mail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const MAX_REMINDERS = 10;
const TZ = "Europe/Copenhagen";

/** Dags dato og time i Europe/Copenhagen, uafhængigt af sommertid. */
function copenhagenNow(): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

function previousMonthPeriod(year: number, month: number) {
  const y = month === 1 ? year - 1 : year;
  const m = month === 1 ? 12 : month - 1;
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
  return { start, end, label, yearMonth: `${y}-${String(m).padStart(2, "0")}` };
}

function baseUrl(): string {
  return Deno.env.get("APP_BASE_URL") || "https://stork.copenhagensales.dk";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mode = (body.mode as string) || "both";
  const force = body.force === true;

  const local = copenhagenNow();
  const created: string[] = [];
  const skipped: Array<{ subscription: string; reason: string }> = [];
  const reminders: string[] = [];
  const errors: string[] = [];

  const { data: subscriptions, error: subError } = await svc
    .from("supplier_report_subscriptions")
    .select("*");
  if (subError) {
    return new Response(JSON.stringify({ error: subError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const approverEmail = async (employeeId: string | null): Promise<string | null> => {
    if (!employeeId) return null;
    const { data } = await svc
      .from("employee_master_data")
      .select("work_email, private_email")
      .eq("id", employeeId)
      .maybeSingle();
    return (data?.work_email || data?.private_email || null) as string | null;
  };

  // ---- 1) Opret dispatches ----
  if (mode === "create" || mode === "both") {
    for (const sub of subscriptions ?? []) {
      if (!sub.is_active) {
        skipped.push({ subscription: sub.name ?? sub.id, reason: "inaktiv" });
        continue;
      }
      if (!sub.recipient_email || String(sub.recipient_email).trim() === "") {
        skipped.push({ subscription: sub.name ?? sub.id, reason: "ingen modtager" });
        continue;
      }
      if (!force && sub.send_day !== local.day) {
        skipped.push({ subscription: sub.name ?? sub.id, reason: "ikke sendedag" });
        continue;
      }

      const period = previousMonthPeriod(local.year, local.month);

      const { data: existing } = await svc
        .from("supplier_report_dispatches")
        .select("id")
        .eq("subscription_id", sub.id)
        .eq("period_start", period.start)
        .maybeSingle();
      if (existing) {
        skipped.push({ subscription: sub.name ?? sub.id, reason: "findes allerede" });
        continue;
      }

      const { data: inserted, error: insertError } = await svc
        .from("supplier_report_dispatches")
        .insert({
          subscription_id: sub.id,
          period_start: period.start,
          period_end: period.end,
          status: "pending_approval",
        })
        .select("id")
        .maybeSingle();

      if (insertError) {
        // UNIQUE-constraint: en parallel kørsel har allerede oprettet rækken
        skipped.push({ subscription: sub.name ?? sub.id, reason: insertError.message });
        continue;
      }

      created.push(inserted?.id as string);
      await svc
        .from("supplier_report_subscriptions")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", sub.id);

      const to = await approverEmail(sub.approver_employee_id);
      if (to) {
        try {
          const mail = buildApprovalRequestEmail({
            supplierName: sub.name || sub.location_type,
            periodLabel: period.label,
            recipientEmail: sub.recipient_email,
            link: `${baseUrl()}/vagt-flow/billing`,
            isReminder: false,
          });
          await sendM365Mail({ to: [to], subject: mail.subject, html: mail.html });
        } catch (e) {
          errors.push(`godkendelsesmail: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  // ---- 2) Påmindelser (kl. 08 lokal tid) ----
  if ((mode === "remind" || mode === "both") && (force || local.hour === 8)) {
    const { data: pending } = await svc
      .from("supplier_report_dispatches")
      .select("*, supplier_report_subscriptions(*)")
      .eq("status", "pending_approval");

    for (const d of pending ?? []) {
      const sub = (d as Record<string, any>).supplier_report_subscriptions;
      if (!sub) continue;
      if (d.reminder_count >= MAX_REMINDERS) {
        if (!d.error_message) {
          await svc
            .from("supplier_report_dispatches")
            .update({
              error_message: `Stoppet efter ${MAX_REMINDERS} påmindelser uden godkendelse`,
            })
            .eq("id", d.id);
        }
        continue;
      }
      const to = await approverEmail(sub.approver_employee_id);
      const periodLabel = new Intl.DateTimeFormat("da-DK", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${d.period_start}T00:00:00Z`));

      if (!to) {
        await svc
          .from("supplier_report_dispatches")
          .update({ error_message: "Ingen godkender valgt på abonnementet" })
          .eq("id", d.id);
        continue;
      }
      try {
        const mail = buildApprovalRequestEmail({
          supplierName: sub.name || sub.location_type,
          periodLabel,
          recipientEmail: sub.recipient_email ?? "",
          link: `${baseUrl()}/vagt-flow/billing`,
          isReminder: true,
          reminderNumber: d.reminder_count + 1,
        });
        await sendM365Mail({ to: [to], subject: mail.subject, html: mail.html });
        await svc
          .from("supplier_report_dispatches")
          .update({
            reminder_count: d.reminder_count + 1,
            last_reminder_at: new Date().toISOString(),
          })
          .eq("id", d.id);
        reminders.push(d.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`påmindelse ${d.id}: ${msg}`);
        await svc
          .from("supplier_report_dispatches")
          .update({ error_message: msg })
          .eq("id", d.id);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      localDate: `${local.year}-${local.month}-${local.day} kl. ${local.hour}`,
      mode,
      created,
      skipped,
      reminders,
      errors,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
