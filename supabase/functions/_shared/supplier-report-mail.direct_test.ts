import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSupplierReportEmail } from "./supplier-report-mail.ts";

Deno.test("Coop butik-mail udelader direkte refusion også fra gamle snapshots", () => {
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
  assertEquals(text.includes("Direkte afregnet"), false);
  assertEquals(text.includes("Kvickly Testby"), false);
  assert(/Til refusion fra Eesy FM: 3\.500/.test(text));
  const lokationer = text.split("Lokationer:")[1].split("Merpris og refusion")[0];
  assertEquals(lokationer.includes("Kvickly Testby"), false);
});

Deno.test("Coop direkte-mail viser egen refusion og netto", () => {
  const { html, text } = buildSupplierReportEmail({
    supplierName: "Eesy FM", locationType: "Coop direkte", periodLabel: "oktober 2026",
    totals: { locations: 1, days: 4, amount: 6800 },
    surcharge: { totalSurcharge: 0, refundableAmount: 2800, refundClientName: "Eesy FM", chains: [] },
    locations: [{ name: "Kvickly Testby", days: 4, amount: 6800, refundPerDay: 700, refundAmount: 2800 }],
  });
  assert(text.includes("Vi betaler: 6.800 kr"));
  assert(text.includes("Til refusion fra Eesy FM: 2.800 kr"));
  assert(text.includes("Netto: 4.000 kr"));
  assert(html.includes("Kvickly Testby"));
  assertEquals(html.includes("Merpris og refusion"), false);
});
