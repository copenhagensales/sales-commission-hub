

# Fix: Forkert kolonne-mapping i TDC config

## Problem
Den gemte TDC Erhverv config har **byttet om på kolonnerne**:
- `commission_column = 'CPO Total'` — men CPO Total matcher faktisk **system revenue** (158 ud af 252 OPP'er matcher `mapped_revenue`)
- `revenue_column = 'TT'` — men TT er kundens totale månedlige forbrug, ikke vores omsætning

Det betyder at `computeDiff` sammenligner forkerte tal og finder "forskelle" der ikke eksisterer.

## Løsning

### 1. Ret TDC config i databasen
- Sæt `revenue_column = 'CPO Total'` (det matcher `mapped_revenue` = vores provision/omsætning)
- Sæt `commission_column = NULL` (TT er ikke vores systemdata — skal ikke sammenlignes)

Alternativt: Hvis "CPO Total" reelt er provision og systemet bare har 2x-forholdet (commission * 2 = revenue), så kan vi sætte `commission_column = 'CPO Total'` og sammenligne mod `mapped_commission` — men dataen viser entydigt at CPO Total = mapped_revenue.

### 2. Ingen kodeændringer
`computeDiff` fungerer korrekt — det er kun config-dataen der er forkert.

| Ændring | Detalje |
|---------|---------|
| Migration | Opdater TDC config: `revenue_column = 'CPO Total'`, `commission_column = NULL` |

Dette alene vil reducere falske forskelle markant (fra 226 til de reelle afvigelser).

