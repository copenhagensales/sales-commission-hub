

# Ocean Outdoor rabataftale med omsaetningsbaseret trappemodel

## Oversigt

Ocean Outdoor bruger en fundamentalt anderledes rabatmodel end Danske Shoppingcentre:
- **Danske Shoppingcentre**: Rabat baseret paa antal unikke placeringer pr. maaned
- **Ocean Outdoor**: Rabat baseret paa kumulativ aarsomsaetning (trappemodel)

Derudover har Ocean Outdoor undtagelser for specifikke centre (Bruuns Galleri, Fields, Fisketorvet = max 25% rabat, og enkelte centre helt udelukket).

## Database-aendringer

### 1. Udvid `supplier_discount_rules` tabellen

Tilfoej nye kolonner for at understotte begge rabatmodeller:

| Ny kolonne | Type | Beskrivelse |
|------------|------|-------------|
| discount_type | text | 'placements' eller 'annual_revenue' (default: 'placements') |
| min_revenue | numeric | Minimumsomsaetning for omsaetningsbaserede regler |

Eksisterende regler (Danske Shoppingcentre) faar `discount_type = 'placements'` og beholder `min_placements`.

### 2. Ny tabel: `supplier_location_exceptions`

Haandterer undtagelser for specifikke lokationer:

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| location_type | text | Fx "Ocean Outdoor" |
| location_name | text | Fx "Bruuns Galleri" |
| exception_type | text | 'max_discount' eller 'excluded' |
| max_discount_percent | numeric | Max rabat (kun ved 'max_discount') |
| is_active | boolean | |

Seed-data:
- Ocean Outdoor / Bruuns Galleri / max_discount / 25%
- Ocean Outdoor / Fields / max_discount / 25%
- Ocean Outdoor / Fisketorvet / max_discount / 25%

### 3. Seed Ocean Outdoor rabatregler

7 regler med `discount_type = 'annual_revenue'`:
- 0 kr -> 15%, 200.000 -> 20%, 400.000 -> 25%, 500.000 -> 30%, 600.000 -> 35%, 800.000 -> 40%, 1.000.000 -> 50%

## Logik i SupplierReportTab

Naar der vaelges "Ocean Outdoor" som lokationstype:

1. **Beregn kumulativ aarsomsaetning**: Hent alle bookinger for Ocean Outdoor-lokationer i hele aaret (fra 1. januar til slutningen af den valgte maaned)
2. **Bestem rabattrin**: Find det hoejeste trin hvor kumulativ omsaetning >= min_revenue
3. **Anvend undtagelser pr. lokation**: 
   - Lokationer markeret som 'excluded' vises med "Pris aftales separat" og tælles ikke med i rabatberegningen
   - Lokationer med 'max_discount' faar maksimalt den angivne rabat (fx 25% for Bruuns Galleri), selvom trappen giver hojere
4. **Vis trappeoversigt**: Vis hvilken del af omsætningen der har ligget i hvilke trin og nuvaerende trin

## UI-aendringer

### DiscountRulesTab
- Tilfoej felter til den eksisterende dialog:
  - Valgfelt for "Rabattype" (Placeringer / Aarsomsaetning)
  - Betinget visning: "Min. placeringer" ved placeringer, "Min. omsaetning (kr)" ved aarsomsaetning
- Vis rabattype i tabellen
- Ny sektion: "Lokationsundtagelser" med mulighed for at tilfoeje/redigere undtagelser (excluded, max rabat)

### SupplierReportTab
- Naar `discount_type = 'annual_revenue'`:
  - Vis kumulativ aarsomsaetning i rabatsektionen
  - Vis nuvaerende trappeniveau
  - Marker undtagne lokationer tydeligt i tabellen
  - Anvend max-rabat paa relevante lokationer individuelt
  - Beregn samlet rabat som summen af individuelle rabatter (per lokation, respekterende undtagelser)

## Teknisk plan

### Trin 1: Database-migration
- ALTER `supplier_discount_rules`: tilfoej `discount_type` (default 'placements') og `min_revenue`
- CREATE `supplier_location_exceptions` tabel med RLS
- INSERT Ocean Outdoor regler og undtagelser

### Trin 2: Opdater DiscountRulesTab
- Tilfoej rabattype-vaelger i dialogen
- Betinget visning af felter
- Ny sektion til lokationsundtagelser (CRUD)

### Trin 3: Opdater SupplierReportTab
- Detekter rabattype fra regler
- Ved 'annual_revenue': hent aarsomsaetning, beregn trin, haandter undtagelser pr. lokation
- Opdater rabatsektionen med aarsomsaetning, trappeniveau, og individuelle lokationsrabatter

