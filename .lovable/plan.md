

## Fix: Manuelle matches vises ikke + falske dubletter i Godkendelseskø

### Problem 1: Manuelle matches fra "Fejl i match" mangler `target_product_name`
Når rækker manuelt matches i `MatchErrorsSubTab` og indsættes i `cancellation_queue`, sættes `target_product_name` ikke. For Eesy TM filtreres `saleItems` kun til det målrettede produkt, når `target_product_name` er sat (linje 515-520). Uden det vises **alle** produkter fra salget — dette kan forvirre, men rækkerne burde stadig vises under "Annulleringer" da `upload_type` er "cancellation".

**Mulig årsag til at de ikke vises**: Hvis `import_id` fra den manuelle match peger på en import der ikke har en `config_id`, kan `mapping` blive `null`, hvilket påvirker `computeDiff`. Men rækkerne burde stadig fremgå i listen.

→ Skal bekræftes: Kan du uploade et screenshot af "Fejl i match" fanen og "Annulleringer" fanen for at vise hvad der mangler?

### Problem 2: Falske "Dublet" badges for Eesy TM
Dedup-nøglen i godkendelseskøen er `sale_id|target_product_name`. Når ét salg har flere abonnementer med **samme produktnavn** (f.eks. "Fri tale + 70 GB data (5G)") men **forskellige telefonnumre**, flagges de som dubletter — selvom de er legitime separate annulleringer.

**Eksempel fra screenshot**: Salg med Abo1 (23616630) og Abo2 (23614960) har begge produktnavnet "Fri tale + 70 GB data (5G) (6 mdr. binding)". Dedup-nøglen er identisk → falsk dublet.

### Løsning

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`**

#### Ændring 1: Inkluder telefonnummer i Eesy TM dedup-nøgle (linje 631-653)
Udvid dedup-nøglen til `sale_id|target_product_name|phone` for Eesy TM, så forskellige abonnementer med samme produkt ikke flagges som dubletter:

```typescript
const key = isEesyTm
  ? `${(item.sale_id || "").trim()}|${(item.target_product_name || "").trim()}|${(item.phone || "").trim()}`
  : (item.phone || "").trim();
```

Samme ændring i `duplicateCount` (linje 650).

#### Ændring 2: Tilføj `target_product_name` til manuelle matches (MatchErrorsSubTab.tsx, linje 382-389)
Når en manuel match indsættes, resolve `target_product_name` ved at slå salgets primære `sale_item` op:

```typescript
// After confirming the sale, fetch its primary sale_item for target_product_name
const saleIds = entries.map(e => e.saleId);
const { data: saleItemsData } = await supabase
  .from("sale_items")
  .select("sale_id, adversus_product_title")
  .in("sale_id", saleIds);

const saleItemMap = new Map<string, string>();
for (const si of (saleItemsData || [])) {
  if (!saleItemMap.has(si.sale_id)) {
    saleItemMap.set(si.sale_id, si.adversus_product_title || "");
  }
}

const inserts = entries.map(({ saleId, row: r }) => ({
  import_id: r.importId,
  sale_id: saleId,
  upload_type: r.uploadType === "both" ? "cancellation" : r.uploadType,
  status: "pending",
  uploaded_data: r.rowData as unknown as Json,
  client_id: clientId,
  target_product_name: saleItemMap.get(saleId) || null,
}));
```

### Konsekvens
- **Dublet-badges**: Forsvinder for legitime separate abonnements-annulleringer med samme produkt
- **Manuelle matches**: Får `target_product_name` sat korrekt, så produktfiltrering i godkendelseskøen fungerer
- **Andre klienter**: Uberørte (dedup-ændring er kun for Eesy TM-grenen)

