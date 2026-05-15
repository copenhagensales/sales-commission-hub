## Mål
Flyt 34 Eesy-salg fra "Eesy gaden" til "Eesy marked" og kør rematch, så commission falder fra 360/450 → 295/385.

## Scope
Kun salg i lønperioden 15. apr – 14. maj 2026 hvor:
- Produkt = "Eesy uden første måned (Nuuday)" eller "(IKKE Nuuday)"
- `mapped_commission` = 360 eller 450
- Sælger var booket samme dag på et marked-location under campaign `0835d092` (Eesy marked)

## Berørte sælgere
fasc (11), oscj (7), jmek (6), jubj (4), thes (4), kond (2) — i alt 34 salg, ~2.210 kr overbetaling.

## Trin
1. **UPDATE** `sales.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'` for de 34 salg som matcher kriterierne (gade-takst + booket på marked).
2. **Kør rematch** via `rematch-pricing-rules` edge function for de 34 sale_ids → `mapped_commission` opdateres til 295/385.
3. **Verificér** at alle 34 nu står med 295 eller 385.
4. **Rapportér** ny overbetaling per sælger (forventet: 0 kr).

## Ikke i scope (separat opgave)
- Hvorfor allerede-marked-salg fik 360/450 (pricing-regel matcher ikke som forventet — undersøges i trin 2 fra forrige besked).
- Eventuel manuel lønjustering — sker automatisk ved næste sync når `mapped_commission` er korrekt.

## Risici
- Rød zone (pricing/løn). Ramme-aftale: brugeren har eksplicit bedt om at køre trin 1.
- Salgene rører `sale_items.mapped_commission` (rød zone tabel) — men dette er præcis det rematch-funktionen er bygget til.