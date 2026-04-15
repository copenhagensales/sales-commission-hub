import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

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
 * Parse with ExcelJS (primary parser).
 */
async function parseWithExcelJS(
  data: ArrayBuffer,
  options?: { defval?: string }
): Promise<{ rows: Record<string, unknown>[]; columns: string[]; sheetName: string }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], columns: [], sheetName: "" };

  const headers: string[] = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "");
  });

  const validHeaders = headers.filter((h) => h !== "");

  const rows: Record<string, unknown>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
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

/**
 * Parse with SheetJS (fallback for files ExcelJS cannot handle).
 */
function parseWithSheetJS(
  data: ArrayBuffer,
  options?: { defval?: string }
): { rows: Record<string, unknown>[]; columns: string[]; sheetName: string } {
  const wb = XLSX.read(new Uint8Array(data), { type: "array" });
  const sheetName = wb.SheetNames[0] || "";
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], columns: [], sheetName: "" };

  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: options?.defval ?? undefined,
  });

  if (jsonRows.length === 0) return { rows: [], columns: [], sheetName };

  const columns = Object.keys(jsonRows[0]);
  return { rows: jsonRows, columns, sheetName };
}

/**
 * Parse an Excel file (ArrayBuffer) and return rows as JSON objects.
 * Uses ExcelJS as primary parser with SheetJS as fallback for incompatible files.
 */
export async function parseExcelFile(
  data: ArrayBuffer,
  options?: { defval?: string }
): Promise<{ rows: Record<string, unknown>[]; columns: string[]; sheetName: string }> {
  try {
    return await parseWithExcelJS(data, options);
  } catch {
    // ExcelJS failed (e.g. invalid styles.xml) – fall back to SheetJS
    console.warn("ExcelJS parse failed, falling back to SheetJS");
    return parseWithSheetJS(data, options);
  }
}
