
# Plan: Fjern Market Application-funktionen

## Oversigt
Fjern funktionen hvor fieldmarketing-medarbejdere kan ansøge om at deltage på markeder. I stedet booker I manuelt som før.

## Hvad bliver fjernet
- "Afventende ansøgninger"-panelet på Book uge-siden
- "Åben for ansøgninger"-checkboxen ved oprettelse af bookinger
- "Åben for ansøgninger"-badgen på marked-kortene
- Databasetabellen `market_application` og relaterede kolonner

---

## Trin 1: Slet frontend-filer

**Filer der slettes helt:**
- `src/hooks/useMarketApplications.ts` – Hooks til at hente og håndtere ansøgninger
- `src/components/vagt-flow/MarketApplicationsManager.tsx` – UI til at godkende/afvise ansøgninger

---

## Trin 2: Opdater BookWeekContent.tsx

**Fjernes:**
- Import af `MarketApplicationsManager`
- State-variable: `openForApplications`, `applicationDeadlineDays`, `visibleFromWeeks`
- `<MarketApplicationsManager />` komponenten
- "Åben for ansøgninger" checkbox og indstillinger (linjer 702-744)
- Felterne `open_for_applications`, `visible_from`, `application_deadline` fra booking-mutation

---

## Trin 3: Opdater MarketsContent.tsx

**Fjernes:**
- `Eye` icon import
- Logik der henter antal ventende ansøgninger (linjer 99-122)
- "Åben for ansøgninger"-badge på marked-kort (linjer 409-419)

---

## Trin 4: Database-migration

Kræver godkendelse før udførelse.

```text
Ændringer:
├── DROP TABLE market_application (inkl. RLS og indexes)
├── DROP TYPE market_application_status
├── ALTER TABLE booking DROP COLUMN open_for_applications
├── ALTER TABLE booking DROP COLUMN application_deadline  
└── ALTER TABLE booking DROP COLUMN visible_from
```

---

## Resultat efter implementering
- Markeder vises stadig på Markets-fanen
- Medarbejdere kan tilføjes manuelt via EditBookingDialog
- Al ansøgnings-funktionalitet er fjernet
- Databasen er ryddet op

