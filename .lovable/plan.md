
# Produktopdeling i Dagsrapporter

## Hvad skal tilfojes
Naar man ser dagsrapporten, skal man kunne se hvilke produkter der er solgt, antal pr. produkt, provision pr. produkt, og samlet provision/omsaetning. Dette vises som en udvidelig sektion under hver medarbejder (eller under hver dag i multi-dag visning).

## Overordnet design
- Klik paa en medarbejder-raekke aabner en produktopdeling under raekken
- For enkeldag: viser produkter direkte under medarbejderen
- For multi-dag: foerst dagsopdeling (eksisterende), derefter produktopdeling under hele medarbejderen eller under hver dag
- Produktopdelingen viser: produktnavn, antal solgt, provision pr. produkt, omsaetning pr. produkt

## Teknisk plan

### 1. Udvid DailyEntry interface
Tilfoej et `products` felt til `DailyEntry` der indeholder produktniveau-data:

```typescript
interface ProductSaleDetail {
  product_name: string;
  quantity: number;
  commission: number;
  revenue: number;
}

interface DailyEntry {
  // ... eksisterende felter
  product_details: ProductSaleDetail[];
}
```

Tilfoej ogsaa `product_details` paa `EmployeeReportData` for samlet produktopdeling.

### 2. Udvid data-fetching
I select-clause for sales (linje ~554), tilfoej produktnavn:
- Aendr `sale_items(quantity,mapped_commission,mapped_revenue,product_id,products(counts_as_sale))` til `sale_items(quantity,mapped_commission,mapped_revenue,product_id,products(name,counts_as_sale))`

### 3. Aggreger produktdata i beregningslogikken
I loopet der behandler sale_items (linje ~835-846):
- Opbyg en Map pr. dag med produktnavn som noegle
- Aggreger quantity, commission og revenue pr. produkt
- Tilfoej den aggregerede produktliste til `DailyEntry.product_details`
- Saml ogsaa en total produktopdeling paa medarbejderniveau i `EmployeeReportData.product_details`

### 4. Tilfoej fieldmarketing-produkter
FM-salg (linje ~849-860) bruger allerede `fm_product_name` fra raw_payload - dette skal ogsaa inkluderes i produkt-aggregeringen.

### 5. Vis produktopdeling i UI
Under den udvidede medarbejder-raekke (efter dagsopdeling eller direkte for enkeltdag):
- Vis en undertabel med kolonner: Produkt | Antal | Provision | Omsaetning
- Sorteret efter antal (hoejest foerst)
- Vis en summerings-raekke med totaler
- Stilmaessigt: let baggrund (bg-muted/20), indrykning for at indikere hierarki

### 6. Filer der aendres
- `src/pages/reports/DailyReports.tsx` - eneste fil der skal aendres:
  - Udvid interfaces (DailyEntry, EmployeeReportData)
  - Udvid select-clause til at inkludere produktnavne
  - Tilfoej produktaggregering i beregningsloopet
  - Tilfoej produktopdeling i tabel-renderingen (expandable section)
