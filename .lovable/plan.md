
## Baggrund

**Kilden** (Eesy TM portal, projekt `607bef78`) har kun én tabel: `hiper_leaderboard_entries` med aggregerede tal pr. sælger — `name`, `viderestillinger` (antal), `lukninger` (antal), `provision` (total kr.), `rank`. Ingen dato pr. salg, intet trin pr. salg (kun total-provision). Payout-satserne er hardkodet i kildens kode: trin 0 = 400/200 kr, trin 1 = 375/175, trin 2 = 350/150.

**Stork** har ingen Hiper-klient, kampagne eller produkter i dag. 17 aktive Eesy TM-sælgere er identificeret.

**Periode** (lønperiode 15/6 → 14/7 2026): kildens tabel indeholder præcis denne periode, fordi kilden filtrerer på pay period før upload og genskaber tabellen ved hver upload.

---

## Rød zone-varsel

Denne import indsætter rækker i `sales` og skaber `sale_items` med `mapped_commission > 0`. Det påvirker **løn** direkte (Eesy TM-sælgernes provision for juli-perioden). Jeg indsætter **intet** før du godkender både (a) schema-migrationen og (b) den konkrete navne-mapping.

---

## Faser (rækkefølge, hver med separat godkendelse)

### Fase 1 — Schema i Stork (migration, kræver din godkendelse)

Opret:
- `clients`-række: **Hiper** (client_type = ekstern, brand-farve TBD)
- `client_campaigns`-række: **Hiper Bredbånd** under Hiper
- 2 `products`:
  - **Hiper Viderestilling** (default provision 400 kr)
  - **Hiper Lukning** (default provision 200 kr)
- 2 `product_pricing_rules` med `priority = 100`, faste priser 400/200 (så evt. senere `rematch-pricing-rules` ikke overskriver til 0)
- Tildeling af Hiper-klient til Eesy TM's team via `team_clients` — så salget vises hos det rette team

Ingen ændring i eksisterende tabeller. Ingen adversus_campaign_mappings (data kommer ikke fra dialer).

### Fase 2 — Fremskaffelse af kilde-data (kræver dig)

RLS på `hiper_leaderboard_entries` tillader kun `authenticated` (ikke anon), og jeg har ikke direkte DB-adgang til kilde-projektet. Du skal enten:

- (a) Køre denne query i kilde-projektets SQL editor og paste resultatet i chatten:
  ```sql
  SELECT name, viderestillinger, lukninger, provision, rank
  FROM hiper_leaderboard_entries
  ORDER BY rank;
  ```
- (b) Eller eksportere som CSV og uploade

### Fase 3 — Navne-mapping preview (kræver din godkendelse)

Jeg genbruger kildens egen normalisering (lowercase, fjern accenter, first+last-token match) og matcher hvert kilde-navn mod Stork's 17 aktive Eesy TM-sælgere. Du får en tabel som:

```text
Kilde-navn              Match i Stork                   Sikkerhed
──────────────────────  ──────────────────────────────  ─────────
Julius                  Julius Rødsø Langkilde          entydig fornavn
Casper Andersen         Casper Haaber Løje Andersen     first+last
Lucas P                 IKKE ENTYDIG (2 Lucas'er)       ⚠ afklares
Ukendt Navn             IKKE FUNDET                     ⚠ afklares
```

Ingen indsats sker før du bekræfter mappingen række for række. Uafklarede navne springes over (ikke gætte).

### Fase 4 — Data-indsats (via supabase--insert, én transaktion)

Pr. bekræftet sælger genereres:
- `viderestillinger` stk. sales-rækker med:
  - `agent_email` = sælgerens `work_email`
  - `client_campaign_id` = Hiper Bredbånd
  - `sale_datetime` = **2026-07-14 23:59** (sidste dag i perioden, samme timestamp for alle — ærligt: vi har ikke bedre dato)
  - `source` = `'manual_import'`, `integration_type` = `'manual_hiper'`
  - `validation_status` = `'validated'`, `status` = `'success'`
  - `internal_reference` = `hiper-2026-07-{employee_id}-forwarder-{i}` (idempotens-nøgle — genindsats duplikerer ikke)
  - `raw_payload` = `{source:"hiper_portal_import", period:"2026-06-15..2026-07-14", role:"forwarder", trin_assumption:0}`
- Tilsvarende `lukninger` stk. sales-rækker med rolle `closer`
- Én `sale_items`-række pr. sale med `mapped_commission` = 400 (forwarder) / 200 (closer), `product_id` = det rette produkt

### Fase 5 — Verifikation

Efter indsats kører jeg:
- Total antal sales pr. sælger vs. kildens `viderestillinger + lukninger` (skal matche)
- Total commission pr. sælger vs. kildens `provision`-felt (kan afvige hvis trin ≠ 0 i den originale Excel; jeg rapporterer differencen pr. sælger så du kan beslutte om vi skal justere)
- Bekræftelse af at Eesy TM's team ejer Hiper via `team_clients`

### Fase 6 — Rollback-nøgle

Alle indsatte rækker har `source = 'manual_import' AND integration_type = 'manual_hiper'`. Én DELETE-query kan rense hele importen hvis noget går galt. Query dokumenteres i chatten efter indsats.

---

## Antagelser jeg gør (ret mig hvis noget er galt)

1. **Trin 0 antages** for hele importen (400/200 kr sats). Kildens aggregerede DB har mistet trin-info, så det kan ikke rekonstrueres eksakt. Difference mellem beregnet total og kildens `provision`-felt viser hvor meget trin har afveget — rapporteres i Fase 5.
2. **Sale_datetime = periode-slut (2026-07-14 23:59)** for alle rækker. Ugents-/dags-rapportering vil vise hele Hiper-produktionen på én dag. Alternativ: spred kunstigt over perioden, men det er en løgn. Jeg foretrækker den ærlige version.
3. **Sælger uden `work_email`** (fx Carl Filt Beyer, Lucas Baz Uttrup i den nuværende liste) kan ikke få attribution. De springes over medmindre du udpeger en email.
4. **Ingen kobling til `commission_transactions`.** Sale_items med mapped_commission er nok til at Stork's løn-hooks ser provision. `commission_transactions` skabes normalt af `rematch-pricing-rules` — vi indsætter direkte for at undgå at motoren nulstiller vores hardkodede satser.

---

## Teknisk noter (til dig, ikke slutbruger)

- Migrations- og insert-tools bruges i to separate kald (schema først, data efter godkendt mapping)
- Ingen ændring i `product_pricing_rules`-motoren, `pricing-service`, `rematch-pricing-rules` eller andre rød-zone kode-filer
- `sales.raw_payload` bruges til at markere importen så vi kan filtrere/slette den igen
- `internal_reference`-mønsteret er idempotent (unique constraint findes)
- Ingen ændring i frontend — Hiper vil dukke op automatisk i dashboards der grupperer på `client_id` (fx TV-board, CS Top 20, sælger-lønside)

---

**Godkender du planen, eller vil du justere noget først (fx sale_datetime-strategi, trin-antagelse, produkt-navne)?**
