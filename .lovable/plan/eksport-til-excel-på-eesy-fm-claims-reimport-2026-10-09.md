# Eksport til Excel på Eesy FM Claims/Reimport

## Hvad Jeppe får
En knap "Eksportér til Excel" på fanen Claims/Reimport. Den downloader en Excel-fil med præcis de linjer, der vises i tabellen lige nu, så alle filtre gælder: periode (fra/til), søgning, medarbejder og status (Alle/Afventer/Godkendt). Rækkefølgen følger den sortering, der er valgt.

## Kolonner i filen (som i tabellen)
- Salgsdato (dd/mm/åååå tt:mm)
- Sælger
- Mobil
- Tastselv
- Notat
- Status: "Afventer" eller "Godkendt · dato · godkendt af"

Kolonnen "Handlinger" kommer ikke med, fordi den kun indeholder knapper.

Filen hedder `claims-reimport-<fra>-<til>.xlsx`. Knappen er grå, når der ikke er nogen linjer.

## Afgrænsning
- Kun fanen Claims/Reimport i `src/pages/vagt-flow/EesyFmDeviations.tsx`.
- Filen bygges af de data, siden allerede har hentet. Der laves ingen nye opslag, ingen ændringer i databasen og ingen ændringer i rettigheder.
- De andre faner og den eksisterende eksport "Mangler i PowerBI" ændres ikke.

## Teknisk
- Ny `handleExportClaims` laves ud fra den eksisterende `handleExportMissing`. Den bruger `downloadExcel` fra `@/utils/excel` og læser de allerede filtrerede og sorterede `claimRows`.
- Statusteksten bygges med samme felter og datoformat som statuscellen i tabellen.
- Knappen vises kun, når `claimsMode` er slået til, ved siden af filtrene.
- Bagefter tjekkes det i browseren, at antallet af rækker i filen er det samme som i tabellen med et aktivt filter.
