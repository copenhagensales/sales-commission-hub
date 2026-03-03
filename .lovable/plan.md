

## Fix: Subtotal beløb line-wrap

Problemet er at "56.000 kr" i total-rækken wrapper til to linjer fordi cellen er for smal eller teksten ikke har `white-space: nowrap`.

### Ændring

**`supabase/functions/send-supplier-report/index.ts`** — i `subtotalRow` template:

Tilføj `white-space:nowrap;` på alle beløb-celler i total-rækken (både "Dage", "Beløb" og evt. "Netto" kolonner). Samme fix bør tilføjes på beløb-cellerne i de almindelige rækker for konsistens.

Specifikt:
- Tilføj `white-space:nowrap;` til alle `<td>` med `text-align:right` i subtotal-rækken
- Tilføj `white-space:nowrap;` til beløb-cellerne i `tableRows` også

