

## Fix: Dedup-nøgle skal inkludere telefonnummer for Eesy TM

### Problem
Salg `42fb3086...` (Kjærgaard) har 4 abonnementer. Abo1 (`23614960`) og Abo2 (`23616630`) har **samme** produktnavn: "Fri tale + 70 GB data (5G) (6 mdr. binding)".

Dedup-nøglen er `sale_id|produktnavn`. Når Abo1 matcher først, blokeres Abo2 — selvom det er et **andet SIM-kort/telefonnummer** og dermed en separat annullering.

### Løsning
Udvid dedup-nøglen for Eesy TM til at inkludere **telefonnummeret**, så to forskellige telefonnumre med samme produkt begge kan annulleres:

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`** — linje 1171-1172

```typescript
// Nuværende:
const resolvedName = matchingItem?.adversus_product_title || `Abonnement${abo.index}`;
const dedupKey = `${sale.id}|${resolvedName}`;

// Nyt:
const resolvedName = matchingItem?.adversus_product_title || `Abonnement${abo.index}`;
const dedupKey = `${sale.id}|${resolvedName}|${excelPhone}`;
```

Ved at tilføje `excelPhone` til nøglen sikres:
- Abo1 (23614960) + "70 GB" → nøgle: `sale_id|70 GB...|23614960` ✓
- Abo2 (23616630) + "70 GB" → nøgle: `sale_id|70 GB...|23616630` ✓ (ny unik nøgle)
- Samme telefonnummer der matcher to gange → stadig blokeret (korrekt dedup)

### Konsekvens
- To **forskellige** telefonnumre med **samme** produkt → begge matches (korrekt)
- Samme telefonnummer der matcher flere gange → stadig dedupet (korrekt)
- Andre klienter: Uberørte (ændringen er kun i Eesy TM-blokken)

