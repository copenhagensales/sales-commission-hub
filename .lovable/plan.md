

## Problem
`parseCampaignPriceExcel` bruger `ExcelJS` direkte (`wb.xlsx.load`). Filen fra TDC's BI-eksport mangler default-stylesheet (Python warner: *"Workbook contains no default style"*) — ExcelJS smider en exception på den slags, hvilket trigger fejl-toasten *"Kunne ikke læse Excel-filen. Kontroller formatet."*.

UI viser samtidig "0 OPP · 0 m. kampagnepris" fordi state'en blev sat før parsing fejlede (filnavnet vises uanset hvad).

Filen er ellers fin:
- Sheet "Export", 253 rækker
- **Kolonne D = `OPPnr`** (fx `OPP-1057494`) ✅
- **Kolonne M = `Difference`** (numerisk, negativ = kampagnepris, fx `-600`) ✅

Filen indeholder massevis af gyldige OPP-numre med både kampagne (`-600`) og listepris (`0` / `+200`).

## Løsning
Genbrug projektets robuste parser `parseExcelFile` fra `src/utils/excel.ts` — den prøver ExcelJS først og falder tilbage til SheetJS ved fejl (præcis denne situation). Vi læser så positionelt på kolonne D + M via rækkerne den returnerer.

## Ændring (én fil)

**`src/components/cancellations/UploadCancellationsTab.tsx`** — `parseCampaignPriceExcel` (linje 768-800) refaktoreres:

```ts
const parseCampaignPriceExcel = async (buffer: ArrayBuffer): Promise<Map<string, boolean>> => {
  const { rows, columns } = await parseExcelFile(buffer); // robust ExcelJS→SheetJS fallback
  const map = new Map<string, boolean>();
  // Kolonne D = index 3, kolonne M = index 12 (positionelt via columns[])
  const oppCol = columns[3];
  const cpoCol = columns[12];
  if (!oppCol || !cpoCol) return map;

  for (const row of rows) {
    const rawOpp = row[oppCol];
    if (rawOpp == null || rawOpp === "") continue;
    const oppStr = String(rawOpp).toUpperCase().trim();
    if (!/\d/.test(oppStr)) continue; // skip headers/junk

    const rawCpo = row[cpoCol];
    let cpo = 0;
    if (typeof rawCpo === "number") cpo = rawCpo;
    else if (rawCpo != null && rawCpo !== "") {
      const parsed = parseFloat(String(rawCpo).replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.\-]/g, ""));
      cpo = isNaN(parsed) ? 0 : parsed;
    }
    const isCampaign = cpo < 0;
    map.set(oppStr, (map.get(oppStr) ?? false) || isCampaign);
  }
  return map;
};
```

Og forbedring af error-handling i `onCampaignDrop`: nulstil `campaignPriceFile` hvis parse fejler, så brugeren ikke ser et grønt "fil uploaded"-card sammen med en rød fejl-toast.

## Bekræftet via inspektion af din fil
- 253 datarækker, header i række 1
- Eksempler der ville give kampagnepris: `OPP-1058032` (-600), `OPP-1058892` (-600), `OPP-1058294` (-600)
- Eksempler uden: `OPP-1057494` (0), `OPP-1059175` (+200)

