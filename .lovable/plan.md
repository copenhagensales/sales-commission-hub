# Plan: Kobl »Ase salg (C)« til Uniteds aktive kampagne

## Hvad der ændres
Prisreglen **Ase salg (C)** (600/1.500 kr. standard, 900/2.000 kr. straks, gældende fra 18/10) får tilføjet Uniteds aktive kampagne **SalgCSC** (`CAMP17885S3012`) ved siden af den nuværende kampagne. Derefter genberegnes ASE-salg fra 18/10, så salgslinjerne får reglen og vises på straksbetalingssiden.

## Bekræftet
- Regel `f67d9a10-…` er aktiv, `allows_immediate_payment = true`, kampagneliste i dag kun `b8d4626d-…`.
- Kampagnemapping `61408faf-cac3-430e-85ca-8c0d50011d91` = SalgCSC.

## Effekt på allerede lavede salg (bekræftet 5/11)
- 36 »Salg«-linjer siden 18/10: i dag 600 kr. provision / 1.500 kr. CPO. Med reglen: præcis det samme. Ingen ændring.
- 15 »Lønsikring« (300/600) og 13 »Lead« (65/150): andet produkt, røres ikke.
- Kun når straks slås til på et salg: 900 kr. provision / 2.000 kr. CPO.

## Konsekvens (løn)
- Salg på SalgCSC fra 18/10, der i dag ikke matcher reglen, får 600 kr. provision / 1.500 kr. omsætning. Før kørsel tæller jeg (kun antal) hvor mange linjer der ændrer sats, og hvad de har i dag. Hvis satsen ændres for nogen, stopper jeg og viser antal/beløbsforskel før genberegning.
- Salg før 18/10, andre kunder og ASE FM røres ikke. Straksflag bevares af genberegningen.

## Trin
1. Read-only: antal SalgCSC-linjer siden 18/10 og deres nuværende regel/sats.
2. Dataændring: tilføj mapping-id til reglens `campaign_mapping_ids` (historik logges i `pricing_rule_history`).
3. Kør `rematch-pricing-rules` afgrænset til ASE fra 18/10.
4. Kontrol: linjerne har reglen; straksbetalingssiden viser dagens salg.

Ingen kode, migrationer eller mails.
