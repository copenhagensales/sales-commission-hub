## Mål
Éngangs Excel-fil med oversigt over alle Relatel-omstillingsprodukter, deres aktuelle provision/omsætning + eventuel tilskud=0-regel.

## Scope
- 33 aktive Relatel-produkter under kampagnen "Relatel Products" hvis navn starter med "Omstilling" (inkl. varianter: MV, Contact Center, Pro, Uden MV, Unlimited, Premium, Starter — Trin 1–5, ATL, 36 mdr.).
- Ingen kodeændringer. Ingen DB-ændringer. Ren SQL-udtræk → xlsx i `/mnt/documents/`.

## Kolonner i arket
1. Produktnavn
2. Basis provision (fra `products.commission_amount` eller aktiv "hovedside"-regel uden betingelser)
3. Basis omsætning (`products.revenue_amount` / aktiv regel)
4. Gældende fra (basis)
5. Tilskud=0 provision (fra `product_pricing_rules` med betingelse tilskud=0, aktiv pr. dato)
6. Tilskud=0 omsætning
7. Tilskud=0 gældende fra
8. Note (fx hvis flere aktive regler / manglende sats)

Sorteres alfabetisk på produktnavn.

## Fremgangsmåde
1. Hent produkter + basis-satser + aktive prisregler via ét SQL-query mod `products` + `product_pricing_rules` (filtreret på `effective_from <= today` og `effective_to IS NULL OR effective_to >= today`).
2. Klassificér regler: "basis" = ingen betingelser, "tilskud=0" = betingelse på tilskud-feltet.
3. Byg xlsx med openpyxl, kør recalculate, gem som `/mnt/documents/relatel-omstilling-produkter.xlsx`.
4. Præsentér via `<presentation-artifact>`.

## Åbne spørgsmål (svar før build hvis relevant)
- Skal både aktive OG udløbne regler med? → Antager **kun aktive pr. i dag** medmindre andet siges.
- Skal jeg også inkludere Omstilling Premium/Starter/36 mdr.-varianter uden Trin? → Antager **ja, alle 33**.
