

## Plan: Map kampagne CAMP8324C81 til Eesy TM og backfill umappede salg

### Baggrund
Kampagnen "Pricebook Internet Tjek" (`CAMP8324C81`) eksisterer allerede i `adversus_campaign_mappings` men har `client_campaign_id = NULL`. 59 af 65 salg har allerede korrekt `client_campaign_id` (sat via webhook), men 6 nyere salg mangler den.

### Trin 1: Database-migration
En enkelt SQL-migration der:
1. Sætter `client_campaign_id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba'` (Eesy TM Products) på `adversus_campaign_mappings` for `CAMP8324C81`
2. Backfiller de 6 salg der mangler `client_campaign_id` — opdaterer `sales` hvor `dialer_campaign_id = 'CAMP8324C81' AND client_campaign_id IS NULL`

### Trin 2: Trigger rematch
Kalder `rematch-pricing-rules` edge function for de 6 berørte salg, så `sale_items` får korrekt provision/omsætning baseret på den nu-korrekte kampagne-mapping.

### Resultat
- Fremtidige salg fra denne kampagne bliver automatisk mappet via webhook (ligesom alle andre)
- De 6 historiske salg tæller nu med under Eesy TM i leaderboard
- Ingen hardcoding — det følger det eksisterende mapping-mønster

### Filer der ændres
- **Database:** 1 migration (update campaign mapping + backfill sales)
- **Ingen kodeændringer** — alt bruger eksisterende infrastruktur

