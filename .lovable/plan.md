

# Excel-eksport med to faner: Opsummering + Rådata

## Ændringer

### 1. Ny database-funktion: `get_sales_report_raw`
Opretter en ny RPC der returnerer hvert enkelt salg som sin egen række med felter:
- `employee_name` — sælgerens navn
- `sale_datetime` — salgstidspunkt
- `product_name` — produktnavn
- `quantity` — antal
- `commission` — provision
- `revenue` — omsætning
- `customer_phone` — kundens telefonnummer
- `customer_company` — virksomhed
- `status` — salgsstatus

Baseret på samme joins og filtre som `get_sales_report_detailed`, men uden GROUP BY — altså en række per `sale_item`.

### 2. Frontend: `ReportsManagement.tsx`
- Tilføj et nyt query der kalder `get_sales_report_raw` med samme filtre
- Opdater `handleExport` til at oprette en Excel-fil med **to faner**:
  - **Fane 1: "Opsummering"** — den eksisterende aggregerede tabel (per medarbejder med produktkolonner + total)
  - **Fane 2: "Rådata"** — alle individuelle salg med en række per salg, inkl. dato, medarbejder, produkt, antal, provision, revenue, kundeinfo

Ingen ændring i den viste tabel på skærmen — kun Excel-eksporten får den ekstra fane.

