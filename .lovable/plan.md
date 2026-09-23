# Slet Karl Koppels salg fra 23. sep. kl. 14:36

## Hvilket salg det er (bekræftet i databasen)

- Sælger: Karl Koppel (kk@cph-relatel.dk)
- Tid: 23. sep. 2026 kl. 14:36 (dansk tid)
- Kunde/kampagne: Relatel — Relatel Products
- Produkt: Fri Tale - 30 GB ATL, 1 stk.
- Provision: 1.105 kr. · Omsætning: 2.388,50 kr.
- Reference: MG-202609-06631 · Sales ID 46094190 · Lead 1036188421
- Status: afventer (ikke godkendt, ikke annulleret)

Salget har ingen spor i provisionsposteringer, annulleringskø, kvalitetskontrol eller prisrettelser — det er kun selve salget og dens ene produktlinje.

## Hvad der bliver gjort

1. Produktlinjen (provision og omsætning) slettes.
2. Selve salget slettes.

Derefter forsvinder det fra dagsrapporter, salgsoversigter, leaderboards, dashboards og lønberegningen for perioden 15/9–14/10. Provisionen på 1.105 kr. tælles ikke længere med for Karl Koppel. Lønperioden er ikke afsluttet, så der er ingen udbetalt løn der ændres bagudrettet.

## Én ting du skal vide

Salget kom ind fra dialeren. Hvis nogen senere kører en historik-genindlæsning for den 23. september, vil samme salg blive oprettet igen, fordi dialeren stadig har det registreret som en succes. Det er ikke noget vi kan forhindre ved at slette i Stork alene — hvis det skal blokeres permanent, skal emnet også rettes i dialeren.

Alternativ hvis du hellere vil det: i stedet for sletning kan salget markeres som afvist. Så tælles det heller ikke med nogen steder, men rækken bliver bevaret som historik og kan ikke komme tilbage ved en genindlæsning. Sig til hvis du foretrækker den vej.

## Teknisk

- Sletning via `run_sql`: `delete from sale_items where sale_id = '6da68c34-7982-4800-980e-732a06fbb126'` efterfulgt af `delete from sales where id = '6da68c34-7982-4800-980e-732a06fbb126'`.
- Ingen kodeændringer, ingen migration, ingen ændring i prisregler, lønlogik eller RLS.
- Kontrolleret før sletning: 0 rækker i `commission_transactions`, `cancellation_queue`, `quality_reviews`, `quality_mail_log`, `quality_review_voids`, `quality_uncontrolled_sales`, `tryg_sale_reviews`, `product_change_log`, `sales_manual_pricing_corrections`.
- Genindlæsningsrisiko: `integration-engine/core/sales.ts:582` upserter på `adversus_external_id` (her 1540384), så en repair-kørsel for datoen vil genskabe rækken.
- Efterkontrol: opslag på referencen giver 0 rækker, og Karl Koppels dagstotal for 23/9 falder med 1 salg og 1.105 kr.
