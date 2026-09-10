// Daglig salgsrapport til kunder (report_type = 'client_daily_sales').
// Samme abonnement-/dispatch-tabel, samme mailskabelon og samme afsendelsesvej
// som de to andre rapporttyper. Ingen godkendelse, ingen beløb, ingen navne.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendM365Mail } from "../_shared/m365-mail.ts";
import {
  buildClientDailySalesEmail,
  type DailySalesProductRow,
  type DailySalesTrendPoint,
} from "../_shared/supplier-report-mail.ts";

type Svc = SupabaseClient;

/** Antal dage MED aktivitet der vises i trendgrafen. */
const TREND_ACTIVE_DAYS = 7;
/** Hvor langt tilbage vi leder efter dage med aktivitet. */
const TREND_LOOKBACK_DAYS = 120;

interface DailySalesSubscriptionRow {
  id: string;
  name: string | null;
  client_id: string;
  send_hour: number;
  is_active: boolean;
  recipient_email: string | null;
  cc_emails: string[] | null;
  clients: { id: string; name: string | null } | null;
}

interface ProductCountRow {
  sale_date: string;
  product_name: string;
  quantity: number;
  sale_count: number;
}

interface DayTotalRow {
  sale_date: string;
  quantity: number;
  sale_count: number;
}

