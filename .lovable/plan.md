

## Plan: Ekskluder phone_excluded produkter fra dublet-detektering

### Problem
Phone_excluded produkter (f.eks. 5G Internet) har irrelevante/placeholder telefonnumre, som skaber falske "Dublet"-markeringer i godkendelseskøen.

### Løsning

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`**

1. **Udvid config-fetch** — tilføj `phone_excluded_products` til `cancellation_upload_configs` select-query (linje ~414)

2. **Udvid `ColumnMapping` interface** — tilføj `phone_excluded_products: string[]`

3. **Marker items som phone_excluded i flatItems** — i mapping-fasen (linje ~451-478), tjek om rækkens produkt (fra `uploaded_data` via product_columns) matcher et phone_excluded produkt. Tilføj `isPhoneExcluded: boolean` til `FlatQueueRow`

4. **Filtrér dublet-logikken** (linje ~536-547) — spring items over hvor `isPhoneExcluded === true`:
```typescript
const duplicatePhones = useMemo(() => {
  const phoneCounts = new Map<string, number>();
  for (const item of flatItems) {
    if (item.isPhoneExcluded) continue; // Skip phone_excluded produkter
    const phone = (item.phone || "").trim();
    if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
  }
  // ...
}, [flatItems]);
```

5. **Opdater dublet-badge rendering** (linje ~1131) — vis ikke "Dublet" badge for phone_excluded items

### Filer
| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/ApprovalQueueTab.tsx` | Alt ovenfor — interface, config-fetch, isPhoneExcluded flag, dublet-filtrering |

