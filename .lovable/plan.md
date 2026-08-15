# Eesy FM: indlæs PowerBI-ark og sammenlign med Stork

## Mål
De to dropzones under "Upload" skal faktisk indlæse Excel-arket, gemme det centralt (så alle med adgang ser samme upload), og bruge det til at finde differencer mod salgene i Stork. Arket forbliver liggende indtil man aktivt fjerner det.

## Sådan virker det for brugeren

**Upload-fanen**
- Når en .xlsx slippes i "Gaden/Coop" eller "Marked", læses arket i browseren og gemmes på serveren: filen selv + de indlæste rækker.
- Kun disse kolonner indlæses: A "Year - Month - Date - Date" (salgsdato), B "Sælger", C "Nummer" (mobil), E "Subscription Name" (produkt), F "Salgskampagne", I "Operator". Øvrige kolonner ignoreres.
- Efter upload viser kortet: filnavn, antal indlæste rækker, dato-interval i arket, hvem der uploadede og hvornår — plus knapperne "Skift fil" og "Fjern".
- Uploaden er ikke bundet til session eller browser: næste gang siden åbnes (også af en anden leder) er arket stadig indlæst, indtil nogen trykker "Fjern".
- Der er intet krav om at begge ark uploades. Hver zone er uafhængig; ét ark er nok for at kunne sammenligne.
- Ny upload i samme zone erstatter den tidligere (den gamle fjernes, så der altid kun er ét aktivt ark pr. zone).
- Numre normaliseres ved indlæsning (fjern mellemrum, +45, .0 fra Excel-tal) så de kan matches direkte mod Stork.

**Oversigt-fanen (de to eksisterende kategorier)**
Sammenligningen sker på mobilnummer alene, på tværs af de aktive ark (Gaden/Coop + Marked slås sammen):
- **Mangler i powerbi**: Eesy FM-salg i Stork hvor mobilnummeret ikke findes i de uploadede ark, inden for den valgte periode.
- **Afvigelser - oversigt**: numre der findes både i Stork og i arket, men hvor produktet er forskelligt. Her vises Stork-produkt over for "Subscription Name" fra arket.
- Filtre (datointerval, hurtigvalg, søgning, sælger) og sortering virker som i dag. Periodefiltret gælder salgsdatoen.
- Produkt-/kampagne-mapping laves ikke i dette trin: sammenligningen viser rå tekst fra begge sider, så I kan se hvad der reelt skal mappes. Mapping-fanen bruges til det bagefter.

## Teknisk

**Database (ny migration)**
- `eesy_fm_powerbi_imports`: `sheet_type` ('gaden_coop' | 'marked'), `file_name`, `storage_path`, `row_count`, `period_from`, `period_to`, `uploaded_by`, `is_active`. Unikt indeks på `sheet_type` hvor `is_active`.
- `eesy_fm_powerbi_rows`: `import_id` (FK, cascade delete), `sale_date`, `seller_name`, `phone_raw`, `phone_normalized`, `subscription_name`, `campaign_name`, `operator`. Indeks på `(phone_normalized)` og `(sale_date)`.
- GRANT til `authenticated` + `service_role`; RLS med samme adgangsnøgle som resten af Eesy FM afvigelser-siden (samme permission-key som sidens route-guard bruger).
- Privat storage-bucket `eesy-fm-powerbi` til selve filen (kun til dokumentation/genindlæsning).

**Frontend**
- `src/pages/vagt-flow/EesyFmDeviations.tsx`: `FileDropzone` bliver drevet af server-state i stedet for lokal `useState`.
- Ny hook `src/hooks/useEesyFmPowerBiImports.ts`: `useEesyFmPowerBiImports()` (aktive imports + rækker), `useUploadPowerBiSheet()` (parse → storage → insert import + rækker i batch), `useRemovePowerBiImport()`.
- Parsing via eksisterende `parseExcelFile` i `src/utils/excel.ts`. Kolonner findes efter overskriftsnavn med fallback til kolonneposition (A/B/C/E/F/I), så små variationer i header ikke vælter indlæsningen.
- Rækker indsættes i chunks (500 pr. insert) for at undgå timeout på store ark.
- Ny hook/afledt logik til sammenligningen (`useEesyFmDeviationRows`): henter Stork-salg via samme mønster som `useEesyFmClaimSales` (source `fieldmarketing`, `fm_client_id` = Eesy FM) og joiner mod PowerBI-rækkerne på normaliseret nummer. `DeviationsPanel` får data ind som prop i stedet for kun claims-data.
- Zone: grøn/gul (UI + ny isoleret tabel). Ingen ændringer i pricing, løn eller eksisterende salgsdata — sammenligningen er read-only mod `sales`.
