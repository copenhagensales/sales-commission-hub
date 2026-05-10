## Plan: Fix manglende pricing på "5 GB - 1 Time ATL" (Relatel)

### Diagnose

Produktet `5 GB - 1 Time ATL` (id `053865d9-3b55-47f3-a086-99f57cbc37a2`) har:
- `commission_dkk = 0`, `revenue_dkk = 0` på selve produktet
- INGEN pricing rule i `product_pricing_rules`
- INGEN merge til andet produkt

Resultat: alle salg på dette produkt får 0/0.

**Sammenligning (Relatel-produkter med samme bundle):**

| Produkt | id | commission | revenue |
|---|---|---|---|
| 5 GB - 1 Time **ATL** (nyt) | 053865d9 | **0** | **0** |
| 5 GB - 1 Time **BTL** (nyt) | e83198b5 | 225 | 565 |
| ATL FULD PRIS - 5 Timer + 1 GB (gammel) | a8625ba8 | **250** | **625** |
| 5 Timer + 1 GB (gammel BTL) | 50d6d687 | 225 | 565 |

Bruger bekræfter ATL-prisen er **250 kr** (= matcher gammel ATL FULD PRIS).

**Berørte salg seneste 14 dage:** 3 sale_items à 0 kr (skulle være 250 kr) — ialt 750 kr provi + 1.875 kr oms manglende. Større effekt over længere periode.

### Trin

**1. Opdater produktets base-priser**
- `UPDATE products SET commission_dkk = 250, revenue_dkk = 625 WHERE id = '053865d9-3b55-47f3-a086-99f57cbc37a2'`

**2. Rematch berørte sale_items**
- Find alle sale_items med `product_id = 053865d9` siden 15/1-2026 (retroaktivitetsgrænsen) og kald `rematch-pricing-rules` med deres sale_ids.
- Forventet: provi/oms opdateres fra 0/0 → 250/625 pr. item.

**3. Bekræft mod gammel ATL FULD PRIS-produkt**
- Sanity-check: er gammel `a8625ba8` (250/625) stadig korrekt? Hvis ja, behold base-pris-fix. Hvis kampagne-baseret pris nogle gange skal være anderledes, opret pricing rule i stedet.

### Hvad der IKKE indgår
- Ingen kode-ændringer.
- Ingen merge af gammelt og nyt produkt (separat oprydningsopgave).
- Ingen ændring af BTL-prisen (225 kr — bruger har ikke flagget den).

### Tekniske detaljer
- Tabel: `products` (UPDATE), efterfulgt af edge function `rematch-pricing-rules`.
- Retroaktivitet: pricing-systemets cut-off er 15/1-2026 (Pricing Retroactivity-memo). Salg før den dato røres ikke.
- Færdig-rapport vil indeholde: antal opdaterede sale_items, before/after diff på commission+revenue.
