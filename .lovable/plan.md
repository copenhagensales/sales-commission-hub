

# Stram linjeafstand i kontraktskabeloner

## Problem
Hvert linjeskift i editoren opretter et nyt `<p>`-tag. Prose-reglerne giver hvert afsnit `my-2` (8px margin top+bottom) plus `[&_p+p]:mt-2` oveni. Det giver synlige "huller" mellem linjer der hører sammen (fx adresseblokke), og ser uprofessionelt ud på underskriftssiden.

## Løsning
Stram paragraph-spacing i `contractProseStyles.ts` så kontrakten ligner et rigtigt juridisk dokument:

### `src/utils/contractProseStyles.ts`
- `prose-p:my-2` → `prose-p:my-0.5` — minimale margins mellem afsnit
- `[&_p+p]:mt-2` → `[&_p+p]:mt-1` — tættere konsekutive afsnit
- `[&_p:empty]:min-h-[1em]` beholdes — tomme linjer fungerer stadig som bevidste mellemrum
- `leading-[1.7]` → `leading-[1.6]` — lidt strammere linjeafstand i brødtekst

Disse ændringer slår igennem i editor, admin-preview OG underskriftsside, da alle tre bruger den samme `BASE_PROSE`.

