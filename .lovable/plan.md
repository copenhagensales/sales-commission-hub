## Mål
Eksport af alle Relatel-salg i perioden 15/5-14/6 2026 med fuld specifikation pr. salg inkl. tilskudsniveau (0/50/100%).

## Indhold i CSV
Én række pr. `sale_item` (dvs. fuld udspecificering — et salg med flere produkter giver flere rækker):

- **Salg:** sale_id, sale_datetime, sale_reference, status
- **Sælger:** agent_name, agent_email, team
- **Kunde:** customer info (navn/tlf hvis tilgængelig — ellers udeladt af GDPR-hensyn)
- **Produkt:** product_name, product_id, antal, unit_price
- **Økonomi:** mapped_revenue (omsætning), mapped_commission (provision), pricing_rule_id, pricing_rule_name
- **Tilskud:** subsidy_pct (0 / 50 / 100), kilde-felt fra dialer-metadata
- **Kampagne:** campaign_id, campaign_name

## Metode
1. Query `sales` + `sale_items` joinet med `products`, `product_pricing_rules`, `client_campaigns` for klient=Relatel, periode 15/5-14/6.
2. Trække tilskudsfelt fra `sales.metadata` / `sale_items` (kontrollér hvilket felt dialeren leverer — typisk `tilskud`/`subsidy` i JSONB).
3. Skrive til `/mnt/documents/relatel-salg-detaljeret-15maj-14jun-2026.csv`.
4. Levere fil + kort opsummering (antal salg, antal rækker, samlet omsætning, samlet provision, fordeling på tilskudsniveau).

## Ingen kodeændringer
Ren read-only data-eksport. Ingen filer i repoet røres.

Skift til Build mode så jeg kan køre eksporten.