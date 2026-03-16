

## Fix: Manglende salg for Christoffer Forman (sale 95f5d774)

### Problem
Salg `95f5d774` har `client_campaign_id = NULL`. Tavlen (klient-scoped leaderboard) tæller kun salg med korrekt klient-attribution → viser 8 i stedet for 9. Dagsrapporter tæller via agent_email → viser 9.

### Plan

**1. Data-fix: Sæt client_campaign_id på det manglende salg**

```sql
UPDATE sales 
SET client_campaign_id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba'
WHERE id = '95f5d774-7257-4b4a-b87a-e12e759fb865'
  AND client_campaign_id IS NULL;
```

**2. Root cause fix: Undersøg hvorfor enrichment-triggeren fejlede**

Salget har `dialer_campaign_id = NULL` og `source = 'Eesy'`. Enrichment-triggeren slår op via `dialer_campaign_id` → `adversus_campaign_mappings` → `client_campaign_id`. Når `dialer_campaign_id` er NULL, sker der ingen mapping.

Mulig løsning: Tilføj fallback-logik i webhook/enrichment der mapper baseret på agent + source når dialer_campaign_id mangler. Dette kræver yderligere undersøgelse af ingestion-koden for at finde det rigtige sted at tilføje fallbacken.

### Effekt
- Salg 95f5d774 vil tælle på Eesy-tavlen efter data-fix
- KPI-cachen opdateres automatisk ved næste beregningscyklus (~1 min)

