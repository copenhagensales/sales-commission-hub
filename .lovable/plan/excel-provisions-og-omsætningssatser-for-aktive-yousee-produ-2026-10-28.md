# Excel: provisions- og omsætningssatser for aktive YouSee-produkter

Kun læsning af databasen — ingen ændringer i app, data eller regler. Filen gemmes i Filer.

## Indhold
- **Ark 1 – Produkter:** aktive YouSee-produkter (aktiv, ikke skjult, ikke flettet ind i andet produkt): kampagne, produktnavn, visningsnavn, basis-provision (kr) og basis-omsætning (kr).
- **Ark 2 – Prisregler:** aktive prisregler på de samme produkter, kun dem der gælder i dag (start-/slutdato): produkt, regelnavn, prioritet, betingelser i læsbar form, provision, omsætning og evt. satser ved straksbetaling.
- Ingen persondata eller salgstal — kun satser.

## Teknisk
- Kilde: `products` via `client_campaigns` → klient »Yousee«; `product_pricing_rules` med `is_active` og gyldig `effective_from/effective_to`.
- Excel bygges med faste tal (ingen formler nødvendige), kr-format, frosne overskrifter, autofilter.
- Fil: `/mnt/documents/yousee_satser_2026-10-28.xlsx`.
