## Diagnose (evidens)

Sælger: **Nanna Chanell Johansen** (`nacj@copenhagensales.dk`), periode 15/4–14/5.

Stork-tællinger pr. dialer-kampagne:
- 104520 TRYG - FDM: **327** (Adversus: 326) → +1
- 106190 AKA: **76** (Adversus: 75) → +1
- 104835 TRYG - Hjerteforening: **23** (Adversus: 22) → +1

I hver kampagne findes præcis ét salg med `sales.validation_status = 'cancelled'`:

| Kampagne | adversus_external_id | sale_datetime |
|---|---|---|
| 104520 FDM | 1320755 | 2026-04-15 08:24 |
| 106190 AKA | 1322872 | 2026-04-15 15:03 |
| 104835 Hjerteforening | 1365505 | 2026-05-13 13:25 |

**Konklusion:** Stork-tælleren der vises som "succes pr. kampagne" filtrerer ikke `validation_status = 'cancelled'` fra. Adversus tæller dem ikke. Differencen er 1:1 med antallet af cancelled salg.

Ingen reelle dubletter (ingen duplikat `adversus_external_id`, ingen duplikat telefon med samme phone).

## Åbne spørgsmål før implementation

1. **Hvor vises tallene?** Du står på `/vagt-flow/edit-sales`. Er det her tallene 327/76/23 vises, eller i et andet view (dashboard, sælgerprofil, kampagnerapport)? Skærmbillede eller sti hjælper mig med at ramme præcis det rigtige sted i første hug. `validation_status` håndteres forskelligt mellem 30+ filer — flere af dem ekskluderer allerede cancelled, andre ikke.

2. **Definition af "succes" på tværs af Stork.** To muligheder:
   - **(a) Lokal fix:** kun det view du peger på filtrerer `validation_status != 'cancelled'`.
   - **(b) Global regel:** alle "succes/møde-tællere" pr. kampagne (dashboards, sælgerprofiler, leaderboards, KPI'er) ekskluderer `cancelled`. Konsistent men rød zone — `useSalesAggregates` / `get_sales_aggregates_v2` påvirker løn-tal.

   Anbefaling: **(a) først** for at lukke det konkrete symptom, derefter audit af alle steder i en separat opgave.

3. **Hvad ligger bag `validation_status = 'cancelled'`?** De tre salg er fra 15/4 og 13/5. Skal jeg verificere at de faktisk er annulleret i Adversus (forventet), eller om de er "annulleret i Stork men aktive i Adversus" (utilsigtet)? Det afgør om fixet er kun visuelt, eller om der også er et data-sync-problem.

## Forslag til plan (afventer dine svar)

**Del 1 — bekræft scope (rød/gul zone):**
- Du peger på den konkrete komponent/RPC der viser 327/76/23
- Jeg verificerer i koden at den ikke filtrerer cancelled

**Del 2 — fix (gul zone hvis kun visning, rød hvis aggregates_v2):**
- Tilføj `validation_status != 'cancelled'` (eller `IS DISTINCT FROM 'cancelled'`) i den relevante query
- Test: tallene bliver 326/75/22 for Nanna i samme periode

**Del 3 — audit (separat opgave, kun hvis du vil):**
- Liste alle steder i koden hvor "antal salg/møder pr. kampagne" beregnes
- Markér hvilke filtrerer cancelled og hvilke ikke
- Beslut én konsistent regel (ref. princip 3: én sandhed)

Ingen filer ændres før du svarer på spørgsmål 1 og 2.
