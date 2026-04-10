

## Fjern Inboxgame fra prisregel og rematch berørte salg

### Status
Regel `29323acd` har aktuelt 8 kampagner i `campaign_mapping_ids` (inkl. Inboxgame `60da0076`). Den sætter 190 kr commission. Basisproduktet har 250 kr commission / 550 kr revenue.

3 berørte salg fundet:
- `7b0a7db8-ed65-4903-a98d-085baef71352`
- `bebae7c0-7274-4254-8f95-06c2bc2e4064`
- `d4b6e5c9-d4b3-423f-a499-d67a89821426`

### Trin

1. **Opdater regel via migration** — Fjern `60da0076-85a5-4bf3-94d7-3f29fdbb1cde` fra `campaign_mapping_ids` arrayet på regel `29323acd`. De resterende 7 kampagner beholder 190 kr.

```sql
UPDATE product_pricing_rules
SET campaign_mapping_ids = array_remove(campaign_mapping_ids, '60da0076-85a5-4bf3-94d7-3f29fdbb1cde'::uuid)
WHERE id = '29323acd-21c1-4d43-93cf-8e8e9c6245f5';
```

2. **Kør rematch** på de 3 berørte salg via `rematch-pricing-rules` edge function med `sale_ids` for at opdatere `mapped_commission` til 250 kr (basisproduktets pris).

3. **Verificér** at `sale_items` nu viser 250 kr commission og 550 kr revenue for de berørte salg.

### Teknisk detalje
- Ingen kodeændringer
- Én database-migration (UPDATE på eksisterende data)
- Ét kald til rematch edge function

