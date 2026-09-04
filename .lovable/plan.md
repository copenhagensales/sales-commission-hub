# "Alle tryg & alka salg" viser ingenting — årsag og fix

## Hvad der faktisk sker

Der ER salg på dagen: 120 salgslinjer hvor kunden står på salget, og 5 hvor den står på produktet (4/9 2026, Tryg + ALKA).

Fanen viser alligevel ingenting, fordi selve dataopslaget fejler med **timeout** i databasen — ikke fordi der mangler salg. Testet direkte mod databasen med et rigtigt login:

- Nuværende opslag (filtrerer salgslinjer via en indlejret filtrering på salgets kunde + dato): HTTP 500, `57014 canceling statement due to statement timeout`.
- Samme data hentet i to trin: HTTP 200 på under et sekund — 120 salg, 120 salgslinjer.
- Produkt-sporet hentet som produktliste først: HTTP 200, 5 salgslinjer.

Kanvas-fanen rammer ikke problemet, fordi den filtrerer på ét produkt-id, som databasen kan slå direkte op.

## Hvad der ændres

Hooken bag fanen laver opslaget i trin i stedet for ét stort:

1. Hent kampagnerne under Tryg + ALKA (som i dag).
2. **Spor A:** hent `sales` for dagen hvor `client_campaign_id` er en Tryg/ALKA-kampagne → hent derefter `sale_items` filtreret på de fundne `sale_id`'er.
3. **Spor B:** hent `products` for de samme kampagner → hent `sale_items` filtreret på `product_id` + dagens datointerval på salget.
4. Forén på `sale_items.id` som i dag, sæt kunde-navn (salgets kampagne først, ellers produktets), slå sælgernavne op via `employee_master_data.work_email`, sortér nyeste først.
5. Hvis mange salg på en dag: `sale_id`-listen deles i portioner (fx 200 pr. kald), så URL'en ikke bliver for lang.

Samtidig rettes beskrivelsen under knapperne fra "Indhold tilføjes." til en tekst der matcher visningen.

## Teknisk

- `src/hooks/useTrygAlkaSales.ts`: erstat de to nuværende `sale_items`-forespørgsler (der filtrerer på `sales.client_campaign_id` / `products.client_campaign_id` som indlejrede filtre) med trin-modellen ovenfor. Felterne der returneres (`TrygAlkaSale`) er uændrede.
- `src/pages/reports/TrygEditSales.tsx`: kun `CardDescription`-teksten for `view === "tryg-alka"`.
- Ingen migrationer, ingen ændringer i RLS, pricing, provision eller løn. Ren læsning.
