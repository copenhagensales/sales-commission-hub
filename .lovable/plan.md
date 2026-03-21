

# Fix: Enrichment-healer bruger forkerte credentials (403 Forbidden)

## Problem
Enrichment-healeren henter credentials fra den **første** aktive integration for en given provider (f.eks. "adversus"). Det betyder at alle Adversus-salg heales med Lovablecph's API-nøgle — også Relatel-salg. Og alle Enreach-salg heales med én tilfældig Enreach-integrations credentials. Det giver **HTTP 403 Forbidden** fordi API-nøglerne ikke har adgang på tværs af konti.

**Berørte salg:** 100 salg med 403-fejl (76 Lovablecph, 23 Eesy, 10 ASE, 1 Relatel).

## Løsning
Ændre enrichment-healer til at gruppere salg efter `source` (= integrationsnavn) i stedet for `integration_type` (= provider), og hente credentials for den korrekte integration.

### Ændringer i `supabase/functions/enrichment-healer/index.ts`

1. **Ny funktion `getCredentialsByName`** — erstatter `getProviderCredentials`. Slår op i `dialer_integrations` via `name` i stedet for `provider`, så den altid finder den rigtige konto.

2. **Gruppér salg efter `source`** i stedet for `integration_type`:
   - Nuværende: `adversusSales = filter(integration_type === "adversus")` → én credential-lookup
   - Nyt: Gruppér efter `source` (f.eks. "Lovablecph", "Relatel_CPHSALES", "Eesy", "ase", "tryg") → én credential-lookup per source

3. **Dispatch til rette heal-funktion** baseret på `integration_type` fra den matchede integration (adversus → `healAdversus`, enreach → `healEnreach`).

4. **Reset enrichment_attempts** for de 100 fejlede salg via en SQL migration, så de bliver hentet op igen med de korrekte credentials.

### SQL data-fix
```sql
UPDATE sales 
SET enrichment_status = 'pending', 
    enrichment_attempts = 0, 
    enrichment_error = NULL 
WHERE enrichment_error = 'HTTP 403: Forbidden';
```

### Resultat
- Hver integration bruger sine egne credentials til lead-opslag
- De 100 fejlede salg bliver re-queued og healet korrekt
- Fremtidige salg heales med korrekt konto fra start

| Fil | Ændring |
|-----|---------|
| `supabase/functions/enrichment-healer/index.ts` | Gruppér efter `source`, hent credentials per integration-navn |
| SQL migration | Reset 100 fejlede 403-salg til `pending` |

