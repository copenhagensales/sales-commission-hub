import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const monthLabel = (isoDate: string) =>
  new Intl.DateTimeFormat('da-DK', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ---------------------------------------------------------------------------
// ÉN kodevej til indhold og bilag. Både automatisk udsendelse (dispatch) og
// manuel afsendelse fra rapportsiden kalder denne funktion, så de to veje
// aldrig kan glide fra hinanden. Der beregnes intet nyt her: tallene kommer
// udelukkende fra supplier_invoice_reports.report_data, som er beregnet i
// frontenden (inkl. merpris fra location_rate_surcharges).
// ---------------------------------------------------------------------------
async function buildSupplierMail(
  svc: SupabaseClient,
  opts: {
    locationType: string;
    supplierName: string;
    periodStart: string; // yyyy-mm-dd
    rows: any[];
    attachXlsx: boolean;
    includeSurcharge: boolean;
    showDiscount: boolean;
    message?: string | null;
  },
): Promise<{
  html: string;
  attachments: MailAttachment[];
  attachmentName: string | null;
  periodLabel: string;
  totals: { locations: number; days: number; amount: number };
  surcharge: SurchargeSummary | null;
}> {
  const { locationType, supplierName, periodStart, rows } = opts;
  const periodLabel = monthLabel(periodStart);
  const yearMonth = String(periodStart).slice(0, 7);

  const xlsxRows = rows.map((r: any) => ({
    locationName: r.locationName ?? '',
    externalId: r.externalId ?? '',
    city: r.city ?? '',
    days: Number(r.days) || 0,
    amount: Number(r.amount) || 0,
  }));

  const mailLocations = toMailLocations(rows, opts.showDiscount);
  const totals = {
    locations: mailLocations.length,
    days: mailLocations.reduce((s, l) => s + l.days, 0),
    amount: mailLocations.reduce((s, l) => s + l.amount, 0),
  };

  // Merpris/refusion er intern og må kun med i mailteksten, aldrig i bilaget.
  let surcharge: SurchargeSummary | null = null;
  if (opts.includeSurcharge) {
    const totalSurcharge = rows.reduce(
      (s: number, r: any) => s + (Number(r.surchargeAmount) || 0),
      0,
    );
    const refundable = rows.reduce(
      (s: number, r: any) => s + (Number(r.surchargeRefundableAmount) || 0),
      0,
    );
    if (totalSurcharge > 0) {
      const byChain = new Map<string, { days: number; perDay: number; amount: number }>();
      for (const r of rows as any[]) {
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
          (rows as any[]).find((r) => r.surchargeRefundable)?.client ?? 'kunden',
        chains: [...byChain.entries()].map(([chain, v]) => ({ chain, ...v })),
      };
    }
  }

  let attachmentName: string | null = null;
  const attachments: MailAttachment[] = [];
  if (opts.attachXlsx) {
    attachmentName = xlsxFileName(locationType, yearMonth);
    const bytes = await buildSupplierReportXlsx({
      locationType,
      supplierName,
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

  // Sammenligning mod forrige godkendte periode - læses, beregnes ikke.
  const { data: prev } = await svc
    .from('supplier_invoice_reports')
    .select('period_start, total_amount')
    .eq('location_type', locationType)
    .eq('status', 'approved')
    .lt('period_start', periodStart)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousPeriod = prev
    ? { label: monthLabel(String(prev.period_start)), amount: Number(prev.total_amount) || 0 }
    : null;

  const mail = buildSupplierReportEmail({
    supplierName,
    locationType,
    periodLabel,
    totals,
    attachmentName,
    surcharge,
    locations: mailLocations,
    previousPeriod,
    message: opts.message ?? null,
  });

  return { html: mail.html, attachments, attachmentName, periodLabel, totals, surcharge };
}

const serviceClient = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

/** Sender en godkendt dispatch til leverandøren. */
async function sendDispatch(dispatchId: string): Promise<Response> {
  const svc = serviceClient();

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

  const supplierDisplayName = sub.name || sub.location_type;
  const built = await buildSupplierMail(svc, {
    locationType: sub.location_type,
    supplierName: supplierDisplayName,
    periodStart: String(dispatch.period_start),
    rows,
    attachXlsx: !!sub.attach_xlsx,
    includeSurcharge: !!sub.include_surcharge_summary,
    showDiscount: false,
  });

  const cc = ((sub.cc_emails as string[] | null) ?? []).filter((e) => !!e?.trim());

  try {
    await sendM365Mail({
      to: [recipient],
      cc,
      subject: `Leverandørrapport ${supplierDisplayName} - ${built.periodLabel}`,
      html: built.html,
      attachments: built.attachments,
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

  return jsonResponse(200, {
    success: true,
    recipients: sentTo,
    attachmentName: built.attachmentName,
  });
}

/**
 * Manuel afsendelse fra rapportsiden. Bruger samme kodevej som dispatch:
 * samme bilag, samme merpris/refusion og samme sammenligning. Tallene læses
 * fra den godkendte rapport, så brugeren får præcis samme resultat.
 */
async function sendManual(body: Record<string, any>): Promise<Response> {
  const recipients = (body.recipients as string[] | undefined)?.filter((e) => !!e?.trim()) ?? [];
  const subject = (body.subject as string | undefined)?.trim();
  const reportId = body.reportId as string | undefined;

  if (recipients.length === 0 || !subject) {
    return jsonResponse(400, { error: 'Modtagere og emne er påkrævet' });
  }
  if (!reportId) {
    return jsonResponse(400, {
      error: 'Rapporten skal være godkendt og gemt, før den kan sendes',
    });
  }

  const svc = serviceClient();
  const { data: report } = await svc
    .from('supplier_invoice_reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();

  const rows = (report?.report_data as any[] | null) ?? [];
  if (!report || rows.length === 0) {
    return jsonResponse(409, { error: 'Ingen godkendt rapportdata på rapporten' });
  }

  const locationType = String(report.location_type);
  const built = await buildSupplierMail(svc, {
    locationType,
    supplierName: (body.supplierName as string | undefined) || locationType,
    periodStart: String(report.period_start),
    rows,
    attachXlsx: true,
    includeSurcharge: true,
    showDiscount: body.hasDiscountRules !== false,
    message: (body.message as string | undefined) ?? null,
  });

  try {
    await sendM365Mail({
      to: recipients,
      subject,
      html: built.html,
      attachments: built.attachments,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(500, { error: msg });
  }

  await svc
    .from('supplier_invoice_reports')
    .update({ sent_at: new Date().toISOString(), sent_to: recipients })
    .eq('id', report.id);

  return jsonResponse(200, {
    success: true,
    recipientCount: recipients.length,
    attachmentName: built.attachmentName,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    if (body?.dispatch_id) {
      return await sendDispatch(String(body.dispatch_id));
    }
    return await sendManual(body ?? {});
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
