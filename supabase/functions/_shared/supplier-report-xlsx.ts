// Excel-bilag til leverandørrapporter.
// VIGTIGT: Arket videresendes til leverandøren og må KUN indeholde totaler.
// Ingen merpris, intet grundbeløb og ingen refusion.
import ExcelJS from "npm:exceljs@4.4.0";

export interface SupplierXlsxRow {
  locationName: string;
  externalId: string;
  city: string;
  days: number;
  amount: number;
}

export function slugifyLocationType(locationType: string): string {
  return locationType
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function xlsxFileName(locationType: string, yearMonth: string): string {
  return `Leverandoerrapport_${slugifyLocationType(locationType)}_${yearMonth}.xlsx`;
}

const ARIAL = { name: "Arial", size: 11 };
const MONEY = '#,##0 "kr"';

export async function buildSupplierReportXlsx(params: {
  locationType: string;
  supplierName?: string | null;
  periodLabel: string;
  rows: SupplierXlsxRow[];
}): Promise<Uint8Array> {
  const { locationType, supplierName, periodLabel, rows } = params;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Copenhagen Sales";
  const ws = wb.addWorksheet("Leverandørrapport");

  ws.columns = [
    { key: "locationName", width: 34 },
    { key: "externalId", width: 16 },
    { key: "city", width: 22 },
    { key: "days", width: 10 },
    { key: "amount", width: 16 },
  ];

  const titleRow = ws.addRow([`Leverandør: ${supplierName || locationType}`]);
  titleRow.font = { ...ARIAL, size: 13, bold: true };
  const periodRow = ws.addRow([`Periode: ${periodLabel}`]);
  periodRow.font = { ...ARIAL, bold: true };
  ws.addRow([]);

  const headerRowIndex = 4;
  const header = ws.addRow(["Lokation", "Butiksnr/ref", "By", "Dage", "Beløb"]);
  header.font = { ...ARIAL, bold: true };
  header.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } };
  });
  header.getCell(4).alignment = { horizontal: "right" };
  header.getCell(5).alignment = { horizontal: "right" };

  const firstDataRow = headerRowIndex + 1;
  for (const r of rows) {
    const row = ws.addRow([
      r.locationName || "",
      r.externalId || "",
      r.city || "",
      Number(r.days) || 0,
      Number(r.amount) || 0,
    ]);
    row.font = ARIAL;
    row.getCell(4).numFmt = "#,##0";
    row.getCell(5).numFmt = MONEY;
  }
  const lastDataRow = firstDataRow + rows.length - 1;

  const totalRow = ws.addRow([
    "Total",
    "",
    "",
    rows.length > 0 ? { formula: `SUM(D${firstDataRow}:D${lastDataRow})` } : 0,
    rows.length > 0 ? { formula: `SUM(E${firstDataRow}:E${lastDataRow})` } : 0,
  ]);
  totalRow.font = { ...ARIAL, bold: true };
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: "thin" } };
  });
  totalRow.getCell(4).numFmt = "#,##0";
  totalRow.getCell(5).numFmt = MONEY;

  ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
