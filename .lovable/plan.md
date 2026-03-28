

## Plan: Fix type-klassificering (OR-logik) + dublet-visning

### Problem 1: Forkert type-klassificering
Eesy FM config har `type_detection_column = null` og `type_detection_values = null`. Logikken falder derfor tilbage til hardcodet "Annulled Sales"-check. Rækker med `Current Status = "Nedlagt"` men tom `Annulled Sales` klassificeres fejlagtigt som kurvrettelse.

**Løsning**: To ændringer:

**A. Opdater Eesy FM config i databasen** (via insert tool):
```sql
UPDATE cancellation_upload_configs 
SET type_detection_column = 'Current Status',
    type_detection_values = '["Nedlagt", "Aktiv men opsagt", "Afventer opgørelse", "Afvist af System", "Saldospærret"]'::jsonb
WHERE id = '0606d7ab-3872-4dcf-aa72-080d84ebe90e';
```

**B. Ændr logikken til OR-kombination** i `UploadCancellationsTab.tsx` (linje 1514-1526 + preview linje 1943-1960):

Nuværende logik bruger enten konfigureret kolonne ELLER "Annulled Sales" fallback. Ny logik checker **begge** med OR:

```typescript
if (uploadType === "both") {
  const typeCol = activeQueueConfig?.type_detection_column;
  const typeVals = (activeQueueConfig?.type_detection_values as string[]) || [];
  
  let isConfiguredCancellation = false;
  if (typeCol && typeVals.length > 0) {
    const cellVal = String(getCaseInsensitive(sale.uploadedRowData, typeCol) || "").trim().toLowerCase();
    isConfiguredCancellation = typeVals.some(v => v.toLowerCase() === cellVal);
  }
  
  const annulledVal = String(getCaseInsensitive(sale.uploadedRowData, "Annulled Sales") || "").trim();
  const isAnnulledSales = annulledVal !== "" && annulledVal !== "0";
  
  rowUploadType = (isConfiguredCancellation || isAnnulledSales) ? "cancellation" : "basket_difference";
}
```

Samme OR-logik opdateres i preview-badge (linje ~1943-1960).

---

### Problem 2: Dubletter vises ikke i godkendelseskøen

`ApprovalQueueTab.tsx` har ingen dublet-detektering overhovedet.

**Løsning**: Tilføj dublet-markering i `ApprovalQueueTab.tsx`:

1. **Detekter dubletter**: I en `useMemo`, byg et `Map<telefonnummer, antal>` fra alle pending items. Telefonnumre med >1 forekomst er dubletter.
2. **Vis badge**: Tilføj en orange "Dublet" `Badge` på rækker med duplikeret telefonnummer.
3. **Filter-toggle**: Tilføj en "Kun dubletter" knap/toggle i toolbar der filtrerer til kun dublet-rækker.

### Filer der ændres
1. **Database** (insert tool) — Opdater Eesy FM config med type_detection_column/values
2. **`src/components/cancellations/UploadCancellationsTab.tsx`** — OR-logik i queue-building + preview badge
3. **`src/components/cancellations/ApprovalQueueTab.tsx`** — Dublet-detektering, badge og filter

