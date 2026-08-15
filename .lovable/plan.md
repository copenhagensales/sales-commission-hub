# TDC Erhverv – ret salg: redigeringsdialog

## Mål
"Rediger" åbner en dialog hvor OPP-nummer, produkter og antal kan rettes, produktlinjer kan slettes eller tilføjes, og hvor rettelsen gælder salget i hele Stork (provision og omsætning genberegnes).

## Sådan virker dialogen
- Titel: OPP-nummer + sælgernavn.
- **OPP nr.:** tekstfelt. Ved ændring skrives det nye nummer på alle salgsrækker i gruppen, så visningen, dublet-tjek og rapporter bruger det nye nummer.
- **Produktlinjer:** én linje pr. faktisk salgslinje (ikke sammenlagt), med:
  - Produkt: klikbar søgbar dropdown med alle aktive TDC Erhverv-produkter (ikke sammenlagte/skjulte).
  - Antal: talfelt (minimum 1) man kan klikke i og skrive nyt tal i.
  - Slet-ikon der fjerner linjen (fjernes først i databasen ved "Bekræft rettelse").
- **Tilføj produkt:** ny tom linje (produkt + antal), kan tilføjes flere gange.
- **Bekræft rettelse** / **Annuller** nederst. Annuller kasserer alle ændringer.
- Validering: mindst én produktlinje, produkt valgt på alle linjer, antal ≥ 1.
- Efter gemning: toast, dialog lukkes, tabellen opdateres.

## Effekt i hele Stork
- Ændrede linjer opdateres på salget (produkt + antal), slettede linjer fjernes, nye linjer oprettes på gruppens salgsrække.
- Bagefter kaldes den eksisterende prisgenberegning for de berørte salg, så provision og omsætning matcher de nye produkter og antal. Salgs-, provisions- og lønrapporter læser samme data og følger derfor automatisk med.
- Hvis en linje ender uden matchende prisregel (provision 0), vises en advarsel i toasten, så lederen kan reagere.
- Hvis alle produktlinjer slettes, blokeres gemning — brug i stedet "Slet" på salget.

## Teknisk
- `src/hooks/useTdcErhvervSales.ts`:
  - Hooket returnerer også de rå salgslinjer pr. gruppe (`sale_item_id`, `sale_id`, `product_id`, `quantity`, titel), så dialogen kan redigere linje for linje i stedet for det aggregerede visningsformat. Tabelvisningen (aggregeret pr. produktnavn) bevares uændret.
  - Nyt hook `useTdcErhvervProducts`: aktive produkter under `client_campaigns.client_id = 20744525-…`, filtreret på `is_active`, `is_hidden = false`, `merged_into_product_id is null`, sorteret på navn.
  - Ny mutation `useUpdateTdcErhvervOpp(input)`:
    - OPP: læser `raw_payload` for hver sale i gruppen og skriver nyt nummer i `leadResultFields["OPP nr"]` (bevarer resten af payload), kun hvis nummeret er ændret.
    - `sale_items`: `update` (product_id, quantity, adversus_product_title = nyt produktnavn) på ændrede linjer, `delete` på fjernede, `insert` på nye (`sale_id` = gruppens primære sale, `quantity`, `product_id`, `needs_mapping = false`).
    - Kalder `supabase.functions.invoke("rematch-pricing-rules", { body: { sale_ids } })` og læser derefter `mapped_commission` for at kunne advare om 0-provision.
    - Invaliderer `["tdc-erhverv-sales"]`, `["sales-aggregates"]`, `["fm-sales-edit"]`.
- Ny komponent `src/components/reports/TdcErhvervEditDialog.tsx` (Dialog + Command-søgning i Popover til produktvalg, Input til antal), i stil med den eksisterende claim-redigeringsdialog.
- `src/pages/reports/TdcErhvervEditSales.tsx`: Rediger-knappen aktiveres og åbner dialogen for den valgte gruppe.
- Ingen ændringer i pricing-motoren, `pricingRuleMatching.ts` eller lønberegning — kun data på `sale_items` og genberegning via den eksisterende edge function.
