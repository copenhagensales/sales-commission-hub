

## Mål
På Godkendelseskø-fanen for TDC Erhverv: gruppér identiske 5G Fri produkter under "Produkter" (upload-siden) så `ERHVERV 5G FRI<50/10 ×1` (5 stk) vises som `ERHVERV 5G FRI<50/10 ×5` i stedet for 5 separate badges.

## Undersøgelse
Skal lokalisere render-koden for upload-produkter i `ApprovalQueueTab.tsx` (omkring linje 1329 hvor CPO Total/TT trin/Kampagne pris vises). Produkterne kommer fra `structured.products` bygget i `buildTdcUploadedStructured`.

## Ændring (én fil)

**`src/components/cancellations/ApprovalQueueTab.tsx`** — `buildTdcUploadedStructured`:

Efter produktlisten er bygget, tilføj en konsolideringsfase (kun for TDC):
- Group by produktnavn (case-insensitive normaliseret)
- Sum quantity per gruppe
- Bevar første forekomsts metadata (navn-formatering)

```ts
// Konsolidér identiske produkter (TDC viser samme produkt som flere ×1 rows)
const consolidated = new Map<string, { name: string; quantity: number }>();
for (const p of products) {
  const key = p.name.trim().toLowerCase();
  const existing = consolidated.get(key);
  if (existing) {
    existing.quantity += p.quantity;
  } else {
    consolidated.set(key, { name: p.name, quantity: p.quantity });
  }
}
const groupedProducts = Array.from(consolidated.values());
```

Returnér `groupedProducts` i stedet for `products`.

## Hvad jeg IKKE rører
- Andre kunder (kun TDC-grenen)
- "Produkter solgt" (system-siden) — den er allerede grupperet
- CPO Total / TT trin / Kampagne pris-felter
- Matching/godkendelses-logik

## Verificering
- OPP-1077005: 5× `ERHVERV 5G FRI<50/10` → vises som `ERHVERV 5G FRI<50/10 ×5` (ét badge)
- OPP med blandede produkter (fx 2× 5G Fri + 1× Mobil) → 2 badges med korrekte antal
- Ikke-TDC kunder → uændret

