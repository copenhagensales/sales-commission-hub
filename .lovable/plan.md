
# Fix: TV Dashboard viser ikke Fieldmarketing salg

## Problem
TV-skærmen viser 115 salg, mens PC-dashboardet viser 124 salg. Forskellen er 9 "Eesy FM" salg der mangler på TV.

## Årsag
Edge function `tv-dashboard-data` (linje 247-268) forsøger at hente `fieldmarketing_sales` med en ugyldig join til `sale_items`:

```typescript
// NUVÆRENDE KODE (FEJLER)
.select(`
  id, client_id, seller_name, registered_at,
  sale_items (...)  // ← Ingen FK relation eksisterer!
`)
```

Supabase returnerer fejl `PGRST200` og 0 FM salg.

PC-dashboardet bruger korrekt query uden `sale_items` join.

## Løsning

### Ændring i `supabase/functions/tv-dashboard-data/index.ts`

**1. Ret FM-query (linje 247-268)**

Fjern den ugyldige `sale_items` join og brug samme mønster som PC-dashboardet:

```typescript
// EFTER (VIRKER)
const { data: fmSalesData, error: fmError } = await supabase
  .from("fieldmarketing_sales")
  .select(`
    id,
    client_id,
    seller_id,
    registered_at
  `)
  .gte("registered_at", startOfDay)
  .lte("registered_at", endOfDay);
```

**2. Simplificer FM-processing (linje 378-416)**

Da FM salg ikke har `sale_items`, tæl hvert salg som 1:

```typescript
// Process fieldmarketing sales - each counts as 1 sale
for (const fmSale of fmSales) {
  const clientId = fmSale.client_id;
  let clientName = clientId ? clientMap[clientId] || "Ukendt FM" : "Ukendt FM";

  // FM salg tælles som 1 (ingen sale_items)
  if (!salesByClient[clientName]) {
    salesByClient[clientName] = { count: 0, logoUrl: clientLogoMap[clientName] || null };
  }
  salesByClient[clientName].count += 1;
  totalCountedSales += 1;

  // Track FM seller for sellersOnBoard count
  if (fmSale.seller_id) {
    sellersWithSales.add(fmSale.seller_id);
  }
}
```

## Påvirkede filer
- `supabase/functions/tv-dashboard-data/index.ts`

## Forventet resultat
- TV-skærm vil vise 124 total salg (samme som PC)
- "Eesy FM" vil vises i "Salg per opgave" med 9 salg
- "Sælgere på tavlen" vil inkludere FM-sælgere
