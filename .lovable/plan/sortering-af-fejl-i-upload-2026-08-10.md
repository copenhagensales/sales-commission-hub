# Sortering af "Fejl i upload"

Fejltabellen under Bulk Salg (Leder) sorteres efter årsagstype i en fast rækkefølge, så de vigtigste fejl står øverst.

## Rækkefølge

1. **Mobil mangler eller er ugyldig**
2. **Sælger-fejl** — "Sælger findes ikke eller er inaktiv", "Sælger mangler arbejdsmail"
3. **Øvrige fejl** — fx status ikke Succes, tekniske indsæt-fejl
4. **Dubletter (nederst)** — "Emne-ID er allerede importeret", "Dublet: mobilnummeret er allerede registreret", "Dublet i filen: mobilnummeret optræder flere gange"

Inden for hver gruppe bevares den oprindelige rækkefølge fra filen, så man kan følge rækkerne.

## Teknisk

- Kun `src/pages/TastSelvSalg.tsx`, komponenten `BulkUploadErrorsCard` (linje 524-566). Ren visningsændring — ingen ændring i backend, validering eller import-logik.
- Ny hjælpefunktion udleder en sorteringsvægt ud fra `reason`-teksten (match på nøgleord: "mobil mangler", "sælger", "dublet"/"allerede importeret").
- Sortering sker i en `useMemo` over `errors` med stabil sortering (indeks som sekundær nøgle).
- Årsagerne kommer fra `supabase/functions/manual-sales/index.ts:323-351` og ændres ikke.