export interface DailySalesResult {
  subscription: string;
  clientName: string;
  date: string;
  totalQuantity: number;
  saleCount: number;
  products: DailySalesProductRow[];
  trend: DailySalesTrendPoint[];
  comparison: { date: string; quantity: number } | null;
  action: "sent" | "skipped_empty" | "already_handled" | "not_due" | "dry_run" | "test_mail";
  detail?: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface DailySalesData {
  totalQuantity: number;
  saleCount: number;
  products: DailySalesProductRow[];
  trend: DailySalesTrendPoint[];
  comparison: { date: string; quantity: number } | null;
}

/**
 * Beregner gårsdagens salg for én kunde.
 * Trenden er de seneste TREND_ACTIVE_DAYS dage MED aktivitet (vist kronologisk),
 * så lørdage tælles med og tomme søndage ikke bliver kunstige nulpunkter.
 */
export async function computeDailySales(
  svc: Svc,
  clientId: string,
  date: string,
): Promise<DailySalesData> {
  const { data: productData, error: pError } = await svc.rpc(
    "get_client_daily_sales_counts",
    { p_client_id: clientId, p_start: date, p_end: date },
  );
  if (pError) throw new Error(pError.message);

  const productRows = (productData ?? []) as unknown as ProductCountRow[];
  const products: DailySalesProductRow[] = productRows.map((r) => ({
    productName: r.product_name,
    quantity: Number(r.quantity),
  }));

  const { data: totalsData, error: tError } = await svc.rpc(
    "get_client_daily_sales_totals",
    {
      p_client_id: clientId,
      p_start: addDays(date, -TREND_LOOKBACK_DAYS),
      p_end: date,
    },
  );
  if (tError) throw new Error(tError.message);

  const totals = ((totalsData ?? []) as unknown as DayTotalRow[])
    .map((r) => ({
      date: r.sale_date,
      quantity: Number(r.quantity),
      saleCount: Number(r.sale_count),
    }))
    .filter((r) => r.quantity > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const today = totals.find((t) => t.date === date);
  const totalQuantity = today?.quantity ?? 0;
  const saleCount = today?.saleCount ?? 0;

  // Seneste dage med aktivitet, fundet bagfra men vist kronologisk.
  const trend: DailySalesTrendPoint[] = totals
    .slice(-TREND_ACTIVE_DAYS)
    .map((t) => ({ date: t.date, quantity: t.quantity }));

  const comparisonDate = addDays(date, -7);
  const comparisonRow = totals.find((t) => t.date === comparisonDate);
  const comparison = comparisonRow
    ? { date: comparisonRow.date, quantity: comparisonRow.quantity }
    : null;

  return { totalQuantity, saleCount, products, trend, comparison };
}

/**
 * Kører de daglige salgsrapporter. Kun abonnementer med report_type
 * 'client_daily_sales'. dryRun beregner uden at oprette dispatches eller sende
 * mail. testEmail sender til én intern adresse uden at gemme noget.
 */
export async function runDailySales(
  svc: Svc,
  opts: {
    local: { year: number; month: number; day: number; hour: number };
    force: boolean;
    dryRun: boolean;
    dateOverride?: string;
    subscriptionId?: string;
    testEmail?: string;
  },
): Promise<DailySalesResult[]> {
  const results: DailySalesResult[] = [];

  let query = svc
    .from("supplier_report_subscriptions")
    .select("*, clients:client_id(id, name)")
    .eq("report_type", "client_daily_sales");
  if (opts.subscriptionId) query = query.eq("id", opts.subscriptionId);
  const { data: subs, error } = await query;
  if (error) throw new Error(error.message);

  const todayLocal = `${opts.local.year}-${String(opts.local.month).padStart(2, "0")}-${
    String(opts.local.day).padStart(2, "0")
  }`;

  for (const sub of (subs ?? []) as unknown as DailySalesSubscriptionRow[]) {
    const clientName = sub.clients?.name ?? "Ukendt kunde";
    // Periode = i går i Europe/Copenhagen.
    const date = opts.dateOverride ?? addDays(todayLocal, -1);
    const base = { subscription: sub.name ?? sub.id, clientName, date };

    const isDue =
      opts.force || opts.dryRun || !!opts.testEmail || opts.local.hour === sub.send_hour;
    const liveRun = !opts.dryRun && !opts.testEmail;

    if (liveRun && (!isDue || !sub.is_active || !String(sub.recipient_email ?? "").trim())) {
      results.push({
        ...base,
        totalQuantity: 0,
        saleCount: 0,
        products: [],
        trend: [],
        comparison: null,
        action: "not_due",
        detail: !isDue ? "ikke sendetidspunkt" : !sub.is_active ? "inaktiv" : "ingen modtager",
      });
      continue;
    }

    const data = await computeDailySales(svc, sub.client_id, date);

    if (opts.dryRun) {
      results.push({ ...base, ...data, action: "dry_run" });
      continue;
    }

    const mail = buildClientDailySalesEmail({ clientName, date, ...data });

    if (opts.testEmail) {
      if (data.totalQuantity === 0) {
        results.push({
          ...base,
          ...data,
          action: "skipped_empty",
          detail: "testmail ikke sendt: ingen salg på dagen",
        });
        continue;
      }
      await sendM365Mail({
        to: [opts.testEmail],
        subject: `[TEST] ${mail.subject}`,
        html: mail.html,
      });
      results.push({ ...base, ...data, action: "test_mail" });
      continue;
    }

    // UNIQUE (subscription_id, period_start) sikrer at en dag kun sendes én gang.
    const { data: inserted, error: insertError } = await svc
      .from("supplier_report_dispatches")
      .insert({
        subscription_id: sub.id,
        period_start: date,
        period_end: date,
        status: data.totalQuantity === 0 ? "skipped" : "approved",
        error_message:
          data.totalQuantity === 0
            ? `Ingen salg for ${clientName} den ${date} - intet er sendt til kunden.`
            : null,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      results.push({
        ...base,
        ...data,
        action: "already_handled",
        detail: insertError?.message ?? "udsendelsen findes allerede",
      });
      continue;
    }

    // Nul salg: ingen kundemail og ingen intern advarsel (det er normalt).
    if (data.totalQuantity === 0) {
      results.push({ ...base, ...data, action: "skipped_empty" });
      continue;
    }

    const cc = (sub.cc_emails ?? []).filter((e) => !!e?.trim());
    const recipient = String(sub.recipient_email).trim();
    try {
      await sendM365Mail({ to: [recipient], cc, subject: mail.subject, html: mail.html });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await svc
        .from("supplier_report_dispatches")
        .update({ status: "failed", error_message: msg })
        .eq("id", inserted.id);
      results.push({ ...base, ...data, action: "already_handled", detail: msg });
      continue;
    }

    await svc
      .from("supplier_report_dispatches")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_to: [recipient, ...cc],
        error_message: null,
      })
      .eq("id", inserted.id);
    await svc
      .from("supplier_report_subscriptions")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", sub.id);

    results.push({ ...base, ...data, action: "sent" });
  }

  return results;
}
