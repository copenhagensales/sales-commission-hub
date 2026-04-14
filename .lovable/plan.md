

## Problem

Begge password-reset edge functions hardcoder reset-linket til:
```
https://40ce8d9b-c988-4d3b-a8ed-63eb5bed2204.lovableproject.com/reset-password?token=...
```

Brugerne tilgår appen via `stork.copenhagensales.dk`, så linket virker ikke / ser ukendt ud.

Selve `/reset-password`-siden og hele flowet (validate → set password → login) er allerede implementeret og korrekt.

## Løsning

Ret URL'en i begge edge functions:

| Fil | Linje | Ændring |
|-----|-------|---------|
| `supabase/functions/initiate-password-reset/index.ts` | 187 | Ret til `"https://stork.copenhagensales.dk"` |
| `supabase/functions/send-password-reset/index.ts` | 156 | Ret til `"https://stork.copenhagensales.dk"` |

To linjer ændres — derefter deployes begge functions. Herefter virker hele flowet: bruger modtager email → klikker link → lander på `/reset-password` → sætter nyt password → kan logge ind.

