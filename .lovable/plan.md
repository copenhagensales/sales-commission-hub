

## Fix: Kritisk sync-fejl - Duplikerede internal_reference ved upsert

### Problem
Alle Lovablecph/Tryg salgs-synkroniseringer fejler siden kl. 07:53 med `duplicate key value violates unique constraint "idx_sales_internal_reference"`. Triggeren genererer nye referencenumre for eksisterende salg ved upsert, og disse kolliderer med andre rækker.

### Strategi: 2-lags defensiv løsning

---

### Lag 1: Database-migration

Erstat `generate_sales_internal_reference()` med idempotent version:

```text
Logik:
  a) Hvis NEW.internal_reference allerede er sat -> RETURN NEW (uændret)
  b) Hvis NEW.adversus_external_id findes i sales-tabellen -> genbrug eksisterende reference
  c) Ellers -> generér nyt MG-YYYYMM-NNNNN nummer via sekvens (som i dag)
```

Triggeren forbliver `BEFORE INSERT ... WHEN (NEW.internal_reference IS NULL)`, men nu har funktionen et ekstra sikkerhedsnet for upsert-scenarier.

### Lag 2: Application-kode (`core/sales.ts`)

3 ændringer i `supabase/functions/integration-engine/core/sales.ts`:

**a) Hent `internal_reference` ved eksisterende-salg lookup (linje 370)**
- Ændr `.select("id, adversus_external_id, customer_phone")` til `.select("id, adversus_external_id, customer_phone, internal_reference")`

**b) Bevar reference i upsert-data (linje 419-433)**
- Tilføj efter `saleData`-objektet:
  ```text
  const existingRef = existingSalesMap.get(sale.externalId)?.internal_reference;
  if (existingRef) saleData.internal_reference = existingRef;
  ```
- Triggeren springer automatisk over når `internal_reference` ikke er null.

**c) Fix fejl-logning (linje 524)**
- Erstat `String(e)` med `(e as any)?.message || JSON.stringify(e)` så PostgreSQL-fejl vises korrekt i stedet for `[object Object]`.

### Afgrænsning
- Ingen ændring af referenceformat (`MG-YYYYMM-NNNNN`).
- Ingen ændring af eksisterende references på gamle rækker.
- `onConflict: "adversus_external_id"` bevares.
- Ingen brede refactors uden for de to filer.

### Acceptkriterier
- Triggeren er idempotent: upsert af kendt `adversus_external_id` bevarer samme `internal_reference`.
- Nye salg får fortsat gyldigt `MG-YYYYMM-NNNNN`.
- Næste sync-runs fejler ikke med duplicate key.
- Fejl-logning viser læsbar tekst.

### Verifikation efter deploy
1. Deploy migration + edge function
2. Vent på næste sync (hvert 5. minut)
3. Tjek `integration_sync_runs` for Lovablecph: `records_processed > 0`, `errors_count = 0`
4. Bekræft at dagens 5 salg vises i dashboardet

### Rollback-plan
- **Database**: Kør migration der gendanner den originale `generate_sales_internal_reference()` funktion (uden adversus_external_id-lookup).
- **Kode**: Fjern `internal_reference` fra select-query og saleData-tildelingen i `core/sales.ts`.

