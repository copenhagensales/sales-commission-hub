

# Udvidet salgsudtræk med produktdetaljer

## Hvad der bygges
Rapporten "Salgsudtræk per medarbejder" udvides med kolonner for produktopdeling per medarbejder, så man kan se fx antal telefonabonnementer, 5GI, omsætning (revenue) osv. — ud over bare samlet salg og provision.

## Teknisk tilgang

### 1. Ny database-funktion: `get_sales_report_detailed`
Opretter en ny RPC der returnerer data per **medarbejder + produkt**, med felter:
- `employee_name` — medarbejderens navn
- `product_name` — produktnavn
- `quantity` — antal solgte
- `commission` — provision
- `revenue` — omsætning

Funktionen filtrerer på klient og periode (ligesom `get_sales_aggregates_v2`), men grupperer på medarbejder + produkt i stedet for kun medarbejder. Den inkluderer kun produkter med `counts_as_sale = true`.

### 2. Frontend: `ReportsManagement.tsx`
- Kald den nye RPC i stedet for `get_sales_aggregates_v2`
- Aggreger data i frontend: per medarbejder samles produkter, og unikke produktnavne bliver til dynamiske kolonner
- Tabellen viser: **Medarbejder | Antal salg | [Produkt1] | [Produkt2] | ... | Provision | Revenue**
- Produktkolonner genereres dynamisk baseret på hvilke produkter der faktisk findes i data
- Tilføj en "Revenue (DKK)" kolonne
- Excel-eksporten opdateres tilsvarende med alle kolonner

### 3. UI-forbedringer
- Tabellen får `overflow-x-auto` da der kan være mange produktkolonner
- Produktkolonner viser antal (quantity) per produkt per medarbejder
- TOTAL-rækken summerer alle kolonner

