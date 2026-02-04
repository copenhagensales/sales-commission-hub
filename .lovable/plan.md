
# Plan: Ret manglende Tryg-salg fra i dag

## Problem Identificeret

**Root cause:** Integration Engine processer kun 25 salg per sync, men API'en returnerer data **usorteret**. Dette betyder at de samme 25 ældste salg processer igen og igen, mens 26 nye salg fra i dag (4. februar) aldrig når frem.

### Bevis fra undersøgelsen

| Data punkt | Værdi |
|------------|-------|
| Tryg-salg med `closure=Success` i rå data | 88 |
| Salg fra **i dag** (4. feb) i rå data | 26 |
| Tryg-salg i databasen fra i dag | **0** |
| Salg processet per sync | 25 |
| Specifik ID `81107234S3064` (fra kl 16:17 i dag) | Findes IKKE i DB |

---

## Løsning

Sortér salg efter salgsdato (nyeste først) **FØR** `maxRecords`-begrænsningen anvendes. Dette sikrer at dagens salg altid processer først.

---

## Tekniske ændringer

### 1. Opdater `sync-integration.ts`

Tilføj sortering efter salgsdato før maxRecords-begrænsningen (omkring linje 80-89):

**Nuværende kode:**
```typescript
// Apply max records limit to prevent CPU timeout
if (maxRecords && sales.length > maxRecords) {
  log("INFO", `Limiting sales from ${sales.length} to ${maxRecords} to prevent timeout`);
  sales = sales.slice(0, maxRecords);
}
```

**Ny kode:**
```typescript
// Sort sales by date DESCENDING (newest first) before applying limit
sales.sort((a, b) => {
  const dateA = new Date(a.saleDate || a.date || 0).getTime();
  const dateB = new Date(b.saleDate || b.date || 0).getTime();
  return dateB - dateA; // Newest first
});

// Apply max records limit to prevent CPU timeout
if (maxRecords && sales.length > maxRecords) {
  log("INFO", `Limiting sales from ${sales.length} to ${maxRecords} (keeping newest)`);
  sales = sales.slice(0, maxRecords);
}
```

### 2. Øg `effectiveMaxRecords` (valgfrit men anbefalet)

I `index.ts` (linje 32):

```typescript
// Øg fra 25 til 50-100 for hurtigere indhentning af backlog
const effectiveMaxRecords = maxRecords ?? 50;
```

---

## Fordele

- **Dagens salg processer altid først** - uanset backlog-størrelse
- **Ældre salg indhentes gradvist** over flere sync-cykler
- **Ingen ændring i CPU-forbrug** - samme antal records processer
- **Kompatibilitet bevares** - ingen ændring i API eller dataformat

---

## Fil-ændringer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/integration-engine/actions/sync-integration.ts` | Tilføj sortering af salg efter dato (nyeste først) før maxRecords-begrænsning |
| `supabase/functions/integration-engine/index.ts` | (Valgfrit) Øg effectiveMaxRecords fra 25 til 50 |

---

## Forventet resultat

Efter deploy vil næste sync:
1. Sortere de 88 Tryg-salg efter dato
2. Tage de 25 (eller 50) nyeste
3. Processse og gemme de 26 salg fra i dag
4. Tryg-salg vises korrekt i Client DB-rapporten inden for 5 minutter
