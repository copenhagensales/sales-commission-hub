
# Plan: Tilføj Indtjening (Profit) per Klient

## Overblik
Denne plan tilføjer en ny kolonne i tabellen der viser **netto indtjening** per klient. Beregningen er:

**Indtjening = Omsætning - Provision - Feriepenge (12.5% af provision)**

---

## Hvad ændres

### Tabel-ændringer
Tabellen får 2 nye kolonner:
| Klient | Antal salg | Total omsætning | **Provision + feriepenge** | **Indtjening** | Gns. per salg |
|--------|------------|-----------------|---------------------------|----------------|---------------|

- **Provision + feriepenge**: Viser total sælgerløn inkl. 12.5% feriepenge
- **Indtjening**: Omsætning minus (provision × 1.125)

### Nyt summary card
Et nyt kort viser total indtjening for perioden med grøn/blå farve.

---

## Tekniske detaljer

### Data-hentning
Udvid `sale_items` query til at inkludere `mapped_commission`:
```typescript
.select("sale_id, mapped_revenue, mapped_commission, product_id")
```

Hent også `commission_dkk` fra `product_campaign_overrides` og `products` tabellen for at kunne beregne FM-commission korrekt.

### Aggregerings-logik
Opdater `revenueByClientAndDate` strukturen til at tracke både revenue og commission:
```typescript
Record<string, Record<string, { 
  count: number; 
  revenue: number; 
  commission: number;  // NYT
}>>
```

### Beregnings-formel
For hver klient:
1. Sum af commission fra alle sale_items
2. Feriepenge = commission × 0.125
3. Total lønomkostning = commission + feriepenge = commission × 1.125
4. Indtjening = omsætning - total lønomkostning

### Campaign Override Håndtering
Samme logik som for revenue - tjek `product_campaign_overrides.commission_dkk` før fallback til `mapped_commission`.

### FM Sales
For fieldmarketing sales bruges `products.commission_dkk` da disse ikke har `sale_items`.

### Interface udvidelse
```typescript
interface ClientRevenueData {
  clientId: string;
  clientName: string;
  salesCount: number;
  totalRevenue: number;
  totalCommission: number;      // NYT
  totalVacationPay: number;     // NYT (12.5%)
  totalEarnings: number;        // NYT (revenue - commission - vacation)
  avgRevenue: number;
}
```

---

## Opsummering
- **Filer der ændres**: `src/pages/reports/RevenueByClient.tsx`
- **Nye data-punkter**: Commission + feriepenge + indtjening per klient
- **Visuel ændring**: 2 nye kolonner i tabel + nyt summary card
