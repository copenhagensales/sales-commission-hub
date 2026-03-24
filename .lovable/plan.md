

# Eesy TM: Produkt-niveau annullering via telefon-abo kolonner

## Problem
Eesy TM filen har en struktur hvor hver række indeholder flere telefonnumre i separate kolonner:
- "Telefon Abo1" -> produkt "Abonnement1"
- "Telefon Abo2" -> produkt "Abonnement2"  
- "Telefon Abo3" -> produkt "Abonnement3"
- osv.

Når "Annulled Sales = 1", skal kun det specifikke produkt annulleres — ikke hele salget. Det nuværende system matcher kun på ét telefonnummer og annullerer hele salget.

## Løsning
Tilføj en **produkt-telefon-mapping** til upload-config, så systemet kan:
1. For hver "Telefon AboX" kolonne → finde salget via telefonnummeret
2. Annullere kun det tilhørende produkt ("AbonnementX") på det salg

## Ændringer

### 1. Database: Ny kolonne på `cancellation_upload_configs`
Tilføj `product_phone_mappings JSONB` — et array af `{ phoneColumn: string, productName: string }`:
```json
[
  { "phoneColumn": "Telefon Abo1", "productName": "Abonnement1" },
  { "phoneColumn": "Telefon Abo2", "productName": "Abonnement2" },
  { "phoneColumn": "Telefon Abo3", "productName": "Abonnement3" }
]
```

Opdater Eesy TM config med disse mappings.

### 2. UploadCancellationsTab.tsx — Ny matching-logik for produkt-telefon
Når `product_phone_mappings` er konfigureret:

- **Matching**: For hver filtreret række (Annulled Sales = 1), gennemgå hver mapping. For hver mapping:
  - Hent telefonnummer fra den specifikke kolonne (f.eks. "Telefon Abo1")
  - Find salget via telefonnummer-match
  - I stedet for at markere hele salget, tilknyt det specifikke produktnavn ("Abonnement1") til matchet

- **MatchedSale interface**: Udvid med et valgfrit `targetProductName?: string` felt

- **Preview**: Vis hvilke specifikke produkter der vil blive annulleret per salg (ikke hele salget)

### 3. ApprovalQueueTab.tsx — Produkt-niveau godkendelse
Når godkendt:
- I stedet for `validation_status = "cancelled"` på hele salget:
  - Find `sale_items` der matcher produktnavnet
  - Sæt `is_cancelled = true` og `cancelled_quantity = quantity` på kun det specifikke `sale_item`
  - Kun sæt `validation_status = "cancelled"` hvis **alle** sale_items er annulleret

### 4. cancellation_queue — Gem produkt-info
Tilføj `target_product_name` til `cancellation_queue` tabellen, så godkendelses-flowet ved hvilket produkt der skal annulleres.

### 5. Eesy TM Config (migration)
Opdater den eksisterende Eesy TM config med:
```sql
UPDATE cancellation_upload_configs 
SET product_phone_mappings = '[
  {"phoneColumn": "Telefon Abo1", "productName": "Abonnement1"},
  {"phoneColumn": "Telefon Abo2", "productName": "Abonnement2"},
  {"phoneColumn": "Telefon Abo3", "productName": "Abonnement3"}
]'::jsonb
WHERE client_id = '81993a7b-ff24-46b8-8ffb-37a83138ddba';
```

### 6. Telefon-normalisering
Tilføj `normalizePhone()` der fjerner +45/0045 prefix, så "69301969" matcher "+4569301969" i databasen.

## Flow for Eesy TM
1. Upload fil → filter "Annulled Sales = 1"
2. For hver filtreret række: 
   - Tjek "Telefon Abo1" → find salg → marker "Abonnement1" til annullering
   - Tjek "Telefon Abo2" → find salg → marker "Abonnement2" til annullering
   - osv.
3. Preview viser: "Salg X — Annuller Abonnement1"
4. Godkendelse: Kun det specifikke sale_item annulleres

## DB migrationer
1. `ALTER TABLE cancellation_upload_configs ADD COLUMN product_phone_mappings JSONB DEFAULT '[]'`
2. `ALTER TABLE cancellation_queue ADD COLUMN target_product_name TEXT`
3. UPDATE Eesy TM config med mappings

