
## Vis Sales ID som CVR for Relatel i annulleringsvisningen

### Hvad aendres
Kun for Relatel-kunden: I "Virksomhed"-kolonnen vises `Sales ID` fra leadResultFields, hvis `customer_company` er tom. Hvis hverken `customer_company` eller `Sales ID` findes, vises "-" som nu.

Telefonnumre er desvaerre ikke tilgaengelige i databasen for Relatel-salg, sa der kan ikke vises noget nyt i telefon-kolonnen endnu.

### Tekniske detaljer

**Fil: `src/components/cancellations/ManualCancellationsTab.tsx`**

1. Importer Relatel client ID fra `src/utils/clientIds.ts` (ID: `0ff8476d-16d8-4150-aee9-48ac90ec962d`)

2. Udvid SELECT-queryen til ogsaa at hente `raw_payload` (kun naar Relatel er valgt, for at undgaa unodvendig data for andre kunder)

3. Tilfoej en hjaelpefunktion der udtraekker virksomhedsnavnet:
   - Foerst: brug `customer_company` hvis den har vaerdi
   - Ellers: tjek om den valgte klient er Relatel, og hent `raw_payload.leadResultFields['Sales ID']`
   - Ellers: vis "-"

4. Opdater Virksomhed-cellen til at bruge denne hjaelpefunktion i stedet for direkte `sale.customer_company || "-"`

Ingen nye dependencies eller database-aendringer er noedvendige.
