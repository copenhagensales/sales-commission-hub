

## Klassificering: Annullering / Kurvrettelse / Korrekt match

### Regler

| Klassificering | Betingelse |
|---|---|
| **Annullering** | Rækken er flaget via `type_detection_column`/values ELLER "Annulled Sales" ≠ 0 |
| **Korrekt match** | IKKE annullering, OG (`targetProductName` matcher `realProductName` ELLER produktet er i `phone_excluded_products`) |
| **Kurvrettelse** | IKKE annullering, OG `targetProductName ≠ realProductName` OG produktet er IKKE i `phone_excluded_products` |

5G Internet-produkter (og andre `phone_excluded_products`) springer kurvrettelse-tjekket over og klassificeres altid som "korrekt match" når de ikke er annulleringer — da deres matching-logik allerede sikrer korrekt produkt.

### Ændringer

**1. `UploadCancellationsTab.tsx` (linje ~1693)**

Erstat:
```typescript
rowUploadType = (isConfiguredCancellation || isAnnulledSales) ? "cancellation" : "basket_difference";
```

Med produktsammenligningslogik:
- Hvis annullering → `"cancellation"`
- Ellers: tjek om produktet er i `phone_excluded_products` → `"correct_match"`
- Ellers: sammenlign `sale.targetProductName` vs `sale.realProductName` (case-insensitive trim)
  - Match → `"correct_match"`
  - Ingen match → `"basket_difference"`

**2. `ApprovalQueueTab.tsx`**

- Udvid `subTab` state type med `"correct_match"`
- Tilføj `correctMatchCount` (samme mønster som `cancellationCount`/`basketCount`)
- Tilføj ny `TabsTrigger` "Korrekte match" med tæller
- Tilføj `TabsContent` for `"correct_match"` der bruger `renderTable()`
- Ingen "Godkend alle"-knap på denne fane (de er allerede korrekte)

### Teknisk detalje

- `phone_excluded_products` er allerede tilgængelig via `activeConfig` / `activeQueueConfig` i upload-flowet
- I ApprovalQueueTab hentes den via queue-itemets `upload_type` felt — ingen ekstra data nødvendig
- `upload_type` er en fri string-kolonne, så `"correct_match"` kræver ingen migration

