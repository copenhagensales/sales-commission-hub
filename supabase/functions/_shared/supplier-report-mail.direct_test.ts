import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSupplierReportEmail } from "./supplier-report-mail.ts";

Deno.test("mail til Eesy viser direkte afregnede og samlet refusion", () => {
  const { text } = buildSupplierReportEmail({
    supplierName: "Coop", locationType: "Coop butik", periodLabel: "oktober 2026",
    totals: { locations: 1, days: 5, amount: 8500 },
    surcharge: {
      totalSurcharge: 3500, refundableAmount: 3500 + 3500, coopRefundableAmount: 3500,
      refundClientName: "Eesy FM",
      chains: [{ chain: "Kvickly", days: 5, perDay: 700, amount: 3500 }],
      directRefunds: [{ locationName: "Kvickly Testby", chain: "Kvickly", minDate: "2026-10-05",
        maxDate: "2026-10-09", days: 5, perDay: 700, amount: 3500 }],
    },
    locations: [{ name: "Kvickly Coop", days: 5, amount: 8500 }],
  });
  assert(text.includes("Direkte afregnet \u2013 refunderes af Eesy FM"));
  assert(text.includes("Kvickly Testby (05/10-09/10)"));
  assert(/Til refusion fra Eesy FM: 7\.000/.test(text));
  const lokationer = text.split("Lokationer:")[1].split("Merpris og refusion")[0];
  assertEquals(lokationer.includes("Kvickly Testby"), false);
});
