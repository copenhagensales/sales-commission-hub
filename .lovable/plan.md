

Brugeren vil have et fuldt overblik over `in-progress` / `cancelled` / `success` status på tværs af ALLE Adversus-integrationer (ikke kun Eesy TM), parallelt med den analyse vi lavede for Eesy TM. "Yes kun undersøg" = ingen kode-ændringer, kun en rapport.

## Hvad jeg vil undersøge

1. **Inventory**: Hvilke Adversus-integrationer er aktive? (`dialer_integrations` hvor `provider = 'adversus'`)
2. **Per integration, ALL TIME**, optælling af salg fordelt på status:
   - `success` (eller `leadClosedSuccess`)
   - `in-progress` / `inProgress` / `pending`
   - `cancelled` / annulleret
   - Andre statusser
3. **Krydstjek mod `validation_status`**: Hvor mange `in-progress` salg er IKKE rejected (vises altså forkert i rapporter/dashboards)?
4. **Sammenlignings-tabel** i samme format som Eesy TM-tabellen brugeren viste:
   ```
   State | Antal | Første | Seneste | Allerede rejected | Vises forkert?
   ```
5. **Bonus**: Samme kort overblik for Enreach-integrationer for konsistenstjek (én sandhed på tværs af dialers).

## Hvor data kommer fra

- `sales` tabel: `dialer_integration_id`, `sale_datetime`, `validation_status`, `raw_payload->campaign_status` / `raw_payload->status`
- `dialer_integrations`: navn + provider for at gruppere pænt
- Læs `client-sales-overview` edge function for at se HVOR i UI/rapporter `in-progress` evt. tælles forkert med

## Hvad jeg leverer (ren rapport, ingen kode)

- Tabel pr. Adversus-klient (Eesy TM, Lovablecph/TDC Erhverv, evt. andre)
- Total: hvor mange `in-progress` på tværs af systemet er IKKE markeret rejected
- Liste over hvilke rapporter/dashboards der filtrerer korrekt vs. forkert (kort kode-audit af `sales.ts`, `client-sales-overview`, dashboards)
- Anbefaling (men ingen ændring): hvor fix skal landes hvis vi vil have "én sandhed"

## Hvad jeg IKKE gør
- Ingen kodeændringer
- Ingen migrations
- Ingen data-opdateringer (rejected/cancelled flags rører jeg ikke)

