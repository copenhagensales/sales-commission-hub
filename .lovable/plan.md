

# Leverandor-faktureringsrapport med rabataftaler og godkendelsesflow

## Oversigt

Udvider Fakturerings-siden med en ny "Leverandorrapport"-fane, der goer det muligt at generere rapporter pr. leverandor (lokationstype) for en given maaned, med automatisk rabatberegning for Danske Shoppingcentre, godkendelsesflow, og konfigurerbare rabataftaler.

## Nye database-tabeller

### 1. `supplier_discount_rules`
Gemmer rabataftaler (fx Danske Shoppingcentre-volumrabat):

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| location_type | text | Fx "Danske Shoppingcentre" |
| min_placements | integer | Minimum antal unikke lokationer |
| discount_percent | numeric | Rabat i procent (fx 10, 15) |
| description | text | Beskrivelse af aftalen |
| is_active | boolean | Om reglen er aktiv |
| created_at / updated_at | timestamptz | |

Seed-data:
- Danske Shoppingcentre, 11 placeringer -> 10%
- Danske Shoppingcentre, 20 placeringer -> 15%

### 2. `supplier_invoice_reports`
Gemmer genererede rapporter med godkendelsesstatus:

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| location_type | text | Leverandor/type |
| period_start | date | Periodens start (1. i md) |
| period_end | date | Periodens slut (sidste i md) |
| total_amount | numeric | Samlet beloeb foer rabat |
| discount_percent | numeric | Anvendt rabatprocent |
| discount_amount | numeric | Rabatbeloeb |
| final_amount | numeric | Beloeb efter rabat |
| unique_locations | integer | Antal unikke placeringer |
| status | text | 'draft' / 'approved' |
| approved_by | uuid | Bruger der godkendte |
| approved_at | timestamptz | Tidspunkt for godkendelse |
| report_data | jsonb | Snapshot af alle linjer |
| created_at | timestamptz | |

## Sidestruktur

Billing.tsx faar to faner via Tabs-komponent:

### Fane 1: "Oversigt" (eksisterende indhold)
Den nuvaerende faktureringsrapport forbliver uaendret.

### Fane 2: "Leverandorrapport"
Ny fane med foelgende indhold:

**Filtre:**
- Maanedsvaelger (som nu)
- Lokationstype-filter (vaelg leverandor, fx "Danske Shoppingcentre")

**Rapport-visning:**
- Tabel med alle lokationer af den valgte type i perioden
- Kolonner: Lokation, By, Kunde, Periode, Dage, Dagspris, Beloeb
- Subtotal-raekke
- Rabatsektion: Viser antal unikke placeringer, hvilken rabattrin der er opnaaet, rabatbeloeb
- Total efter rabat

**Godkendelsesflow:**
- "Godkend rapport" knap der gemmer et snapshot i `supplier_invoice_reports`
- Status-badge: Kladde / Godkendt
- Godkendte rapporter kan ikke aendres
- Mulighed for at eksportere/printe godkendt rapport

### Fane 3: "Rabataftaler"
Ny fane til administration af rabatregler:

- Tabel med alle aktive rabataftaler
- Kolonner: Lokationstype, Min. placeringer, Rabat %, Beskrivelse, Status
- Mulighed for at tilfoeje, redigere og deaktivere regler
- Dialog til oprettelse/redigering af regler

## Rabatlogik for Danske Shoppingcentre

Beregningen taeller antal **unikke lokationer** (ikke bookinger) af typen "Danske Shoppingcentre" i den valgte maaned:
- Under 11 unikke lokationer: Ingen rabat
- 11-19 unikke lokationer: 10% rabat paa samlet leje
- 20+ unikke lokationer: 15% rabat paa samlet leje

Rabatten vises tydeligt i rapporten med:
- Antal unikke placeringer
- Opnaaet rabattrin
- Beloeb foer rabat
- Rabatbeloeb
- Beloeb efter rabat

## Teknisk plan

### Trin 1: Database-migration
- Opret `supplier_discount_rules` tabel med seed-data for Danske Shoppingcentre
- Opret `supplier_invoice_reports` tabel
- RLS policies baseret paa auth (rolle-check via position_permissions)

### Trin 2: Refaktor Billing.tsx
- Tilfoej Tabs-komponent med "Oversigt", "Leverandorrapport", "Rabataftaler"
- Flyt eksisterende indhold til "Oversigt"-fanen

### Trin 3: SupplierReportTab komponent
- Ny fil: `src/components/billing/SupplierReportTab.tsx`
- Henter bookinger filtreret paa lokationstype og maaned
- Beregner rabat baseret paa `supplier_discount_rules`
- Viser rapport med godkendelsesknap
- Gemmer godkendt rapport i `supplier_invoice_reports`

### Trin 4: DiscountRulesTab komponent
- Ny fil: `src/components/billing/DiscountRulesTab.tsx`
- CRUD paa `supplier_discount_rules`
- Dialog til oprettelse/redigering

### Trin 5: Rapport-historik
- Liste over tidligere godkendte rapporter
- Mulighed for at se detaljer for godkendte rapporter

