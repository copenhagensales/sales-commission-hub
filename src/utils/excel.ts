import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Create and download an Excel file with multiple sheets.
 * Each sheet is defined by a name and an array of row objects (json_to_sheet style).
 */
export async function downloadExcel(
  filename: string,
  sheets: Array<{
    name: string;
    rows: Record<string, unknown>[];
    columnWidths?: number[];
  }>
) {
  const wb = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    if (sheet.rows.length === 0) continue;

    const keys = Object.keys(sheet.rows[0]);
    ws.columns = keys.map((key, i) => ({
      header: key,
      key,
      width: sheet.columnWidths?.[i] ?? 14,
    }));

    for (const row of sheet.rows) {
      ws.addRow(row);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

/**
 * Create and download an Excel file from array-of-arrays (aoa_to_sheet style).
 */
export async function downloadExcelAoa(
  filename: string,
  sheetName: string,
  data: unknown[][],
  columnWidths?: number[],
  boldRows?: number[]
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  for (const row of data) {
    ws.addRow(row);
  }

  if (columnWidths) {
    columnWidths.forEach((w, i) => {
      const col = ws.getColumn(i + 1);
      col.width = w;
    });
  }

  if (boldRows) {
    for (const rowIdx of boldRows) {
      const row = ws.getRow(rowIdx + 1); // ExcelJS is 1-indexed
      row.font = { bold: true };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

/**
 * Parse an Excel file (ArrayBuffer or binary string) and return rows as JSON objects.
 */
export async function parseExcelFile(
  data: ArrayBuffer,
  options?: { defval?: string }
): Promise<{ rows: Record<string, unknown>[]; columns: string[]; sheetName: string }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.getWorksheet(1);
  if (!ws) return { rows: [], columns: [], sheetName: "" };

  const headers: string[] = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "");
  });

  // Filter out empty trailing headers
  const validHeaders = headers.filter((h) => h !== "");

  const rows: Record<string, unknown>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    validHeaders.forEach((header, i) => {
      const cell = row.getCell(i + 1);
      const val = cell.value;
      if (val !== null && val !== undefined && val !== "") {
        obj[header] = val;
        hasValue = true;
      } else {
        obj[header] = options?.defval ?? undefined;
      }
    });
    if (hasValue) rows.push(obj);
  });

  return { rows, columns: validHeaders, sheetName: ws.name };
}
