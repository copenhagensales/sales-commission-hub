

## Plan: Remap Pricebook DNB og Venta General til konsolideret Eesy-produkt

### Problem
Salg fra kampagnerne Pricebook DNB og Venta General mapper til selvstændige produkter med 0 kr provision, selvom de reelt sælger Eesy-mobilabonnementer (Fri tale + 70 GB, 100 GB osv.).

### Løsning
Følg den eksisterende Eesy TM-konsolideringsstrategi: map til det fælles 5G-produkt `bd58176b` ("Fri tale + fri data (5G) (6 mdr. binding) 109 kr"), som alle andre 5G-varianter allerede peger på. Derefter rematch for korrekt provision.

### Trin

1. **Opdater adversus_product_mappings** — sæt `product_id = bd58176b` for "Pricebook DNB" og "Venta General" så fremtidige salg mappes korrekt.

2. **Opdater sale_items** — ændr `product_id` på eksisterende sale_items fra de to 0 kr-produkter til `bd58176b`.

3. **Rematch prisregler** — kald `rematch-pricing-rules` for de berørte salg, så de får de kampagne-specifikke Eesy TM-priser (250-375 kr provision).

### Teknisk
- Data-opdateringer via insert-tool (UPDATE statements)
- Ingen kodeændringer
- Følger præcis samme konsolideringsmønster som alle andre Eesy TM 5G-varianter
- ~8 salg påvirkes

