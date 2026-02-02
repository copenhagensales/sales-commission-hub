# Plan: Flyt ASE Produktlogik fra Kode til Database-Regler

## Status: ✅ IMPLEMENTERET

### Gennemførte Ændringer

#### 1. Database: ASE conditionalRules ✅
Opdateret `dialer_integrations.config` for ASE med:
- A-kasse salg + A-kasse type → `akasse - {{A-kasse type}}`
- Forening = "Fagforening med lønsikring" → `Fagforening med lønsikring`
- Lønsikring ikke-tom → `{{Lønsikring}}`

#### 2. Database: Nye Produkter ✅
Oprettet:
- `akasse - Selvstændig` (350 kr / 800 kr, counts_as_sale=true)
- `Lønsikring Udvidet` (0 kr / 0 kr, counts_as_sale=false)
- `Lønsikring Super` (0 kr / 0 kr, counts_as_sale=false)

#### 3. PricingRuleEditor: ASE Betingelser ✅
Tilføjet til `CONDITION_OPTIONS`:
- `A-kasse type`: Lønmodtager, Ung under uddannelse, Selvstændig
- `A-kasse salg`: Ja, Nej
- `Forening`: Fagforening med lønsikring, Ase Lønmodtager
- `Lønsikring`: Lønsikring Udvidet, Lønsikring Super

#### 4. Integration Engine: Enreach Data Support ✅
`matchPricingRule()` i `sales.ts` understøtter nu:
- Adversus: `rawPayload.leadResultData[]`
- Enreach: `rawPayload.data{}`

## Næste Skridt

1. **Genkør integration-engine** for ASE kampagner for at genberegne produkter og prissætning
2. **Opret prissætningsregler** via UI for specifikke kombinationer (f.eks. Straksbetaling-tillæg)

