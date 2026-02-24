

## Plan: ASE fixes kun for 2026

### Hvad ændres

**Én ændring i `supabase/functions/rematch-pricing-rules/index.ts`:**

Tilføj raw_payload Lønsikring-check i `determineAseProductId` (efter linje 157, før linje 159):

```text
// Check raw_payload for Lønsikring patterns (catches items where product_id is "Salg" 
// but raw_payload contains Lønsikring data like "Lønsikring Udvidet")
if (rawPayloadData) {
  const loensikringValue = rawPayloadData['Lønsikring'] as string | undefined;
  if (loensikringValue && /lønsikring/i.test(loensikringValue)) {
    console.log(`[rematch-pricing-rules] raw_payload Lønsikring="${loensikringValue}" → correcting to Lønsikring product`);
    return ASE_LOENSIKRING_PRODUCT_ID;
  }
}
```

### Hvad ændres IKKE

- **Ingen sletningslogik** — de 23-25 items fra jan-feb 2025 forbliver uændrede
- **Ingen ændringer til 2025-data overhovedet**

### Forventet resultat ved rematch

| Items | Handling | Provision efter |
|---|---|---|
| 7 Lønsikring items fra 2026 (inkl. 50364361, 22161392, 20339243, 28744341) | Reroutes fra "Salg" → Lønsikring produkt | 400 kr hver |
| 2 manuelt håndterede (60180838, 60150466) | Allerede løst | Uændret |
| 25 items fra 2025 uden regeldata | **Ingen ændring** | Forbliver som de er |

### Deploy og kørsel

1. Tilføj raw_payload check i `determineAseProductId`
2. Deploy funktionen
3. Kør rematch for ASE sale_items (kun 2026 items vil reelt ændres, da 2025-items stadig ikke matcher nogen regel og forbliver uændrede)

