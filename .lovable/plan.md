

# Fix: Omvendt produkt-telefon matching

## Problem
Logikken er vendt forkert. Den nuværende kode antager at **Excel-filen** har flere telefon-kolonner (Telefon Abo1/2/3). I virkeligheden:

- **Excel-filen**: Har kun **én** telefonkolonne ("Phone Number") med ét nummer per række
- **Databasen**: Hvert salg har flere telefonnumre i `raw_payload.data` under nøglerne "Telefon Abo1", "Telefon Abo2", "Telefon Abo3"

Matchingen skal derfor: Tag telefonnummeret fra Excel → søg i alle kandidatsalgs `raw_payload.data` → tjek om nummeret findes i "Telefon Abo1", "Abo2" eller "Abo3" → det felt der matcher bestemmer hvilket produkt ("Abonnement1", "Abonnement2", "Abonnement3") der skal annulleres.

## Ændringer

### 1. Database: Omdøb `product_phone_mappings` semantik
Opdater Eesy TM config så mappings refererer til **raw_payload felter** i stedet for Excel-kolonner:

```sql
UPDATE cancellation_upload_configs 
SET product_phone_mappings = '[
  {"payloadPhoneField": "Telefon Abo1", "productName": "Abonnement1"},
  {"payloadPhoneField": "Telefon Abo2", "productName": "Abonnement2"},
  {"payloadPhoneField": "Telefon Abo3", "productName": "Abonnement3"}
]'::jsonb
WHERE client_id = '81993a7b-ff24-46b8-8ffb-37a83138ddba';
```

### 2. `UploadCancellationsTab.tsx` — Ny matching-logik

Erstat den nuværende produkt-matching blok (linje ~725-778) med omvendt logik:

1. For hver filtreret Excel-række: hent telefonnummeret fra den **ene** phoneColumn
2. For hvert kandidatsalg: tjek `raw_payload.data["Telefon Abo1"]`, `["Telefon Abo2"]`, `["Telefon Abo3"]`
3. Hvis Excel-telefonen matcher et af disse felter → match med det tilhørende produktnavn

```typescript
// Pseudokode for ny logik:
for (const row of filteredData) {
  const excelPhone = normalizePhone(row.originalRow[phoneColumn]);
  
  for (const sale of candidateSales) {
    const payloadData = sale.raw_payload?.data || {};
    
    for (const mapping of productPhoneMappings) {
      const salePhone = normalizePhone(payloadData[mapping.payloadPhoneField] || "");
      if (excelPhone && salePhone && excelPhone === salePhone) {
        // Match! Annuller mapping.productName på dette salg
      }
    }
  }
}
```

### 3. Telefon-indsamling til DB-query
Telefoner til candidate-query hentes stadig fra Excel's ene phoneColumn (uændret). Men candidate sales skal IKKE filtreres på `customer_phone` alene — de skal hentes bredt per campaign og derefter matches via raw_payload felterne.

### Resultat
Excel-telefon `60633480` → tjekker alle salg → finder at salg X har `raw_payload.data["Telefon Abo2"] = "60633480"` → matcher med produktnavn "Abonnement2" → kun det produkt annulleres.

