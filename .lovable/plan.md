

# Migrér fra sårbar `xlsx` pakke til `exceljs`

## Problem
`xlsx` (SheetJS Community Edition) v0.18.5 har to kendte high-severity sårbarheder:
- **Prototype Pollution** (GHSA-4r6h-8v6p-xvw6)
- **ReDoS** (GHSA-5pgg-2g8v-p4x9)

Pakken vedligeholdes ikke længere — der er ingen patch tilgængelig. Eneste løsning er at migrere til et andet bibliotek.

## Løsning
Erstat `xlsx` med **`exceljs`** — et aktivt vedligeholdt bibliotek med lignende API til læsning og skrivning af Excel-filer.

## Berørte filer (6 frontend + 1 edge function)

### Kun export (lavere risiko, men skal stadig migreres)
| Fil | Brug |
|-----|------|
| `src/pages/reports/ReportsManagement.tsx` | Eksport af salgsrapport |
| `src/pages/reports/LocationReportTab.tsx` | Eksport af lokationsrapport |
| `src/components/billing/SupplierReportTab.tsx` | Eksport af leverandørrapport |

### Import/parsing (højere risiko — parser bruger-uploadede filer)
| Fil | Brug |
|-----|------|
| `src/components/employees/EmployeeExcelImport.tsx` | Parsing af medarbejder-Excel |
| `src/components/cancellations/UploadCancellationsTab.tsx` | Parsing af annullerings-Excel |
| `src/pages/ExcelFieldMatcher.tsx` | Parsing af felt-match Excel |

### Edge function
| Fil | Brug |
|-----|------|
| `supabase/functions/import-economic-zip/index.ts` | Parsing af e-conomic Excel/ZIP (bruger esm.sh import) |

## Migreringsplan

### 1. Installér `exceljs`, fjern `xlsx`
- Tilføj `exceljs` som dependency
- Fjern `xlsx` fra package.json
- Opdatér `vite.config.ts` manualChunks: erstat `'vendor-xlsx': ['xlsx']` med `'vendor-xlsx': ['exceljs']`

### 2. Migrér export-filer (3 filer)
Erstat XLSX-write pattern:
```
// Før (xlsx)
const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet");
XLSX.writeFile(wb, "file.xlsx");

// Efter (exceljs)
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Sheet");
ws.columns = [...];
ws.addRows(rows);
const buffer = await wb.xlsx.writeBuffer();
saveAs(new Blob([buffer]), "file.xlsx");
```

### 3. Migrér import-filer (3 filer)
Erstat XLSX-read pattern:
```
// Før (xlsx)
const wb = XLSX.read(data, { type: "array" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

// Efter (exceljs)
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(data);
const ws = wb.getWorksheet(1);
// Iterér rækker manuelt
```

### 4. Migrér edge function
- Erstat `https://esm.sh/xlsx@0.18.5` med `https://esm.sh/exceljs` i `import-economic-zip/index.ts`
- Tilpas `parseExcel()` funktionen til exceljs API

### 5. Tilføj `file-saver` som dependency
ExcelJS skriver til buffer — brug `file-saver` (eller en simpel blob-download helper) til at trigge fildownload i browseren.

## Tekniske noter
- ExcelJS er ~200KB larger end xlsx, men understøtter streaming og har aktiv vedligeholdelse
- Alle eksisterende kolonnebredder og formatering bevares via exceljs column-config
- Edge function bruger ESM-import og skal testes separat efter migrering

