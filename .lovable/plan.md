

# Fix: Matching uden filter returnerer alle salg

## Problem
Når kun OPP-kolonne er valgt, er `orConditions` tom. Queryen kører uden telefon/virksomheds-filter og returnerer op til 500 tilfældige salg fra kunden.

## Ændring

### `src/components/cancellations/UploadCancellationsTab.tsx`

I `handleMatch()`:

1. **Skip hoved-query hvis ingen telefon/virksomheds-filter** — Kun kør den generelle query (linje 203-221) hvis `orConditions.length > 0`. Start med `allMatched = []` i stedet.

2. **OPP-søgning kører uafhængigt** — OPP-matches tilføjes kun via de separate `.ilike()` queries som allerede eksisterer (linje 228-250).

**Konkret**: Wrap linje 203-225 i en `if (orConditions.length > 0) { ... }` og initialiser `allMatched` som tom array udenfor.

| Fil | Ændring |
|-----|---------|
| `UploadCancellationsTab.tsx` | Kun kør hoved-query når der er telefon/virksomheds-filter |

