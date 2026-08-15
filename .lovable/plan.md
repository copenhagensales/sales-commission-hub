# Afvigelser — oversigt: to nye PowerBI-kolonner

## Hvad der ændres

I tabellen under "Afvigelser — oversigt":

- Kolonnen "PowerBI" omdøbes til **PB Produkt** — samme indhold som i dag (Subscription Name fra arket).
- Ny kolonne **PB Kampagne** — viser "Salgskampagne" fra det uploadede ark.
- Ny kolonne **PB Operator** — viser "Operator" fra det uploadede ark.

Rækkefølge: Salgsdato · Sælger · Mobil · Afvigelse · Tastselv · PB Produkt · PB Kampagne · PB Operator · Type.

Ingen ændring i matchning, filtre, sortering eller i "Mangler i PowerBI"-visningen. Ingen ny upload nødvendig — begge felter indlæses og gemmes allerede fra arket i dag.

## Teknisk

- `src/hooks/useEesyFmDeviations.ts`: `DeviationRow` udvides med `powerBiCampaign` og `powerBiOperator`, som sættes fra den matchede rækkes `campaignName` / `operator` (findes allerede i `PowerBiRow`, `useEesyFmPowerBiImports.ts:36-37`).
- `src/pages/vagt-flow/EesyFmDeviations.tsx`: `OVERVIEW_COLUMNS` opdateres ("PowerBI" → "PB Produkt", plus "PB Kampagne" og "PB Operator"), og tabelrækkerne i `DeviationsPanel` renderer de to nye celler for `deviationMode === "deviations"`.
- Grøn zone: kun visning + felt-gennemstilling. Ingen DB-migration, ingen ændring i pricing eller løn.
