
# Plan: Ret prisregel-matching for korrekt provisionsberegning

## Problemanalyse

Alexander Godsk Callesens 50 salg fordeler sig således:

| Salgskombination | Antal | Nuværende provision | Korrekt provision | Difference |
|------------------|------:|--------------------:|------------------:|----------:|
| Lønsikring + Dækningssum 6000 + Straks | 25 | 25.000 kr (1.000/stk) | **35.000 kr** (1.400/stk) | +10.000 kr |
| Ase Lønmodtager (INGEN lønsikring) + Straks | 9 | 9.000 kr | 9.000 kr | ✅ Korrekt |
| Lønsikring + Dækningssum 6000 + Standard | 7+1 | 3.200 kr (400/stk) | **6.400 kr** (800/stk) | +3.200 kr |
| Ase Lønmodtager (INGEN lønsikring) + Standard | 3+1 | 1.600 kr | 1.600 kr | ✅ Korrekt |
| Ung under uddannelse + Ase Lønmodtager | 2 | 600 kr (300/stk) | **1.200 kr** (600/stk) | +600 kr |
| Ukendt forening + Straks | 1 | 1.000 kr | 1.000 kr | 0 |

**Samlet difference: +13.800 kr**
- Nuværende total: 41.400 kr
- Korrekt total: **55.200 kr**
- Med feriepenge (12,5%): **62.100 kr**

## Årsag til fejlen

1. **Alle prisregler har prioritet 0** - Den generelle "A-kasse uden straksbetaling" regel (400/1.000 kr) matcher før de specifikke lønsikring-regler
2. **"Ung med FF" reglen matcher forkert** - Den kræver "Forening = Ase Lønmodtager" men burde matche alle Ung-salg med 600 kr

## Vigtig observation

Salg med **"Forening = Ase Lønmodtager"** (uden lønsikring) skal IKKE beriges med Dækningssum. Disse salg matcher korrekt den generelle 400/1.000 kr regel, da de ikke har lønsikring.

Kun salg med **"Forening = Fagforening med lønsikring"** har lønsikring og skal matche de højere regler.

---

## Teknisk løsning

### Trin 1: Opdater prisregel-prioriteter

```text
┌────────────────────────────────────────────────────┬──────────┬────────────────────┐
│ Regel                                              │ Prioritet│ Provision          │
├────────────────────────────────────────────────────┼──────────┼────────────────────┤
│ A-kasse over 6000 lønsikring (Dækningssum >= 6000) │    10    │ 800 / 1.400 straks │
│ A-kasse under 6000 lønsikring (Dækningssum <= 5999)│    10    │ 600 / 1.200 straks │
│ Ung Under Uddannelse med FF                        │    10    │ 600 kr             │
│ Ung Under Uddannelse uden FF                       │     5    │ 300 kr             │
│ A-kasse uden straksbetaling (generel fallback)     │     1    │ 400 / 1.000 straks │
└────────────────────────────────────────────────────┴──────────┴────────────────────┘
```

### Trin 2: Ret "Ung med FF" reglen

Den nuværende betingelse `Forening = Ase Lønmodtager` giver ikke mening for "med FF". 

Enten:
- Fjern Forening-betingelsen helt fra "Ung med FF" (så alle Ung-salg får 600 kr)
- Eller ret til korrekt Forening hvis der er forskel

### Trin 3: Berig data KUN for lønsikring-salg

I `integration-engine` og `rematch-pricing-rules`:

```typescript
// Berig IKKUN salg med lønsikring
if (rawPayloadData) {
  const forening = rawPayloadData['Forening'] as string | undefined;
  const dækningssum = rawPayloadData['Dækningssum'] as string | undefined;
  
  // KUN berig hvis Forening = "Fagforening med lønsikring" og Dækningssum mangler
  if (!dækningssum && forening === 'Fagforening med lønsikring') {
    rawPayloadData['Dækningssum'] = '6000';  // Antag over 6000 for lønsikring
    log("INFO", `Enriched Dækningssum=6000 for lønsikring sale`);
  }
  // INGEN ændring for "Ase Lønmodtager" - de skal matche generel regel
}
```

### Trin 4: Kør rematch

Trigger `rematch-pricing-rules` for at genberegne alle sale_items i lønperioden.

---

## Filer der skal ændres

1. **Database migration** - Opdater prioriteter på 5 prisregler
2. **Database migration** - Ret "Ung med FF" reglen (fjern/ret Forening-betingelse)
3. `supabase/functions/integration-engine/core/sales.ts` - Berigelse af Dækningssum KUN for lønsikring
4. `supabase/functions/rematch-pricing-rules/index.ts` - Samme berigelseslogik

---

## Forventet resultat

For Alexander Godsk Callesen (15/1 - 14/2 2026):

| Type | Antal | Efter rettelse |
|------|------:|---------------:|
| Lønsikring straks (1.400 kr) | 25 | 35.000 kr |
| Lønsikring standard (800 kr) | 8 | 6.400 kr |
| Ase Lønmodtager straks (1.000 kr) | 10 | 10.000 kr |
| Ase Lønmodtager standard (400 kr) | 4 | 1.600 kr |
| Ung med FF (600 kr) | 2 | 1.200 kr |
| Ukendt (1.000 kr) | 1 | 1.000 kr |
| **Total provision** | 50 | **55.200 kr** |
| **+ Feriepenge (12,5%)** | | 6.900 kr |
| **Total udbetaling** | | **62.100 kr** |

**Provisionsstigning: +13.800 kr (+33%)**
