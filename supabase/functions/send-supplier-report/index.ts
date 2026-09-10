import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendM365Mail, toBase64, type MailAttachment } from "../_shared/m365-mail.ts";
import {
  buildSupplierReportEmail,
  type SupplierMailLocation,
  type SurchargeSummary,
} from "../_shared/supplier-report-mail.ts";
import {
  buildSupplierReportXlsx,
  xlsxFileName,
} from "../_shared/supplier-report-xlsx.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEEKDAY_SHORT = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

/** Uger og ugedage som ren tekst - mailen skal virke uden billeder og badges. */
function weekdayText(weekdays: Array<{ week: number; days: number[] }> | undefined): string {
  if (!weekdays || weekdays.length === 0) return '';
  return weekdays
    .slice()
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      const sorted = [...w.days].sort((a, b) => a - b);
      const isFullWeek =
        [0, 1, 2, 3, 4].every((d) => sorted.includes(d)) &&
        sorted.filter((d) => d <= 4).length === 5;
      const label = isFullWeek
        ? 'man-fre'
        : sorted.map((d) => WEEKDAY_SHORT[d] ?? String(d)).join(', ');
      return `uge ${w.week}: ${label}`;
    })
    .join(' \u00b7 ');
}

/** Bygger lokationslinjerne til den fælles skabelon. */
function toMailLocations(rows: any[], showDiscount: boolean): SupplierMailLocation[] {
  return rows.map((loc: any) => {
    const parts = [loc.city || null, loc.externalId || null, weekdayText(loc.weekdays) || null];
    if (showDiscount) {
      parts.push(loc.isExcluded ? 'separat afregning' : `rabat ${Number(loc.discount) || 0}%`);
    }
    return {
      name: loc.locationName || 'Ukendt lokation',
      variant: parts.filter(Boolean).join(' \u00b7 '),
      days: Number(loc.days) || 0,
      amount: showDiscount
        ? Number(loc.finalAmount) || Number(loc.amount) || 0
        : Number(loc.amount) || 0,
    };
  });
}

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Sender en godkendt dispatch til leverandøren.
 * Tallene kommer udelukkende fra supplier_invoice_reports.report_data,
 * som er beregnet i frontenden. Der beregnes intet nyt her.
 */
