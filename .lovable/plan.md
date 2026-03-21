

# Fix: Kreditnotaer (positive beløb) skal modregnes i faktureret omsætning

## Problem
Linje 281 i `EconomicRevenueMatch.tsx` bruger `Math.abs(p.beloeb_dkk)` til at summere faktureret omsætning. Det betyder at kreditnota 960 (+135.625 DKK) tælles som positiv omsætning i stedet for at blive trukket fra.

**Faktura 956**: -135.625 → `abs` = 135.625 (korrekt)
**Faktura 960**: +135.625 → `abs` = 135.625 (FORKERT — det er en kreditnota, skal trækkes fra)
**Faktura 961**: -131.600 → `abs` = 131.600 (korrekt)

**Nu**: 135.625 + 135.625 + 131.600 = **402.850**
**Korrekt**: 135.625 - 135.625 + 131.600 = **131.600**

## Løsning
Omsætningsposteringer på konto 1010 er negative (kredit = indtægt). Kreditnotaer er positive. Så den korrekte beregning er at bruge `-p.beloeb_dkk` (vend fortegn) i stedet for `Math.abs()`. Det giver:
- Normal faktura (-135.625) → +135.625
- Kreditnota (+135.625) → -135.625

## Ændring

| Fil | Linje | Hvad |
|-----|-------|------|
| `src/pages/economic/EconomicRevenueMatch.tsx` | 281 | Erstat `Math.abs(p.beloeb_dkk)` med `-p.beloeb_dkk` (eller `p.beloeb_dkk * -1`) |

Same fix skal også tjekkes i umappede-beregningen (linje ~640) og match-preview (linje ~247) hvor `Math.abs` bruges.

## Resultat
- Business DK februar: **131.600 kr** (korrekt)
- Kreditnotaer modregnes automatisk overalt

