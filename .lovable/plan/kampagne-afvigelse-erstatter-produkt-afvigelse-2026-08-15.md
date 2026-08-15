# Kampagne-afvigelse erstatter produkt-afvigelse

## Regel
Sammenligningen sker mellem det interne Tastselv-produktnavn og PowerBI-kampagnen:

- Produkt indeholder "uden første måned" → kampagnen må IKKE være "1 måneds gratis abonnement". Er den det: afvigelse.
- Kampagnen er en anden end "1 måneds gratis abonnement" → produktet SKAL indeholde "uden første måned". Gør det ikke (fx "med første måned"): afvigelse.
- Produktet "5G Internet": ingen kampagnetjek — række vises ikke som afvigelse.

Afvigelsestypen i kolonnen "Afvigelse" bliver "Kampagne". Den nuværende type "Produkt" fjernes helt, så produktnavne ikke længere sammenlignes mod "Subscription Name".

## Konsekvens i visningen
- "Afvigelser — oversigt" viser fremover kun kampagne-afvigelser. Kolonnerne (Tastselv, PB Kampagne, PB Operator, Kilde, Handlinger) er uændrede.
- "Mangler i PowerBI" er uberørt.
- Rækker hvor produktet hverken indeholder "uden første måned" eller "med første måned" (og ikke er 5G Internet) markeres ikke som afvigelse — der er ingen regel at måle dem på endnu.

## Teknisk
- Kun `src/hooks/useEesyFmDeviations.ts` ændres (gul zone: read-only sammenligning, ingen pricing/løn).
- `sameProduct()` udgår; erstattes af hjælpefunktioner:
  - `isFiveG(product)` — normaliseret match på "5g internet".
  - `firstMonthMode(product)` → `"without" | "with" | null` via normaliseret søgning på "uden første måned"/"med første måned".
  - `isFreeMonthCampaign(campaign)` — normaliseret match mod `1 måneds gratis abonnement`.
- Ved `mode === "deviations"`: for hvert Stork-salg med match i PowerBI-rækkerne evalueres hver matchende række; en række giver afvigelse hvis (`without` og fri-måned-kampagne) eller (kampagne ≠ fri måned og mode ≠ `without`). Er mindst én matchende række konform, betragtes salget som OK (samme "anyEqual"-princip som i dag).
- `deviation`-feltet sættes til `"Kampagne"`.
- Normalisering genbruger den eksisterende accent/case-insensitive `norm`-hjælper, så "første"/"forste" begge rammer.
- Ingen ændringer i `EesyFmDeviations.tsx`, DB eller mapping-fanen.
