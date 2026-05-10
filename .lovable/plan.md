## Plan: Ret straks-flag på ASE-salg

### Scope
Korriger `is_immediate_payment` på `sale_items` hvor flaget er forkert, baseret på FAK-upload som sandhed.

### Trin

**1. Ret de 5 verificerede mismatches (data-fix)**
Via `supabase--insert` (UPDATE):
- **3 OVERBETALT-cases** (DB=straks, FAK=Uden straks): Sæt `is_immediate_payment=false` på "Salg"-item — inkl. Oliver Holton-salget (28ae6b96…).
- **2 UNDERBETALT-cases** (DB=uden, FAK=Straks): Sæt `is_immediate_payment=true` på "Salg"-item.
- Trigger rematch via `rematch-pricing-rules` for de berørte `sale_id`'s, så `mapped_commission` og `mapped_revenue` opdateres til korrekt pris.

**2. Audit af de 698 "ikke verificerbare"**
- Eksportér liste til CSV (allerede delvist gjort i `/mnt/documents/ase_straks_audit.csv`).
- Når FAK-upload kommer ind for disse salg, vil cancellation-flow naturligt afsløre mismatch.
- **Ingen masse-ændring nu** — vi har ikke evidens for hvad der er korrekt for disse 698.

**3. Rapportér rod-årsag (ingen kode-ændring)**
- 84% straks-andel på ASE Salg er strukturelt mistænkeligt, men ingen kode i HEAD sætter flaget automatisk.
- Sandsynlig forklaring: historisk masse-toggle eller import fra før audit-trail eksisterede.
- **Anbefaling til separat opgave (ikke i dette scope):** Tilføj audit-log på `ImmediatePaymentASE.tsx` toggle (hvem/hvornår) for at fange fremtidige fejl.

### Hvad der IKKE indgår
- Ingen kode-ændringer i `ImmediatePaymentASE.tsx` (foreslået som separat opgave).
- Ingen ændring af pricing-motoren.
- Ingen masse-fix af de 698 ikke-verificerede.

### Tekniske detaljer
- Berørte tabeller: `sale_items` (UPDATE af `is_immediate_payment`), efterfulgt af `mapped_commission`/`mapped_revenue` via rematch.
- Rød zone: pricing-motoren røres ikke — kun data-korrektion på `sale_items`.
- Færdig-rapport vil indeholde: liste over ændrede `sale_item_id`'s, ny pricing efter rematch, before/after diff på commission+revenue.
