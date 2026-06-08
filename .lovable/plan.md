## Mål

Lukke pricing-hullet i indeværende lønperiode (15/5–14/6) ved at oprette de manglende "NY provision" (+10%) og "Ny tilskud" (20%) regler for alle Relatel-produkter undtagen MBB, og derefter rematche `sale_items` så `mapped_commission` opdateres bagudrettet.

## Reglerne (bekræftet formel)

- **NY provision** = `products.commission_dkk × 1,10` — gælder ALLE Relatel-produkter UNDTAGEN MBB. `effective_from = 2026-05-15`, `priority = 0`, ingen `conditions`.
- **Ny tilskud** = `(base × 1,10) + (gammelt_tilskud_beløb × 0,20)`, hvor `gammelt_tilskud_beløb = (gammel_tilskud_comm − base) / 0,125` — gælder ALLE Relatel-produkter INKL. MBB (hvis et gammelt tilskud findes). `effective_from = 2026-05-15`, `priority = 0`, `conditions = {Tilskud: 0%}`.
- Revenue uændret (kopieres fra gammel regel eller `products.revenue_dkk`).

## Omfang (foreløbig)

Indenfor Relatel-kampagner med salg i 2026:

- ~20+ produkter mangler "NY provision" — inkluderer de 7 du listede plus flere (Bruger +MV, Contact Center, Datadeling-varianter, ATL FULD PRIS-varianter, 5 GB / 5 Timer, Omstillingsbruger, Switch-varianter).
- ~6 produkter mangler "Ny tilskud" men har gammel tilskud-regel (Fri Tale 60 BTL #2/#5, 1000 BTL #3, 2000 BTL #3, m.fl.).
- **Switch Professionel ATL**: gammel regel "tilskud normalt" (priority 5) slår nye regler fordi de ikke findes. Skal også have NY provision + Ny tilskud.

## Plan

### Trin 1 — Generér konkret regel-liste til godkendelse
SQL der lister hver foreslået ny regel (produkt, gammel base, ny comm, evt. ny tilskud comm, kilde-regel). Du gennemgår listen og bekræfter inden indsættelse. Især vigtigt for produkter hvor `gammel_tilskud_comm == base` (betyder reelt 0 kr tilskud — ny tilskud-regel ikke nødvendig).

### Trin 2 — Migration der indsætter reglerne
Én migration der `INSERT`'er alle godkendte regler i `product_pricing_rules` med `effective_from='2026-05-15'`, `is_active=true`, `priority=0`. Skriver også til `pricing_rule_history` via eksisterende trigger.

### Trin 3 — Kør `rematch-pricing-rules` edge function
Genberegner `mapped_commission` og `mapped_revenue` på alle `sale_items` for salg i indeværende lønperiode (15/5 og frem). Bruger eksisterende infrastruktur — ingen kodeændring.

### Trin 4 — Verifikation
Genkør Silas-summen: skal stige fra 19.344 kr mod ca. 20.180 kr du regnede manuelt. Hvis tallet stadig afviger: identificér konkrete salg hvor regel ikke matchede.

## Røde flag (skal afklares før Trin 1)

1. **Scope**: Skal det KUN være Relatel-klienten, eller også andre klienter (Tryg, Finansforbundet, Nuuday, ASE)? Du nævnte "alle produkter" — jeg antager indtil videre "alle Relatel-produkter" baseret på den oprindelige forretningsbeskrivelse.
2. **Switch Professionel ATL**: Skal også med (+10% og ny tilskud)? Min antagelse: ja, ifølge din regel "alle undtagen MBB".
3. **ATL FULD PRIS-varianter**: Listen indeholder produkter som `ATL FULD PRIS Fri Tale + 10 GB (36 mdr.)` der historisk har været spejlinger af BTL-varianter. Skal de også have nye regler, eller er de udfasede/aliasser?
4. **MBB**: Bekræftet at MBB IKKE skal have +10% provision. Skal MBB have "Ny tilskud" (20%)? Hvis ja, har MBB en gammel tilskud-regel jeg kan basere beregningen på? Aktuelt har 5G MBB ingen tilskud-regel.

## Sikkerhed (rød zone)

Pricing-motoren er rød zone (CLAUDE.md §4). Migrationen rører `product_pricing_rules` der indgår i Tier 1-afhængighed. Derfor:

- Ingen `UPDATE`/`DELETE` på eksisterende regler — kun `INSERT` af nye.
- Rematch kører kun mod sale_items i 2026-05-15+ vindue (ikke historisk forurening).
- `pricing_rule_history` får automatisk audit-trail via eksisterende trigger.
- Migration udføres efter du har bekræftet listen i Trin 1.

Bekræft de 4 røde flag, så genererer jeg den endelige liste til Trin 1.
