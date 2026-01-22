import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EconomicBookedInvoice = Record<string, any>;

function toDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

function extractEconomicInvoiceId(invoice: EconomicBookedInvoice): string {
  // Prefer explicit IDs if present; otherwise fall back to parsing from self.href
  const direct =
    invoice.id ??
    invoice.bookedInvoiceNumber ??
    invoice.invoiceNumber ??
    invoice.booked_invoice_number ??
    invoice.invoice_number;
  if (direct !== undefined && direct !== null) return String(direct);

  const href = invoice.self?.href ?? invoice.self ?? invoice?.links?.self;
  if (typeof href === "string" && href.length > 0) {
    const parts = href.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? href;
  }

  // Last resort: stable hash-ish fallback
  return crypto.randomUUID();
}

function mapInvoiceToRow(invoice: EconomicBookedInvoice) {
  const economicInvoiceId = extractEconomicInvoiceId(invoice);

  const invoiceNumber =
    safeText(invoice.bookedInvoiceNumber ?? invoice.invoiceNumber ?? invoice.booked_invoice_number ?? invoice.invoice_number);

  const date = safeText(invoice.date) ?? toDateOnly(new Date());
  const dueDate = safeText(invoice.dueDate ?? invoice.due_date);
  const currency = safeText(invoice.currency);

  const net = parseNumeric(invoice.netAmount ?? invoice.net_amount);
  const gross = parseNumeric(invoice.grossAmount ?? invoice.gross_amount);
  const vat = parseNumeric(invoice.vatAmount ?? invoice.vat_amount);

  const debtor = invoice.debtor ?? invoice.customer ?? {};
  const customerNumber = safeText(debtor.debtorNumber ?? debtor.customerNumber ?? debtor.number);
  const customerName = safeText(debtor.name ?? debtor.customerName);

  return {
    economic_invoice_id: economicInvoiceId,
    invoice_number: invoiceNumber,
    date,
    due_date: dueDate,
    currency,
    net_amount: net,
    gross_amount: gross,
    vat_amount: vat,
    customer_number: customerNumber,
    customer_name: customerName,
    status: "booked",
    raw: invoice,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appSecretToken = Deno.env.get("ECONOMIC_APP_SECRET_TOKEN")!;
    const agreementGrantToken = Deno.env.get("ECONOMIC_AGREEMENT_GRANT_TOKEN")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let days = 30;
    try {
      const body = await req.json();
      if (typeof body?.days === "number") days = body.days;
      if (typeof body?.days === "string") days = Number(body.days) || days;
    } catch {
      // ignore
    }
    days = Math.min(365, Math.max(1, days));

    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromDate = toDateOnly(from);

    const economicHeaders = {
      "X-AppSecretToken": appSecretToken,
      "X-AgreementGrantToken": agreementGrantToken,
      "Content-Type": "application/json",
    };

    let url = `https://restapi.e-conomic.com/invoices/booked?filter=date$gte:${fromDate}&pagesize=1000`;
    let totalFetched = 0;
    let upserted = 0;
    let errors = 0;

    console.log("Starting e-conomic invoice sync. fromDate=", fromDate, "days=", days);

    while (url) {
      console.log("Fetching:", url);
      const res = await fetch(url, { headers: economicHeaders });
      if (!res.ok) {
        const txt = await res.text();
        console.error("e-conomic API error:", res.status, txt);
        throw new Error(`e-conomic API error: ${res.status}`);
      }

      const json = await res.json();
      const invoices: EconomicBookedInvoice[] = json.collection ?? [];
      totalFetched += invoices.length;

      for (const inv of invoices) {
        const row = mapInvoiceToRow(inv);

        const { error } = await supabase
          .from("economic_invoices")
          .upsert(row, { onConflict: "economic_invoice_id" });

        if (error) {
          errors++;
          console.error("Upsert error:", error);
        } else {
          upserted++;
        }
      }

      url = json?.pagination?.nextPage ?? "";
    }

    console.log("Invoice sync done", { totalFetched, upserted, errors });

    return new Response(
      JSON.stringify({ success: true, fromDate, days, totalFetched, upserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in sync-economic-invoices:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
