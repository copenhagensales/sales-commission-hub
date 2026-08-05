# Excel-udtræk: HAP/VOK-salg på TDC Erhverv, juli 2026

## Hvad der laves
En Excel-fil med alle TDC Erhverv-salg i perioden 1/7–31/7 2026, hvor der på salget er registreret mindst én HAP- eller VOK-linje.

## Datagrundlag (verificeret)
HAP/VOK findes som selvstændige produktlinjer i Adversus-payloaden på TDC Erhverv-kampagnen (`TDC Erhverv Products`). I juli 2026 findes disse linjer:

| Produktlinje | Antal salg | Samlet antal |
| --- | --- | --- |
| Lead Provi HAP | 11 | 12 |
| Lukket salg HAP | 11 | 12 |
| Fuldt salg HAP | 8 | 8 |
| Fuldt salg VOK | 5 | 5 |
| Lead Provi VOK | 3 | 3 |
| Lukket salg VOK | 3 | 3 |

Alle tre typer (lead, lukket salg, fuldt salg) er altså med — for både HAP og VOK.

## Kolonner i filen
- **Sælgernavn** — `sales.agent_name`
- **Salgsdato** — `sale_datetime` konverteret til dansk tid
- **Produkter (inkl. antal)** — samtlige produktlinjer på salget i formatet `2 × Lukket salg HAP; 1 × 5G - 50/10 - TDC Erhverv` (så du kan se, hvad HAP/VOK er solgt sammen med)
- **OPP nummer** — `leadResultFields."OPP nr"`

Der tilføjes en ekstra kolonne **HAP/VOK-linjer**, så du hurtigt kan filtrere på kun de relevante linjer. Annullerede salg (`validation_status = cancelled`) markeres i egen kolonne frem for at fjernes lydløst.

## Teknisk
Ét SELECT mod `sales` + `jsonb_array_elements(raw_payload->'lines')`, filtreret på kampagne-id og periode, hvor der findes en linje med titel indeholdende `HAP` eller `VOK`. Filen genereres med openpyxl og lægges i `/mnt/documents`. Ingen ændringer i kodebasen eller databasen.