async function sendDispatch(dispatchId: string): Promise<Response> {
  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: dispatch, error: dispatchError } = await svc
    .from('supplier_report_dispatches')
    .select('*, supplier_report_subscriptions(*)')
    .eq('id', dispatchId)
    .maybeSingle();

  if (dispatchError || !dispatch) {
    return jsonResponse(404, { error: 'Udsendelsen findes ikke' });
  }
  if (dispatch.status === 'sent') {
    return jsonResponse(409, { error: 'Rapporten er allerede sendt' });
  }
  if (dispatch.status !== 'approved') {
    return jsonResponse(409, { error: 'Rapporten er ikke godkendt endnu' });
  }

  const sub = (dispatch as Record<string, any>).supplier_report_subscriptions;
  if (!sub?.is_active) {
    return jsonResponse(409, { error: 'Abonnementet er ikke aktivt' });
  }
  const recipient = (sub.recipient_email || '').trim();
  if (!recipient) {
    return jsonResponse(409, { error: 'Abonnementet har ingen modtager' });
  }

  const { data: report } = await svc
    .from('supplier_invoice_reports')
    .select('*')
    .eq('id', dispatch.report_id ?? '')
    .maybeSingle();

  const rows = (report?.report_data as any[] | null) ?? [];
  if (!report || rows.length === 0) {
    const msg = 'Ingen godkendt rapportdata knyttet til udsendelsen';
    await svc
      .from('supplier_report_dispatches')
      .update({ status: 'failed', error_message: msg })
      .eq('id', dispatchId);
    return jsonResponse(409, { error: msg });
  }

  const periodLabel = new Intl.DateTimeFormat('da-DK', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dispatch.period_start}T00:00:00Z`));
  const yearMonth = String(dispatch.period_start).slice(0, 7);

  const xlsxRows = rows.map((r) => ({
    locationName: r.locationName ?? '',
    externalId: r.externalId ?? '',
    city: r.city ?? '',
    days: Number(r.days) || 0,
    amount: Number(r.amount) || 0,
  }));

  const totals = {
    locations: xlsxRows.length,
    days: xlsxRows.reduce((s, r) => s + r.days, 0),
    amount: xlsxRows.reduce((s, r) => s + r.amount, 0),
  };

  // Merpris/refusion er intern og må kun med i mailteksten, aldrig i bilaget.
  let surcharge: SurchargeSummary | null = null;
  if (sub.include_surcharge_summary) {
    const totalSurcharge = rows.reduce((s, r) => s + (Number(r.surchargeAmount) || 0), 0);
    const refundable = rows.reduce(
      (s, r) => s + (Number(r.surchargeRefundableAmount) || 0),
      0,
    );
    if (totalSurcharge > 0) {
      const byChain = new Map<string, { days: number; perDay: number; amount: number }>();
      for (const r of rows) {
        if (!r.surchargeChain || !Number(r.surchargeRefundableAmount)) continue;
        const cur = byChain.get(r.surchargeChain) ?? {
          days: 0,
          perDay: Number(r.surchargePerDay) || 0,
          amount: 0,
        };
        cur.days += Number(r.surchargeDays) || 0;
        cur.amount += Number(r.surchargeRefundableAmount) || 0;
        byChain.set(r.surchargeChain, cur);
      }
      surcharge = {
        totalSurcharge,
        refundableAmount: refundable,
        refundClientName:
          rows.find((r) => r.surchargeRefundable)?.client ?? 'kunden',
        chains: [...byChain.entries()].map(([chain, v]) => ({ chain, ...v })),
      };
    }
  }

  const supplierDisplayName = sub.name || sub.location_type;
  let attachmentName: string | null = null;
  const attachments: MailAttachment[] = [];
  if (sub.attach_xlsx) {
    attachmentName = xlsxFileName(sub.location_type, yearMonth);
    const bytes = await buildSupplierReportXlsx({
      locationType: sub.location_type,
      supplierName: supplierDisplayName,
      periodLabel,
      rows: xlsxRows,
    });
    attachments.push({
      name: attachmentName,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentBytes: toBase64(bytes),
    });
  }

  // Sammenligning mod forrige periode: læses fra tidligere godkendt rapport,
  // der beregnes intet nyt her.
  const { data: prev } = await svc
    .from('supplier_invoice_reports')
    .select('period_start, total_amount')
    .eq('location_type', sub.location_type)
    .eq('status', 'approved')
    .lt('period_start', dispatch.period_start)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousPeriod = prev
    ? {
        label: new Intl.DateTimeFormat('da-DK', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${prev.period_start}T00:00:00Z`)),
        amount: Number(prev.total_amount) || 0,
      }
    : null;

  const mail = buildSupplierReportEmail({
    supplierName: supplierDisplayName,
    locationType: sub.location_type,
    periodLabel,
    totals,
    attachmentName,
    surcharge,
    locations: toMailLocations(rows, false),
    previousPeriod,
  });

  const cc = ((sub.cc_emails as string[] | null) ?? []).filter((e) => !!e?.trim());

  try {
    await sendM365Mail({
      to: [recipient],
      cc,
      subject: `Leverandørrapport ${supplierDisplayName} - ${periodLabel}`,
      html: mail.html,
      attachments,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await svc
      .from('supplier_report_dispatches')
      .update({ status: 'failed', error_message: msg })
      .eq('id', dispatchId);
    return jsonResponse(500, { error: msg });
  }

  const sentTo = [recipient, ...cc];
  await svc
    .from('supplier_report_dispatches')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_to: sentTo,
      error_message: null,
    })
    .eq('id', dispatchId);

  await svc
    .from('supplier_invoice_reports')
    .update({ sent_at: new Date().toISOString(), sent_to: sentTo })
    .eq('id', report.id);

  return jsonResponse(200, { success: true, recipients: sentTo, attachmentName });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // ---- Automatisk udsendelse: dispatch_id styrer modtagere, tekst og bilag ----
    if (body?.dispatch_id) {
      return await sendDispatch(String(body.dispatch_id));
    }

    const { locationType, month, recipients, subject, message, reportId, reportData, hasDiscountRules, supplierName } = body;

    if (!recipients?.length || !subject) {
      return new Response(
        JSON.stringify({ error: 'Recipients and subject are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = Deno.env.get('M365_TENANT_ID');
    const clientId = Deno.env.get('M365_CLIENT_ID');
    const clientSecret = Deno.env.get('M365_CLIENT_SECRET');
    const senderEmail = Deno.env.get('M365_SENDER_EMAIL');

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      console.error('Missing M365 credentials');
      return new Response(
        JSON.stringify({ error: 'Email configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with email service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const showDiscount = hasDiscountRules !== false;
    const locations = (reportData || []) as any[];
    const mailLocations = toMailLocations(locations, showDiscount);

    const emailBodyHtml = buildSupplierReportEmail({
      supplierName: supplierName || locationType,
      locationType,
      periodLabel: month,
      totals: {
        locations: mailLocations.length,
        days: mailLocations.reduce((s, l) => s + l.days, 0),
        amount: mailLocations.reduce((s, l) => s + l.amount, 0),
      },
      attachmentName: null,
      surcharge: null,
      locations: mailLocations,
      previousPeriod: null,
      message: message || null,
    }).html;

    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
    const toRecipients = recipients.map((email: string) => ({
      emailAddress: { address: email },
    }));

    const mailResponse = await fetch(sendMailUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: emailBodyHtml },
          toRecipients,
        },
      }),
    });

    if (!mailResponse.ok) {
      const mailError = await mailResponse.text();
      console.error('Send mail error:', mailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update report with sent info
    if (reportId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, supabaseKey);

      await sb
        .from('supplier_invoice_reports')
        .update({
          sent_at: new Date().toISOString(),
          sent_to: recipients,
        })
        .eq('id', reportId);
    }

    console.log(`Supplier report sent to ${recipients.length} recipients for ${locationType} - ${month}`);

    return new Response(
      JSON.stringify({ success: true, recipientCount: recipients.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-supplier-report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
