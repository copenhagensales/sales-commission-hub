

# Plan: Indsæt data fra dokumenter i databasen

## Hvad dokumenterne indeholder

### Kemi-APV (Kemisk_Arbejdspladsvurdering)
3 produkter nævnt:
1. **Rengøringsmidler** (overfladerensere, opvaskemiddel, sanitetsrens) — ufarlige
2. **Håndsprit** (alkoholbaseret desinfektion) — ufarligt
3. **Sæbe og hudplejeprodukter** — ufarlige

Alle vurderet som **ufarlige/minimal risiko**. Udarbejdet 14/2-25 af Kasper Mikkelsen, William Hoe & Johannes Hedebrink. Ansvarlig: Johannes Hedebrink.

### APV (Arbejdspladsvurdering)
Opdateret 20/3-25. Indeholder 4 identificerede problemer med handlingsplan:
1. Højt støjniveau — Lav risiko
2. Sikring af pauser — Mellem risiko
3. Psykisk arbejdsmiljø: trivsel — Lav risiko
4. Brandsikkerhed i nyt lejemål — Mellem risiko

## Hvad der allerede eksisterer
- `amo_kemi_apv`-tabellen er oprettet og UI'et fungerer (brugeren er på `/amo/kemi-apv` nu)
- `amo_apv`-tabellen eksisterer med felter for findings, risk_level, action_plan osv.

## Plan

### 1. Indsæt 3 Kemi-APV produkter via script
Kør en SQL-insert med de 3 produkter fra dokumentet:

| product_name | supplier | product_type | hazard_flag | storage_notes | work_process | exposure_risk | protective_measures | instructions | responsible_owner | review_date | next_review_due |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Rengøringsmidler (overfladerensere, opvaskemiddel, sanitetsrens) | — | Rengøringsmiddel | false | Opbevares i originale beholdere med tydelig mærkning, utilgængeligt for uvedkommende | Rengøring af kontor og faciliteter | Minimal risiko, hverdagsprodukter i begrænsede mængder | Brug iht. producentens anvisninger. Skift til mildere alternativ ved irritation | Anvendes i overensstemmelse med producentens anvisninger | Johannes Hedebrink | 2025-02-14 | 2026-02-14 |
| Håndsprit (alkoholbaseret desinfektion) | — | Desinfektion | false | (samme opbevaring) | Personlig hygiejne | Minimal | (samme) | (samme) | Johannes Hedebrink | 2025-02-14 | 2026-02-14 |
| Sæbe og hudplejeprodukter | — | Hygiejne | false | (samme) | Personlig hygiejne | Minimal | (samme) | (samme) | Johannes Hedebrink | 2025-02-14 | 2026-02-14 |

### 2. Indsæt APV-data via script
Opret 1 APV-post med den samlede vurdering fra dokumentet, med alle 4 problemer samlet i `findings` og `action_plan` felterne.

### 3. Metode
Brug `psql` til at indsætte dataene direkte i databasen. Derefter vil de vises i UI'et automatisk.

