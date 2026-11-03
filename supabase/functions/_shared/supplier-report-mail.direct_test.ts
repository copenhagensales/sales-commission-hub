import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSupplierReportEmail } from "./supplier-report-mail.ts";

Deno.test("mail til Eesy viser direkte afregnede og samlet refusion", () => {
  const { text } = buildSupplierReportEmail({
    supplierName: "Coop", locationType: "Coop butik", periodLabel: "oktober 2026",
    totals: { locations: 1, days: 5, amount: 8750 },
    surcharge: {
      totalSurcharge: 3750, refundableAmount: 3750 + 3750, coopRefundableAmount: 3750,
      refundClientName: "Eesy FM",
      chains: [{ chain: "Kvickly", days: 5, perDay: 750, amount: 3750 }],
      directRefunds: [{ locationName: "Kvickly Testby", chain: "Kvickly", minDate: "2026-10-05",
        maxDate: "2026-10-09", days: 5, perDay: 750, amount: 3750 }],
    },
    locations: [{ name: "Kvickly Coop", days: 5, amount: 8750 }],
  });
  assert(text.includes("Direkte afregnet \u2013 refunderes af Eesy FM"));
  assert(text.includes("Kvickly Testby (05/10-09/10)"));
  assert(/Til refusion fra Eesy FM: 7\.500/.test(text));
  // Lokationslisten (fakturagrundlaget) indeholder ikke den direkte lokation
  const lokationer = text.split("Lokationer:")[1].split("Merpris og refusion")[0];
  assertEquals(lokationer.includes("Kvickly Testby"), false);
});
