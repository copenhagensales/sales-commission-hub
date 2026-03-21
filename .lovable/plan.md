

# Fix: Faktura-matching er for streng + manglende synlighed

## Problem
1. **Matching-logikken er for streng**: Pattern `eesy Coop` matcher IKKE `EESY: Pop-up Coop` fordi det er ren substring-match, og "eesy coop" ikke er en sammenhængende delstreng af "eesy: pop-up coop".
2. **ASE**: Der er faktisk ingen ASE-posteringer i februar 2026 — kun i 2025. Så 0 kr er korrekt dér.
3. **Brugeren kan ikke se hvad der mangler mapping**: "Kun umappede"-filteret virker, men det er ikke tydeligt nok.

## Løsning

### 1. Smartere matching — "alle ord skal matche" i stedet for substring
Ændr `matchPostering()` fra ren `includes()` til en "alle ord i pattern skal forekomme i teksten"-logik:
```
"eesy Coop" → ["eesy", "coop"]
"EESY: Pop-up Coop" → indeholder begge ord → MATCH ✓
```
Dette løser de fleste fejl-matches uden at kræve nye mappings.

### 2. Vis umappede tydeligeligt i Afvigelsesrapporten
- Tilføj en **"Umappede posteringer"**-sektion øverst i afvigelsesrapporten med:
  - Antal umappede / total
  - Samlet beløb der ikke er mappet
  - Liste over unikke tekster der mangler mapping
- Gør det klart hvad der falder udenfor

### 3. Bedre mapping-forslag
- Når brugeren ser en umappet postering, foreslå automatisk det mest sandsynlige pattern baseret på tekst-præfiks (før `:`)
- Vis en advarsel hvis et eksisterende pattern ikke matcher noget

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/economic/EconomicRevenueMatch.tsx` | Ny matching-logik (ord-baseret), umappede-sektion i afvigelsesrapport, bedre forslag |

## Resultat
- `eesy Coop` vil nu matche `EESY: Pop-up Coop` ✓
- `Eesy marked` vil nu matche `EESY: Pop-up marked` ✓  
- Brugeren kan tydeligt se hvad der stadig mangler mapping

