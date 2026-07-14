# Relatel Produkt-oversigt (Excel-artefakt)

## Mål
Enkeltstående Excel-fil leveret via `/mnt/documents/`. Ingen kodeændringer i projektet.

## Indhold (én fane: "Relatel produkter")

Kolonner:
1. **Produkt** – `products.name`
2. **Kampagne** – `client_campaigns.name`
3. **Aktiv** – `products.is_active`
4. **Base provision (kr)** – `products.commission_dkk`
5. **Base omsætning (kr)** – `products.revenue_dkk`
6. **Base gældende fra** – `products.updated_at` (senest ændret) / `created_at` som fallback
7. **Regel-navn** – `product_pricing_rules.name` (den regel der matcher "tilskud = 0")
8. **Provision v. tilskud=0 (kr)** – regel-`commission_dkk`
9. **Omsætning v. tilskud=0 (kr)** – regel-`revenue_dkk`
10. **Regel gældende fra** – `product_pricing_rules.effective_from`
11. **Regel gældende til** – `product_pricing_rules.effective_to`
12. **Prioritet** – `product_pricing_rules.priority`

## Logik for "tilskud = 0"-satsen

For hvert Relatel-produkt vælges den aktive prisregel hvor:
- `is_active = true`
- `conditions` matcher subsidy/tilskud = 0 (fx `{"subsidy_percent": 0}` eller ingen subsidy-restriktion — universel regel gælder også)
- Højeste `priority` vinder
- Effektiv på "nu" (`effective_from <= now`, `effective_to null eller >= now`)

Hvis intet regel-match: felterne 7–12 er tomme, og base-satsen (kol. 4–5) er den gældende afregning.

## Formatering
- Header fed, mørk baggrund
- Beløb med `#,##0` (kr)
- Datoer som `dd-mm-yyyy`
- Kolonnebredde auto-justeret
- Sortering: produktnavn A–Å

## Fremgangsmåde
1. Query products + client_campaigns for Relatel
2. Query product_pricing_rules pr. produkt, filtrér på tilskud=0-conditions, vælg højest priority
3. Byg xlsx med `openpyxl`/`ExcelJS` via Python-skript
4. Skriv til `/mnt/documents/relatel-produkter.xlsx`
5. Åbn og verificér indhold visuelt før levering

## Åbne spørgsmål inden bygning
Ingen — jeg tolker "tilskud = 0-satsen" som den prisregel der gælder når `subsidy_percent = 0` (eller universel regel uden subsidy-krav). Sig til hvis du vil have flere satser med (fx 10%, 20% tilskud-varianter) eller kun MBB/Fri Tale-produkter i stedet for alle.
