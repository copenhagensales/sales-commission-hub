

## Fix: Tilføj Inboxgame-kampagne til prisregel og rematch

### Årsag
- **Dashboard**: Beregner priser live fra `product_pricing_rules` → viser korrekt
- **Dagsrapporter**: Læser `sale_items.mapped_commission` / `mapped_revenue` direkte → viser 0 kr fordi rematchen ikke har applied reglen

### Trin

1. **Opdater prisreglen** i `product_pricing_rules`: Tilføj kampagne-mapping `60da0076-85a5-4bf3-94d7-3f29fdbb1cde` (Inboxgame - Konkurrence leads) til `campaign_mapping_ids` arrayet for reglen med `product_id = f18da6d2` og priority 1 (regel ID `29323acd`).

2. **Kør rematch** på Thomas' salg (`d4b6e5c9-d4b3-423f-a499-d67a89821426`) for at opdatere `sale_items` med korrekte værdier (forventet: 190 kr commission, 550 kr revenue).

3. **Verificér** at `sale_items` nu har korrekte `mapped_commission` og `mapped_revenue`.

### Teknisk detalje
- Én SQL UPDATE (append til `campaign_mapping_ids` array via insert-tool)
- Ét kald til `rematch-pricing-rules` edge function
- Ingen kodeændringer — dagsrapporter og dashboard vil begge vise korrekte tal efter rematch

