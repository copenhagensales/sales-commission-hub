# Claims/Reimport-fanen viser rigtige Eesy FM claim-salg

## Hvad der bygges

Fanen "Claims/Reimport" under Eesy FM afvigelser (Leder) er i dag en tom skal. Den skal hente og vise de Eesy FM-salg, hvor Claim/Reimport er markeret (Ja), med alle kolonner udfyldt:

- **Salgsdato** — salgets dato og klokkeslæt
- **Sælger** — medarbejderens fulde navn
- **Mobil** — kundens telefonnummer
- **Tastselv** — produktnavnet som sælgeren tastede det
- **Notat** — kommentaren på salget (den kommentar der kræves når Claim/Reimport markeres)
- Blyanten yderst til højre bevares som i dag (endnu uden funktion)

Filtrene i toppen bliver funktionelle for denne fane:
- Hurtig valg / Fra dato / Til dato filtrerer på salgsdato (standard: denne måned, så fanen ikke er tom ved åbning)
- Søg (alle felter) søger i sælger, mobil, produkt og notat
- Vælg medarbejder fylder listen med de sælgere, der faktisk har claim-salg i perioden

Kun salg fra klienten Eesy FM tælles med. Salg uden Claim/Reimport-markering (inkl. alle historiske salg) vises ikke.

Der er endnu ingen salg i systemet med markeringen, så fanen vil vise "Ingen data endnu" indtil sælgere begynder at markere. Fanerne "Afvigelser — oversigt" og "Mangler i PowerBI" ændres ikke.

## Teknisk

- Ny hook `src/hooks/useEesyFmClaimSales.ts` (React Query, ingen direkte Supabase-kald i komponenten):
  - Læser `sales` med `source = 'fieldmarketing'`, `raw_payload->>'fm_claim_reimport' = 'true'`, `raw_payload->>'fm_client_id' = '<Eesy FM>'` og `sale_datetime` inden for perioden; paginering via `fetchAllRows`.
  - Slår sælgernavne op i `employee_master_data` ud fra `fm_seller_id` (samme mønster som `EditSalesRegistrations.tsx`).
  - Returnerer `{ id, sale_datetime, sellerName, phone, productName, note }`.
  - `queryKey: ["eesy-fm-claim-sales", from, to]`.
- `src/pages/vagt-flow/EesyFmDeviations.tsx`:
  - `DeviationsPanel` får en optional `rows`-prop plus `loading`/`emptyText`, så Claims-fanen kan rendere rigtige rækker mens de to andre visninger uændret viser "Ingen data endnu".
  - Claims-fanen wrappes i en ny lille `ClaimsReimportTab`, der styrer datointerval (default denne måned), søgning og medarbejdervalg og kalder hooken.
  - Filtrering på søgning/medarbejder sker klientside via `useMemo`.
- Ingen DB-migration, ingen ændringer i pricing, provision, rapporter eller dashboards.
