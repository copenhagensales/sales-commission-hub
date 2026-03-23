

# Ret forecast SPH for FM-medarbejdere via `fm_seller_id`

## Problem
FM-medarbejdere (som Sandra Rosenbaum) registrerer salg via `raw_payload->>'fm_seller_id'` (employee UUID), men forecast-beregningen matcher kun salg via `agent_email`. Uden agent mapping → 0 salg → 0 SPH → forkert forecast.

## Ændring

### `src/hooks/useClientForecast.ts`

**1. Tilføj FM-salgsquery (efter linje 186)**
- Efter den eksisterende email-baserede salgsquery, tilføj en ny query der henter FM-salg:
  - Filtrer `source = 'fieldmarketing'` og `client_campaign_id` in campaignIds
  - Hent `raw_payload->fm_seller_id`, `sale_datetime`, `sale_items`
  - For hver sale, map `fm_seller_id` (employee UUID) direkte til medarbejderens ugentlige salgsdata

**2. Opbyg et parallelt `salesByEmployeeByWeek` map**
- Ny `Map<string, Map<number, number>>` der bruger employee ID som nøgle i stedet for email
- FM-salg tælles her baseret på `fm_seller_id`

**3. Brug begge maps i SPH-beregningen (linje 358-382)**
- Når der beregnes `salesInWeek` for en medarbejder:
  - Tæl salg fra email-map (eksisterende logik)
  - **Plus** salg fra employee-ID-map (ny FM-logik)
  - Undgå dobbelt-tælling: FM-salg har typisk ingen `agent_email` match, men tilføj guard

**4. Opdater `missingAgentMapping` flag (linje 423)**
- FM-medarbejdere med salg via `fm_seller_id` skal ikke vises som "mangler opsætning"
- Check om medarbejderen har salg i employee-ID-map'et

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj FM-salgsquery via `fm_seller_id`, merge i SPH-beregning |

