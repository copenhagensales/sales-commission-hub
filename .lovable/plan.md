# Tilbagerulning af provision på TDC fiber (HAP/VOK) — juli/august

## Sådan forstår jeg dine tal

| Produkt | Provision FØR | Provision NU | Omsætning (CPO, uændret) |
|---|---|---|---|
| Lead Provi HAP | 500 | 375 | 1.000 |
| Lukket salg HAP | 250 | 375 | 500 |
| Lead Provi VOK | 825 | 625 | 1.650 |
| Lukket salg VOK | 425 | 625 | 850 |

HAP fuldt salg 750 = 500 + 250. VOK fuldt salg 1.250 = 825 + 425. Passer det, går jeg videre.
Er én af de fire tal anderledes, siger du blot til inden godkendelse.

## Hvad der bliver gjort

1. **Snapshot først.** Alle 57 salgslinjer på de fire produkter gemmes som en før-fil
   (dato, salgs-id, produkt, antal, provision, omsætning), så vi kan gå tilbage.

2. **To prisperioder pr. produkt.** For hvert af de fire produkter oprettes:
   - en regel med de **gamle** provisioner, gyldig indtil 08-09-2026,
   - en regel med de **nuværende** provisioner, gyldig fra 08-09-2026.
   Omsætning (CPO) sættes ens i begge perioder, altså uændret.

3. **Målrettet genberegning.** Kun de fire produkter genberegnes. Salg før 08-09-2026 får de
   gamle provisioner tilbage; salg fra 08-09-2026 beholder de nye. Antal pr. linje røres ikke.

4. **Kontrol bagefter.** Sammenligning før/efter på de 57 linjer: summer pr. produkt og pr.
   måned, bekræftelse af at ingen andre produkter, salg eller lønposter er ændret, og at
   omsætningen står uændret.

## Afgrænsning

- Kun produkt-id'erne for Lead Provi HAP/VOK og Lukket salg HAP/VOK.
- Ingen ændringer i kode, skema, adgangsregler eller lønmodel — kun prisregler og de 57 linjers
  provisionsbeløb.
- Rettelsen af datofejlen (så en fremtidig dato ikke igen slår tilbage i tiden) er allerede lavet
  og indgår ikke her.

## Teknisk

- Nye rækker i `product_pricing_rules` med tomme `conditions`, `priority 0`,
  `effective_from`/`effective_to` = `2026-09-08` som skæringsdato.
- `products.commission_dkk`/`revenue_dkk` efterlades som i dag (nuværende satser).
- `rematch-pricing-rules` køres pr. `product_id` uden `min_sale_datetime`, så begge perioder
  bliver afstemt af reglernes datoer.
- `product_price_history` får en linje pr. produkt der dokumenterer tilbagerulningen.
- Rød zone (provisionsgrundlag): udføres først efter din godkendelse af denne plan.
