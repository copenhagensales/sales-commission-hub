# Flyt "Send til Tryg" til fanen Afviste salg

Knappen skal ikke længere stå i kortets øverste værktøjslinje. Den skal kun findes på fanen "Afviste salg", placeret lige over kolonnen "Handlinger" i tabelhovedet — samme placering som "Godkend markerede"/"Afvis markerede" har på Gennemgang.

## Hvad der ændres

- "Send til Tryg" fjernes fra den øverste knapperække (ved siden af "Kopiér markerede"). "Kopiér markerede", søgefelt, datovælger og Skabelon bliver uændret.
- På fanen "Afviste salg" vises knappen i tabelhovedet til venstre for teksten "Handlinger".
- Mailen indeholder alle telefonnumre på de afviste salg i den valgte periode (som besluttet). Knappen er inaktiv, når der ikke er nogen afviste salg.
- Fanerne "Gennemgang" og "Godkendte salg" får ingen knap.
- Dialogen, emnet og skabelonlogikken er uændret.

## Teknisk

1. `src/components/reports/TrygSalesTable.tsx`
   - `StatusProps` får to valgfrie felter: `headerAction?: React.ReactNode`.
   - I `TableHead` for "Handlinger" renderes ved `mode === "status"` `headerAction` til venstre for teksten "Handlinger" i samme flex-layout som review-varianten.
2. `src/pages/reports/TrygEditSales.tsx`
   - Fjern knappen "Send til Tryg" fra værktøjslinjen (linje 465-474).
   - Beregn `rejectedPhones` fra `rejectedSales` (samme normalisering som `selectedPhones` bruger) og lad `mailBody` bruge disse numre.
   - Send `headerAction` med knappen til `TrygSalesTable` i `TabsContent value="rejected"`; disabled når `rejectedPhones.length === 0`.
   - `SendTrygMailDialog` får `phones={rejectedPhones}`.

Ingen ændringer i database, RLS, edge function, provision, pricing eller løn. Kun UI og hvilke numre der sendes med i den manuelle mail.
