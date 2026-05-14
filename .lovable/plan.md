## Plan: Opret "Fri tale + 100 GB data (5G) (6 mdr. binding)" som rigtigt produkt

Spejler 1:1 strukturen for søsterproduktet "Fri tale + 110" (id `5e20993c-be45-4913-b2a0-7a7edb2282a2`) på Eesy TM-kampagnen, så det nye produkt opfører sig præcis som de andre — ingen hardkodning.

### 1. Opret produkt
INSERT i `products`:
- Navn: `Fri tale + 100`
- `client_campaign_id`: `d031126c-aec0-4b80-bbe2-bbc31c4f04ba` (Eesy TM Products — samme som 110)
- `commission_dkk`: **350** (basis = kolde leads)
- `revenue_dkk`: **700**
- `counts_as_sale: true`, `is_active: true`

### 2. Opret Adversus-mapping (så fremtidige salg auto-matcher)
INSERT i `adversus_product_mappings`:
- `adversus_product_title` = `adversus_external_id` = `Fri tale + 100 GB data (5G) (6 mdr. binding)`
- `product_id` = nyt produkt-id

### 3. Opret pricing rule for varme leads
INSERT i `product_pricing_rules` — kopi af "Specialkampagne 2026"-reglen fra 110:
- `name`: `Specialkampagne 2026`
- `priority`: 10
- `campaign_match_mode`: `exclude` (samme 20 varme campaign_mapping_ids som 110-reglen)
- `commission_dkk`: **260**, `revenue_dkk`: **700**
- `effective_from`: `2026-01-01`
- `is_active: true`

Resultat: salg på de 20 varme kampagner matcher reglen (260/700). Alle øvrige (kolde) falder tilbage til produkt-basis (350/700) — samme mønster som "Fri tale + 110".

### 4. Reparér eksisterende salg
De 12 sale_items i maj som står med `needs_mapping = true` og 0 kr re-matches:
- Kør `rematch-pricing-rules` edge function for de berørte sales, eller
- Direkte UPDATE: sæt `product_id`, `mapped_commission`, `mapped_revenue`, `needs_mapping = false` baseret på sale.dialer_campaign_id mod de 20 ekskluderede campaign_mappings (warm = 260/700, ellers 350/700).

Jeg foreslår edge function-vejen — det er den officielle pricing-motor (rød zone-konsistens, princip 8: én sandhed).

### Tekniske noter
- `dd1bb992-...` campaign mapping-listen kopieres ord-for-ord fra 110-regel `3e7647ad-33bb-4539-bde5-09456e6acdfb` for at sikre identisk warm/cold-opdeling.
- Ingen kodeændringer. Alt sker via data (insert tool + edge function).
- Berører `product_pricing_rules` + `sale_items` (rød zone — pricing). Bekræft inden jeg kører.

### Bekræft venligst
1. Produktnavn `Fri tale + 100` (uden " GB data (5G)..." — matcher 110-mønstret)? Eller fuldt navn?
2. OK at køre `rematch-pricing-rules` på de 12 berørte salg bagefter?