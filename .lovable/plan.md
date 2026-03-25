

## Auto-match for produkt-mappings

### Problem
Der er mange Excel-produktnavne (f.eks. "Fri tale + 70 GB data (5G) (6 mdr. binding)") som ligner interne produktnavne. Brugeren skal manuelt mappe dem én ad gangen, selvom de ofte er næsten identiske.

### Løsning
Tilføj en "Auto-match" knap der kører fuzzy string-matching mellem umappede Excel-navne og interne produkter, og viser forslag i en godkendelses-tabel.

**Fil:** `src/components/cancellations/SellerMappingTab.tsx`

### Matching-algoritme
For hvert umappet Excel-navn:
1. **Eksakt match** — case-insensitive direkte sammenligning
2. **Substring containment** — hvis det ene navn indeholder det andet
3. **Normalized similarity** — fjern parenteser, ekstra whitespace, og sammenlign kernenavne med en simpel token-overlap score (Jaccard-lignende)

Kun forslag med tilstrækkelig høj score (>0.5) vises. Bedste match per Excel-navn vælges.

### UI-flow
1. Ny knap **"Auto-match"** (med Wand-ikon) ved siden af den eksisterende "Tilføj"-sektion
2. Klik genererer forslag client-side (ingen API-kald)
3. Forslag vises i en tabel med kolonner:
   - Excel-produktnavn
   - Foreslået internt produkt
   - Score (som badge: "Eksakt", "Høj", "Medium")
   - Checkbox for godkendelse (alle valgt som default)
4. **"Godkend valgte"**-knap gemmer alle markerede forslag som mappings via batch-upsert
5. Brugeren kan ændre det foreslåede produkt via dropdown inden godkendelse

### Teknisk detalje
```text
// Pseudo-kode for matching
function findBestMatch(excelName: string, products: Product[]): Match | null {
  const normalized = normalize(excelName);  // lowercase, fjern parenteser, trim
  
  // 1. Eksakt match
  const exact = products.find(p => normalize(p.name) === normalized);
  if (exact) return { product: exact, score: 1.0, level: "Eksakt" };
  
  // 2. Substring
  const substring = products.find(p => 
    normalized.includes(normalize(p.name)) || normalize(p.name).includes(normalized)
  );
  if (substring) return { product: substring, score: 0.8, level: "Høj" };
  
  // 3. Token overlap (Jaccard)
  const tokens = normalized.split(/\s+/);
  let best = { product: null, score: 0 };
  for (const p of products) {
    const pTokens = normalize(p.name).split(/\s+/);
    const intersection = tokens.filter(t => pTokens.includes(t)).length;
    const union = new Set([...tokens, ...pTokens]).size;
    const score = intersection / union;
    if (score > best.score) best = { product: p, score };
  }
  if (best.score > 0.5) return { ...best, level: best.score > 0.7 ? "Høj" : "Medium" };
  return null;
}
```

### Batch-godkendelse
Ved klik på "Godkend valgte" upsert'es alle markerede forslag i ét kald:
```typescript
await supabase
  .from("cancellation_product_mappings")
  .upsert(
    selectedSuggestions.map(s => ({
      client_id: clientId,
      excel_product_name: s.excelName,
      product_id: s.productId,
    })),
    { onConflict: "client_id,excel_product_name" }
  );
```

### Forventet resultat
- Mapper 80-90% af produktnavne automatisk med ét klik
- Brugeren verificerer og godkender inden noget gemmes
- Mulighed for at justere individuelle forslag før godkendelse

