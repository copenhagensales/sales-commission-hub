

## Problem: 5G Internet matches fejlagtigt på telefonnummer

### Analyse

Pass 1b (linje 1021-1060) matcher **alle** rækker med telefonnummer mod `customer_phone` på salg — uanset produkt. "5G Internet" er et internetprodukt der ikke har et reelt telefonnummer tilknyttet, så phone-matching giver falske resultater.

Pass 2 (linje 1135-1141) har en guard: `if (excelPhone) return;` — rækker MED telefonnummer når aldrig Pass 2, selv når telefonnummeret er irrelevant for produktet.

### Løsning: Konfigurerbar liste over produkter der skal skippe phone-matching

**1. Database**: Tilføj `phone_excluded_products` (JSONB) til `cancellation_upload_configs`

```sql
ALTER TABLE cancellation_upload_configs
  ADD COLUMN phone_excluded_products JSONB DEFAULT NULL;
```

Eksempel-værdi: `["5G Internet", "5G Router"]`

**2. Opdater Eesy FM config**:
```sql
UPDATE cancellation_upload_configs
SET phone_excluded_products = '["5G Internet"]'::jsonb
WHERE id = '0606d7ab-3872-4dcf-aa72-080d84ebe90e';
```

**3. Kodeændringer i `UploadCancellationsTab.tsx`**:

- Tilføj `phone_excluded_products` til `UploadConfig` interface
- I **Pass 1b** (linje ~1023): Tjek om rækkens produktnavn matcher exclusion-listen → skip rækken
- I **Pass 2** (linje ~1141): Fjern `if (excelPhone) return;` guarden for rækker hvis produkt er i exclusion-listen, så de kan matches via sælger+dato+produkt

```typescript
// Pass 1b: Skip excluded products
const phoneExcluded = (activeConfig?.phone_excluded_products as string[]) || [];
const excelProduct = /* resolve product name from row */;
const isPhoneExcluded = phoneExcluded.some(p => 
  excelProduct.toLowerCase().includes(p.toLowerCase())
);
if (isPhoneExcluded) return; // let Pass 2 handle it

// Pass 2: Allow phone-excluded rows through even if they have a phone
if (excelPhone && !isPhoneExcluded) return;
```

**4. Config UI**: Tilføj et inputfelt i opsætningsdialogen for "Produkter uden telefon-match" (komma-separeret).

### Filer der ændres
- **Migration**: Tilføj `phone_excluded_products` kolonne + opdater Eesy FM config
- **`UploadCancellationsTab.tsx`**: Interface, Pass 1b guard, Pass 2 guard, config wizard UI

