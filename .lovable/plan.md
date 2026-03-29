

## Plan: Deduplikering ved upload baseret på telefonnummer

### Problem
Samme telefonnummer kan optræde flere gange i upload-arket (f.eks. sælger har tastet samme salg flere gange). Det resulterer i flere entries i godkendelseskøen for samme salg — gælder både annulleringer og kurv-rettelser.

Den nuværende "Dubletter"-fane grupperer efter `saleId`, men det rigtige kriterium er telefonnummer, da det er sådan man identificerer om det er samme salg.

### Løsning

**Fil:** `src/components/cancellations/UploadCancellationsTab.tsx`

**Trin 1 — Dedupliker `queueItems` efter telefonnummer (linje ~1810-1812)**

Efter `queueItems` er bygget og før batch-insert, tilføjes et filter:

1. Byg et lookup: `sale_id` → `phone` fra `matchedSales`
2. Gruppér `queueItems` efter normaliseret telefonnummer
3. For grupper med flere entries med **samme `upload_type`** → behold kun første entry
4. For entries med **forskellige `upload_type`** for samme telefon → behold kun første entry (da det er samme salg tastet flere gange)

Resultat: Kun én queue-entry per unikt telefonnummer.

```text
Før dedup:
  phone=12345678, sale_id=ABC, type=cancellation   ← behold
  phone=12345678, sale_id=ABC, type=cancellation   ← fjern
  phone=87654321, sale_id=DEF, type=basket_diff    ← behold
  phone=87654321, sale_id=DEF, type=basket_diff    ← fjern

Efter dedup:
  phone=12345678, sale_id=ABC, type=cancellation
  phone=87654321, sale_id=DEF, type=basket_diff
```

**Trin 2 — Opdater "Dubletter"-fanen (linje ~1896-1907)**

Ændr gruppering fra `saleId` til normaliseret `phone`, så preview korrekt viser hvilke rækker der er dubletter. Tilføj info-tekst: "Dubletter konsolideres automatisk — kun én entry per telefonnummer sendes til godkendelse."

**Trin 3 — Opdater count i success-toast (linje ~1820)**

Brug `deduplicatedItems.length` i stedet for `queueItems.length` så brugeren ser det faktiske antal entries der sendes.

### Tekniske detaljer
- Telefonnumre normaliseres (strip whitespace/bindestreger) før sammenligning
- `MatchedSale` har allerede `phone`-feltet tilgængeligt
- Ingen ændringer i matching-logik eller klassificeringslogik
- Eksisterende flows forbliver uændrede

### Filer
- `src/components/cancellations/UploadCancellationsTab.tsx` — dedup-filter + preview-opdatering

