## Hvad jeg har fundet (read-only)

**Thorbjørn Mindedal Weichert** — `thor@cph-relatel.dk` — lønperiode 15/5–14/6 2026:

- **52 salg / 104 sale_items / 136 stk**
- **Samlet provision: 208.662,00 kr** (qty × `mapped_commission`)
  - Heraf matchet af pricing-rule: **198.927,00 kr** (på linjer hvor `matched_pricing_rule_id IS NOT NULL` — typisk "rettet" via rematch)
  - Uden pricing-rule (fallback til produkt-default): **9.735,00 kr**

⚠️ **OBS:** Dette tal (208.662) er præcis ~2× det tal jeg rapporterede i tidligere session (~103.000). Forskellen skyldes sandsynligvis at jeg tidligere filtrerede på en agent-mapping der kun fangede halvdelen af linjerne, ELLER at der findes dobbelte sale_items pr. salg (52 salg → 104 items = 2 items pr. salg i snit). Værd at få verificeret før det bruges til løn.

## Hvad jeg vil levere (i build mode)

1. **CSV-fil** til `/mnt/documents/thorbjorn-15maj-14jun.csv` med kolonner:
   - `dato`, `produkt`, `antal`, `pris_pr_stk`, `provision_linje`, `rettet_via_regel` (ja/nej), `regel_id`, `sale_id`
2. **Markdown-tabel i chat** med alle 104 linjer grupperet pr. dag, totaler pr. dag, og samlet bund-total
3. **Kort note** om de 2× duplikat-mistanken — om jeg skal grave i hvad der reelt ligger pr. salg (samme produkt to gange, eller adversus+enreach dual-import)

## Ingen kode-ændringer

Ren read-only + filudtræk. Ingen filer i `src/` eller `supabase/` ændres.

Skift til build mode hvis det er OK, så leverer jeg CSV + tabel.