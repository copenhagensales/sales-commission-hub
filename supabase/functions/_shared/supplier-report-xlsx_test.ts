import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import ExcelJS from "npm:exceljs@4.4.0";
import { buildSupplierReportXlsx } from "./supplier-report-xlsx.ts";
import { approvedRowRefund, coopOnlyRefund } from "./supplier-report-refunds.ts";

const row = { locationName: "Kvickly Testby", externalId: "", city: "Testby", days: 4,
  dailyRate: 1700, amount: 6800, refundPerDay: 700, refundAmount: 2800,
  weeks: [{ week: 41, days: 4, dailyRate: 1700, amount: 6800, refundPerDay: 700, refundAmount: 2800 }] };

Deno.test("Coop direkte Excel viser 6800 betalt, 2800 refusion, 4000 netto uden dobbelt ugensum", async () => {
  const bytes = await buildSupplierReportXlsx({ locationType: "Coop direkte", periodLabel: "oktober 2026", rows: [row] });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  const ws = wb.worksheets[0];
  assertEquals(ws.getRow(5).getCell(5).value, 6800);
  assertEquals(ws.getRow(5).getCell(8).value, 2800);
  assertEquals(ws.getRow(5).getCell(9).value, 4000);
  assertEquals(ws.getRow(6).getCell(1).value, "  Uge 41");
  assertEquals(ws.getRow(7).getCell(5).value, 6800);
  assertEquals(ws.getRow(8).getCell(5).value, 2800);
  assertEquals(ws.getRow(9).getCell(5).value, 4000);
});

Deno.test("Coop butik Excel forbliver fem kolonner uden direkte refusion", async () => {
  const bytes = await buildSupplierReportXlsx({ locationType: "Coop butik", periodLabel: "oktober 2026", rows: [row] });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  assertEquals(wb.worksheets[0].columnCount, 5);
  assertEquals(wb.worksheets[0].getRow(6).getCell(1).value, "Total");
  assertEquals(approvedRowRefund("Coop butik", row), 0);
  assertEquals(coopOnlyRefund({ refundableAmount: 6300, directRefunds: [{ amount: 2800 }] }), 3500);
});