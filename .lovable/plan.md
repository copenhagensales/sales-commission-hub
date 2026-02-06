
# Plan: Tilføj Bi-salg kolonne til Relatel Dashboard

## Oversigt
Tilføj en "Bi-salg" kolonne til alle tre leaderboard-tabeller i Relatel dashboardet. Bi-salg tælles fra produkter der har `counts_as_cross_sale = true` i MG Test.

---

## Nuværende situation

- Produkter kan markeres som "Tæl som bisalg" i MG Test (kolonne: `counts_as_cross_sale`)
- Der findes aktuelt 129 bi-salg i lønperioden for Relatel
- Leaderboard-cachen indeholder kun `salesCount` og `commission` - ikke cross-sales

---

## Ændringer

### 1. Udvid LeaderboardEntry interface

Tilføj `crossSaleCount` til leaderboard data-strukturen:

```text
LeaderboardEntry {
  employeeId: string
  employeeName: string
  salesCount: number
  commission: number
  crossSaleCount: number  <-- NY
  ...
}
```

### 2. Opdater calculate-leaderboard-incremental

Ændre edge function til at tælle cross-sales:

- Hent `counts_as_cross_sale` flag sammen med `counts_as_sale`
- Opret `crossSaleProductIds` set (produkter hvor `counts_as_cross_sale = true`)
- Tæl cross-sales separat fra normale salg
- Gem `crossSaleCount` i leaderboard_data

### 3. Opdater useCachedLeaderboard hook

Udvid `LeaderboardEntry` interface i `src/hooks/useCachedLeaderboard.ts`:

```text
export interface LeaderboardEntry {
  ...
  crossSaleCount: number;  <-- NY
}
```

### 4. Opdater RelatelDashboard UI

Tilføj "Bi-salg" kolonne til alle tre tabeller:

```text
┌────┬─────────────┬──────┬─────────┬───────────┐
│ #  │ Navn        │ Salg │ Bi-salg │ Provision │
├────┼─────────────┼──────┼─────────┼───────────┤
│ 1  │ Jonas J.    │ 72   │ 12      │ 84.375 kr │
│ 2  │ Thorbjørn W.│ 63   │ 8       │ 70.186 kr │
└────┴─────────────┴──────┴─────────┴───────────┘
```

---

## Berørte filer

| Fil | Handling |
|-----|----------|
| `supabase/functions/calculate-leaderboard-incremental/index.ts` | Tilføj cross-sale tracking |
| `src/hooks/useCachedLeaderboard.ts` | Udvid interface |
| `src/pages/RelatelDashboard.tsx` | Tilføj Bi-salg kolonne |

---

## Teknisk implementering

### Edge function ændringer

```text
// Hent både counts_as_sale og counts_as_cross_sale
const { data: products } = await supabase
  .from("products")
  .select("id, counts_as_sale, counts_as_cross_sale, commission_dkk")
  .in("id", productIds);

// Opret sets
countingProductIds = new Set(products.filter(p => p.counts_as_sale !== false).map(p => p.id));
crossSaleProductIds = new Set(products.filter(p => p.counts_as_cross_sale === true).map(p => p.id));

// I calculateLeaderboard function:
// Tæl cross-sales for hvert sale_item
for (const item of items) {
  if (item.product_id && crossSaleProductIds.has(item.product_id)) {
    crossSales += item.quantity || 1;
  }
}
```

### Dashboard kolonne

```text
<TableHead className="text-right">Bi-salg</TableHead>
...
<TableCell className="text-right py-2 text-muted-foreground">
  {seller.crossSaleCount || 0}
</TableCell>
```

---

## Dataflow

```text
MG Test: Produkt markeres som "Tæl som bisalg"
              ↓
products.counts_as_cross_sale = true
              ↓
calculate-leaderboard-incremental kører (hvert 2. min)
              ↓
Tæller cross-sales per sælger → gemmes i leaderboard_data
              ↓
RelatelDashboard henter cached data
              ↓
Viser Bi-salg kolonne med antal
```

---

## Bemærkninger

- Ændringen kræver at edge function deployes og køres mindst én gang
- Indtil cachen opdateres, vil kolonnen vise 0
- Bi-salg tælles uafhængigt af normale salg (et produkt kan være både)
