## Formål
Excel-fil med alle 270 salg fra Vorbasse-markedspladserne (16.–18. juli 2026), så du kan se hvilken sats de fik og hvilken de burde have fået.

## Scope
- Kun de tre markedspladser: `Vorbasse kræmmermarked (plads 1/2/3)`. Den faste `Vorbasse (Yousee plads)` er ikke med (andet setup).
- Kilde: `sales` + `sale_items` hvor `source='fieldmarketing'` og `fm_location_id` matcher de tre pladser.

## Kolonner i arket "Salg" (én række pr. sale_item, 270 rækker)
1. Dato (sale_datetime, Europe/Copenhagen)
2. Sælger (agent_name)
3. Plads (location.name)
4. Produkt (products.name)
5. Antal (quantity)
6. Fik – provision pr. stk (mapped_commission)
7. Fik – omsætning pr. stk (mapped_revenue)
8. Burde – provision pr. stk (products.commission_dkk = marked-sats)
9. Burde – omsætning pr. stk (products.revenue_dkk)
10. Diff prov pr. stk (burde − fik)
11. Diff prov total (diff × antal)

## Kolonner i arket "Opsummering"
Én række pr. produkt: antal, fik total prov/oms, burde total prov/oms, samlet diff. Plus totalrække.

## Antagelse jeg gerne vil have bekræftet
Jeg bruger **`products.commission_dkk` / `revenue_dkk` som "burde have fået"**, fordi det er marked-basesatserne (Nuuday 360/1000, IKKE Nuuday 450/1000, 5G Internet 300/650). Hvis den korrekte marked-sats er en anden end produktets basesats, så sig det — så bruger jeg den i stedet.

## Leverance
`/mnt/documents/vorbasse-marked-satser.xlsx` — ingen kode- eller DB-ændringer.
