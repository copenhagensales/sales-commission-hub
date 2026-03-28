

## Problem: Forkert type-klassificering ved upload type "Begge"

### Analyse

Når brugeren vælger **"Begge"** (kombineret fil med annulleringer og kurvrettelser), afgør systemet typen for hver række med denne hardcodede logik (linje 1478-1480):

```typescript
if (uploadType === "both") {
  const annulledVal = String(getCaseInsensitive(sale.uploadedRowData, "Annulled Sales") || "").trim();
  rowUploadType = annulledVal ? "cancellation" : "basket_difference";
}
```

**Problemet**: Systemet leder efter en kolonne kaldet `"Annulled Sales"`. Hvis denne kolonne ikke eksisterer i filen (eller er tom), klassificeres **alle rækker som `basket_difference`** — også rækker der tydeligt er annulleringer (fx med status "Nedlagt" eller årsag "Brug af fortrydelsesret").

Der findes ingen konfigurerbar indstilling i `cancellation_upload_configs` til at styre, hvilken kolonne og værdi der bestemmer typen.

### Løsning: Konfigurerbar type-detektering

**1. Database: Tilføj to nye kolonner til `cancellation_upload_configs`**

```sql
ALTER TABLE cancellation_upload_configs
  ADD COLUMN type_detection_column TEXT DEFAULT NULL,
  ADD COLUMN type_detection_values JSONB DEFAULT NULL;
```

- `type_detection_column`: Kolonnen i Excel-filen der skal bruges til at afgøre typen (fx `"Status"`, `"Årsag"`, `"Type"`)
- `type_detection_values`: JSON-array med værdier der indikerer annullering (fx `["Nedlagt", "Annulleret", "Brug af fortrydelsesret"]`)

**2. Upload config UI: Tilføj type-detekteringsfelter**

I opsætnings-dialogen (ConfigWizard), tilføj to nye felter der kun vises når relevant:
- "Type-kolonne" dropdown (vælg fra Excel-kolonner)
- "Annulleringsværdier" inputfelt (komma-separeret liste over værdier der betyder annullering)

**3. Opdater type-klassificeringslogikken (linje 1478-1480)**

Erstat den hardcodede `"Annulled Sales"`-logik med:

```typescript
if (uploadType === "both") {
  const typeCol = activeConfig?.type_detection_column;
  const typeVals = (activeConfig?.type_detection_values as string[]) || [];
  if (typeCol && typeVals.length > 0) {
    const cellVal = String(getCaseInsensitive(sale.uploadedRowData, typeCol) || "").trim().toLowerCase();
    rowUploadType = typeVals.some(v => v.toLowerCase() === cellVal) ? "cancellation" : "basket_difference";
  } else {
    // Fallback: gammel logik
    const annulledVal = String(getCaseInsensitive(sale.uploadedRowData, "Annulled Sales") || "").trim();
    rowUploadType = annulledVal ? "cancellation" : "basket_difference";
  }
}
```

**4. Opdater preview-tabellens type-badge (linje 1898-1905)**

Brug samme konfigurerede logik til at vise korrekt type-badge i forhåndsvisningen.

**5. UploadConfig interface: Tilføj de nye felter**

Tilføj `type_detection_column` og `type_detection_values` til `UploadConfig`-interfacet og sikre de gemmes/hentes korrekt.

### Filer der ændres
- **Migration**: Ny kolonne `type_detection_column` + `type_detection_values` på `cancellation_upload_configs`
- **`src/components/cancellations/UploadCancellationsTab.tsx`**: Interface, config wizard UI, og type-klassificeringslogik

