

## Problem: Manglende prismatch på "Fri tale + 20 GB data"

### Årsag
Sale item `3ea55971` har `mapped_commission = 0` og `mapped_revenue = 0` fordi `matched_pricing_rule_id` er NULL — prisreglerne blev aldrig applied på dette salg.

Produktet er korrekt resolved (`product_id = f18da6d2`, `needs_mapping = false`), og der **findes** en aktiv prisregel (priority 1, ID `29323acd`) der dækker præcis dette produkt OG denne kampagne-mapping (`d811a2a8`), med commission 190 kr og revenue 550 kr.

Sandsynlig forklaring: Salget blev synkroniseret efter seneste automatiske rematch, og der er ikke kørt en ny rematch siden.

### Løsning

1. **Kør rematch-pricing-rules** for dette specifikke salg (sale ID `1052eb21-a094-4147-a583-6e77a48eff86`) for at matche prisreglen og udfylde commission/revenue.

2. **Verificér** at `mapped_commission` og `mapped_revenue` opdateres korrekt (forventet: 190 kr / 550 kr baseret på priority 1 reglen).

Ingen kodeændringer nødvendige — dette er udelukkende en data-operation via den eksisterende rematch edge function.

