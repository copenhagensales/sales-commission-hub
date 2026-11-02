# Ret TDC Brands-reglen fra -70 % til -30 % (Eesy TM)

## Nuværende tilstand (bekræftet)
- Én justering: "TDC Brands = Ja (-70 %)", gælder fra 29/10/2026, kun Eesy TM, 5GI MBB undtaget, reduktion 70 %.
- 77 salgslinjer er i dag ramt af reglen.

## Ændring
1. Reglens reduktion ændres fra 70 til 30, og navnet til "TDC Brands = Ja (-30 %)". Samme regel, samme startdato, samme betingelse og undtagelse – så nye salg automatisk får -30 %.
2. De 77 ramte linjer genberegnes med den eksisterende genberegning (samme vej som i går): grundpris/almindelig regel først, derefter -30 %. Ingen manuel tal-rettelse.
3. Kun linjer med TDC Brands = Ja fra 29/10 berøres. Salg med Nej/uden felt, salg før 29/10, 5GI MBB og andre kunder røres ikke.

## Kontrol bagefter (kun antal/summer)
- Alle ramte linjer har nu 30 % reduktion (provision og omsætning = 70 % af prisen før justering).
- Antal linjer uden TDC Brands = Ja og før 29/10 er uændrede.
- Sum før/efter for provision og omsætning rapporteres.

## Teknisk
- Data-ændring på `pricing_adjustment_rules` (percent_reduction 70→30, name) via run_sql; ingen migration, ingen kodeændring (procent læses fra reglen).
- Genberegning via `rematch-pricing-rules` begrænset til Eesy TM fra 29/10; ingen afsendelser.
