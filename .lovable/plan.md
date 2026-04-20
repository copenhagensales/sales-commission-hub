

## Mål
På Godkendelseskø-fanen for TDC Erhverv: vis "Kampagne pris: Ja/Nej" under "Uploadet data" (sammen med CPO Total og TT trin), men **kun** når et af de uploadede produkter er "5G Fri" (fx `ERHVERV 5G FRI<500/100`).

## Aktuel situation
- `buildTdcUploadedStructured` (linje 276-294 i `ApprovalQueueTab.tsx`) prøver at læse `uploadedData["Kampagne pris"]` — men feltet ligger faktisk på `_product_rows` sub-rows (sat i `UploadCancellationsTab.tsx` linje 1615/2155), ikke på top-level. Derfor er feltet altid tomt og vises aldrig.
- Render-koden (linje 1329) er der allerede; den behøver bare korrekt data + en 5G Fri-betingelse.

## Ændring (én fil)

**`src/components/cancellations/ApprovalQueueTab.tsx`** — `buildTdcUploadedStructured` (linje 276-294):

1. Læs `Kampagne pris` fra første sub-row i `_product_rows` (case-insensitive) i stedet for top-level.
2. Tjek om noget produktnavn matcher "5G Fri" (case-insensitive regex `/5G\s*FRI/i` — fanger både `ERHVERV 5G FRI<500/100` og `5G Fri 1000/1000`).
3. Sæt `kampagnePris` til tom streng hvis ikke 5G Fri → eksisterende render (`structured.kampagnePris !== ""`) skjuler badget automatisk.

```ts
// Læs Kampagne pris fra første sub-row
let kampagnePris = "";
if (productRows && productRows.length > 0) {
  const first = productRows[0];
  const key = Object.keys(first).find(k => k.toLowerCase() === "kampagne pris");
  if (key) kampagnePris = String(first[key] ?? "").trim();
}

// Vis kun hvis et produkt er 5G Fri
const has5gFri = products.some(p => /5G\s*FRI/i.test(p.name));
if (!has5gFri) kampagnePris = "";
```

## Hvad jeg IKKE rører
- `UploadCancellationsTab.tsx` — enrichment fungerer allerede.
- Andre kunder — guarden `clientId === TDC_ERHVERV_CLIENT_ID` i render-laget er uændret.
- CPO Total / TT trin-rendering.

## Verificering
- OPP med `ERHVERV 5G FRI<500/100` + kampagne i map → "Kampagne pris: Ja" vises.
- OPP med `MOBIL PROFESSIONEL 100GB` (ingen 5G Fri) → ingen Kampagne pris-badge (selvom value findes).
- OPP med 5G Fri men ikke i kampagne-map → "Kampagne pris: Nej" vises.

