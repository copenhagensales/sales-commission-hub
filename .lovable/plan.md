

## Fix: Udvid Eesy TM-matching til alle Abo-felter (ikke kun Abo1-3)

### Problem fundet
Eesy TM's `product_phone_mappings` dækker kun `Telefon Abo1`, `Abo2`, `Abo3`. Men databasen viser:
- **142 salg** med `Telefon Abo4`
- **60 salg** med `Telefon Abo5`  
- **10 salg** med `Abo6`, **4** med `Abo7`, **1** med `Abo8`

Salg med op til 8 abonnementer har også 5+ `sale_items`. Når en Excel-annulleringsrække indeholder et telefonnummer der kun findes i Abo4-8, kan hverken Pass 1 (tjekker kun Abo1-3) eller Pass 1b (tjekker `customer_phone`) finde det.

### Løsning
For **Eesy TM** udvides Pass 1 til dynamisk at scanne ALLE `Telefon Abo*`-felter i `raw_payload.data`, i stedet for kun at bruge de 3 konfigurerede mappings.

### Teknisk ændring

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`** — Pass 1 matchingloop (~linje 1146-1193)

Tilføj dynamisk Abo-scanning for Eesy TM inden i sale-loopet:

```typescript
// Inside the sale loop, for Eesy TM: dynamically find ALL Telefon Abo fields
if (selectedClientId === CLIENT_IDS["Eesy TM"]) {
  const payloadData = (sale.raw_payload as any)?.data || {};
  
  // Collect all "Telefon AboN" fields dynamically
  const aboEntries: { field: string; index: number }[] = [];
  for (const key of Object.keys(payloadData)) {
    const match = key.match(/^Telefon Abo(\d+)$/);
    if (match) {
      aboEntries.push({ field: key, index: parseInt(match[1], 10) });
    }
  }
  
  for (const abo of aboEntries) {
    const payloadPhoneRaw = payloadData[abo.field];
    if (!payloadPhoneRaw) continue;
    const payloadPhone = normalizePhone(String(payloadPhoneRaw));
    if (!payloadPhone || payloadPhone !== excelPhone) continue;
    
    // Resolve matching sale_item by position (0-indexed)
    const allItems = saleItemsMap.get(sale.id) || [];
    const posIndex = abo.index - 1;
    const matchingItem = posIndex >= 0 && posIndex < allItems.length 
      ? allItems[posIndex] : allItems[0];
    
    // Dedup by resolved product name
    const resolvedName = matchingItem?.adversus_product_title || `Abonnement${abo.index}`;
    const key = `${sale.id}|${resolvedName}`;
    if (matchedSaleProductKeys.has(key)) continue;
    matchedSaleProductKeys.add(key);
    matchedIndicesLocal.add(idx);
    
    productMatched.push({
      saleId: sale.id,
      phone: String(payloadPhoneRaw),
      company: sale.customer_company || "",
      oppNumber: "",
      saleDate: sale.sale_datetime || "",
      employee: sale.agent_name || "Ukendt",
      currentStatus: sale.validation_status || "pending",
      uploadedRowData: row.originalRow,
      targetProductName: matchingItem?.adversus_product_title || `Abonnement${abo.index}`,
      realProductName: matchingItem?.adversus_product_title || allItems[0]?.adversus_product_title || "Ukendt produkt",
      commission: matchingItem?.mapped_commission ?? undefined,
      revenue: matchingItem?.mapped_revenue ?? undefined,
    });
    break; // One match per Excel row
  }
  if (matchedIndicesLocal.has(idx)) break; // Move to next Excel row
}
```

Denne erstatning **erstatter** den eksisterende mapping-baserede loop for Eesy TM. De konfigurerede mappings (Abo1-3) bruges fortsat for andre klienter.

### Konsekvens
- Abo4-8 matcher nu korrekt → op til **217 flere salg** kan matches
- Abo1-3 fungerer uændret (samme logik, dynamisk fundet)
- Andre klienter: Uberørte (bruger stadig konfigurerede mappings)
- Dedup-logik bevares (sale_id + resolved product name)

