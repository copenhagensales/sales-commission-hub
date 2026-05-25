# Plan: Excel-udtræk Mathias Victor Andersen

Henter 36 salg fra `sales` for `mva@copenhagensales.dk` i perioden 15/4 – 14/5 2026 og genererer en .xlsx-fil.

## Kolonner
- Dato (sale_datetime, dansk format)
- OPP nr (fra `raw_payload.leadResultFields.OPP nr`)
- Produkt (sammensat fra `sale_items.display_name`/`adversus_product_title`)
- Provision DKK (sum af `sale_items.mapped_commission` pr. salg)

## Output
`/mnt/documents/mva_salg_15apr-14maj-2026.xlsx` med totalrække nederst.
