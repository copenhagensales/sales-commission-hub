
# Plan: Tilføj "Centre/Boder udgift" kolonne for Eesy FM og Yousee

## Overblik
Tilføjer en ny kolonne i tabellen "Omsætning per klient" der viser lokationsudgifterne (centre og boder) for Eesy FM og Yousee. Udgifterne beregnes fra booking-tabellen baseret på dagspris × antal dage.

---

## Tekniske ændringer

### 1. Udvid ClientRevenueData interface
**Fil:** `src/pages/reports/RevenueByClient.tsx` (linje 25-34)

Tilføj ny property for lokationsudgifter:
```typescript
interface ClientRevenueData {
  clientId: string;
  clientName: string;
  salesCount: number;
  totalRevenue: number;
  totalCommission: number;
  totalVacationPay: number;
  totalEarnings: number;
  avgRevenue: number;
  locationCosts?: number; // Ny: Centre/boder udgift
}
```

---

### 2. Hent booking-data for Eesy FM og Yousee
**Fil:** `src/pages/reports/RevenueByClient.tsx` (tilføj i useQuery ~linje 240-250)

Tilføj forespørgsel til booking-tabellen for at beregne lokationsudgifter:
```typescript
// FM Client IDs
const EESY_FM_ID = "9a92ea4c-6404-4b58-be08-065e7552d552";
const YOUSEE_ID = "5011a7cd-bf07-4838-a63f-55a12c604b40";

// Hent bookinger for perioden med lokationsdata
const { data: bookings } = await supabase
  .from("booking")
  .select(`
    id,
    client_id,
    start_date,
    end_date,
    booked_days,
    daily_rate_override,
    total_price,
    location(id, daily_rate)
  `)
  .in("client_id", [EESY_FM_ID, YOUSEE_ID])
  .gte("start_date", startDateStr)
  .lte("start_date", endDateStr);
```

---

### 3. Beregn lokationsudgifter per klient
**Fil:** `src/pages/reports/RevenueByClient.tsx` (tilføj efter booking-hentning)

Beregningslogik (samme som i Billing.tsx):
```typescript
// Aggreger lokationsudgifter per klient
const locationCostsByClient: Record<string, number> = {};

bookings?.forEach((booking) => {
  const clientId = booking.client_id;
  if (!clientId) return;
  
  let bookingTotal: number;
  
  if (booking.total_price != null) {
    // Markeder: brug samlet pris
    bookingTotal = booking.total_price;
  } else {
    // Butikker/centre: dagspris × antal dage
    const dailyRate = booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000;
    const days = booking.booked_days?.length || 
      (differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1);
    bookingTotal = dailyRate * days;
  }
  
  locationCostsByClient[clientId] = (locationCostsByClient[clientId] || 0) + bookingTotal;
});
```

---

### 4. Tilføj lokationsudgifter til clientSummary
**Fil:** `src/pages/reports/RevenueByClient.tsx` (i useMemo ~linje 358-368)

Tilføj locationCosts til summary:
```typescript
summary.push({
  clientId,
  clientName: clientNames[clientId] || "Ukendt",
  salesCount: totalSales,
  totalRevenue,
  totalCommission,
  totalVacationPay,
  totalEarnings,
  avgRevenue: totalSales > 0 ? totalRevenue / totalSales : 0,
  locationCosts: locationCostsByClient[clientId] || 0, // Ny linje
});
```

---

### 5. Tilføj ny kolonne i tabellen
**Fil:** `src/pages/reports/RevenueByClient.tsx` (linje 561-570)

Tilføj kolonne-header:
```typescript
<TableHead className="text-right">Centre/Boder</TableHead>
```

Tilføj data-celle (kun for Eesy FM og Yousee):
```typescript
<TableCell className="text-right text-orange-500">
  {(client.clientId === EESY_FM_ID || client.clientId === YOUSEE_ID) 
    ? `${Math.round(client.locationCosts || 0).toLocaleString("da-DK")} kr`
    : "-"
  }
</TableCell>
```

---

## Visuel ændring

| Klient | ... | Centre/Boder | Indtjening | Gns. per salg |
|--------|-----|--------------|------------|---------------|
| Eesy FM | ... | 45.000 kr | 24.256 kr | 350 kr |
| Yousee | ... | 32.500 kr | 18.100 kr | 280 kr |
| Tryg | ... | - | 15.000 kr | 420 kr |

---

## Fil der ændres
- `src/pages/reports/RevenueByClient.tsx`

---

## Beregningseksempel
For en periode med 3 bookinger:
- SuperBrugsen (5 dage × 1.000 kr) = 5.000 kr
- Herning K6 (5 dage × 1.500 kr) = 7.500 kr
- Kvickly Farum (5 dage × 1.000 kr) = 5.000 kr
- **Total for Eesy FM: 17.500 kr**

Denne logik matcher eksakt den der bruges i Faktureringsrapporten (`/vagt-flow/billing`).
