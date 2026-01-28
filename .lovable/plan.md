
# Plan: Integrer Fieldmarketing Salg i CPH Sales Dashboard

## Oversigt

Integrerer fieldmarketing salg (Eesy FM og YouSee) i CPH Sales dashboardet, så de vises korrekt i "Salg per opgave", dagens salgstal, team performance og bruger pre-computed KPIs fra backend.

## Nuværende Status

Backend edge function (`calculate-kpi-values`) inkluderer allerede FM salg i:
- Cached KPIs (`sales_count`, `total_commission`, `total_revenue`)
- Leaderboard cache (Top 20 sælgere)

Men frontend dashboardet har flere direkte database queries der kun henter fra `sales` tabellen.

---

## Ændringer

### 1. Opdater "Salg per opgave" sektion

**Fil:** `src/pages/dashboards/CphSalesDashboard.tsx`

Tilføj en separat query til at hente fieldmarketing salg for dagen og merge dem ind i `displaySalesByClient`:

```typescript
// Ny query: Hent dagens fieldmarketing salg
const { data: fmTodaySales = [] } = useQuery({
  queryKey: ["cph-dashboard-fm-sales", todayStr],
  queryFn: async () => {
    const startOfDay = `${todayStr}T00:00:00`;
    const endOfDay = `${todayStr}T23:59:59`;
    
    const { data, error } = await supabase
      .from("fieldmarketing_sales")
      .select(`
        id, product_name, registered_at, seller_id,
        client:clients!client_id(id, name, logo_url),
        seller:employee_master_data!seller_id(first_name, last_name)
      `)
      .gte("registered_at", startOfDay)
      .lte("registered_at", endOfDay);
    
    if (error) throw error;
    return data || [];
  },
  enabled: !tvMode,
  refetchInterval: 60000,
});
```

### 2. Merge FM salg med TM salg i "Salg per opgave"

Opdater `displaySalesByClient` beregningen til at inkludere FM salg:

```typescript
// Kombiner FM salg med eksisterende client sales
const getSalesByClientWithLogos = (): Record<string, { count: number; logoUrl: string | null }> => {
  const byClient = calculateSalesByClient(knownClientSales);
  
  // Tilføj FM salg
  for (const fmSale of fmTodaySales) {
    const clientName = fmSale.client?.name;
    const logoUrl = fmSale.client?.logo_url;
    if (clientName) {
      if (!byClient[clientName]) {
        byClient[clientName] = 0;
      }
      byClient[clientName]++;
    }
  }
  
  // Konverter til format med logos
  const result: Record<string, { count: number; logoUrl: string | null }> = {};
  for (const [client, count] of Object.entries(byClient)) {
    const fmClientLogo = fmTodaySales.find(s => s.client?.name === client)?.client?.logo_url;
    result[client] = { 
      count, 
      logoUrl: clientLogos[client] || fmClientLogo || null 
    };
  }
  return result;
};
```

### 3. Opdater "Salg i dag" totalt antal

Kombiner telesales og FM salg tal:

```typescript
const displaySalesTotal = tvMode && tvData 
  ? tvData.sales.total 
  : calculateCountedSales(knownClientSales) + fmTodaySales.length;
```

### 4. Opdater "Sælgere på tavlen"

Inkluder unikke FM sælgere i optællingen:

```typescript
const calculateSellersOnBoard = (sales: typeof todaySales) => {
  const sellersWithSales = new Set<string>();
  
  // Telesales sælgere
  for (const sale of sales) {
    const saleItems = (sale as any).sale_items || [];
    const hasCountedSale = saleItems.some((item: any) => item.products?.counts_as_sale === true);
    if (hasCountedSale && sale.agent_name) {
      sellersWithSales.add(sale.agent_name.toLowerCase());
    }
  }
  
  // FM sælgere
  for (const fmSale of fmTodaySales) {
    const sellerName = fmSale.seller 
      ? `${fmSale.seller.first_name} ${fmSale.seller.last_name}`.toLowerCase()
      : null;
    if (sellerName) {
      sellersWithSales.add(sellerName);
    }
  }
  
  return sellersWithSales.size;
};
```

### 5. Opdater Team Performance

Tilføj FM salg til team performance beregningen i `teamPerformanceData` queryen:

```typescript
// Hent FM salg for måneden
const { data: fmSalesData } = await supabase
  .from("fieldmarketing_sales")
  .select("id, seller_id, client_id, registered_at")
  .gte("registered_at", `${monthStart}T00:00:00`)
  .lte("registered_at", `${todayStr}T23:59:59`);

// Byg seller_id -> team_id map
const sellerToTeam: Record<string, string> = {};
(teamMembers || []).forEach((tm: any) => {
  sellerToTeam[tm.employee_id] = tm.team_id;
});

// Tilføj FM salg til team totals
(fmSalesData || []).forEach((fmSale: any) => {
  const teamId = sellerToTeam[fmSale.seller_id];
  if (!teamId || !teamSales[teamId]) return;
  
  const saleDate = fmSale.registered_at.split("T")[0];
  
  teamSales[teamId].month += 1;
  if (saleDate >= weekStart) teamSales[teamId].week += 1;
  if (saleDate === todayStr) teamSales[teamId].day += 1;
  
  // Find client name for this FM sale via client_id
  const fmClientInfo = teamToClients[teamId]?.find(c => c.clientId === fmSale.client_id);
  if (fmClientInfo && teamClientSales[teamId][fmClientInfo.clientName]) {
    teamClientSales[teamId][fmClientInfo.clientName].month += 1;
    if (saleDate >= weekStart) teamClientSales[teamId][fmClientInfo.clientName].week += 1;
    if (saleDate === todayStr) teamClientSales[teamId][fmClientInfo.clientName].day += 1;
  }
});
```

---

## Teknisk Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                    CPH Sales Dashboard                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. "Salg per opgave" kort                                      │
│     └─> Henter sales (TM) + fieldmarketing_sales (FM)           │
│     └─> Merger til samlet visning per klient                    │
│     └─> Eesy FM og Yousee FM vises med deres logos              │
│                                                                 │
│  2. "Salg i dag" total                                          │
│     └─> TM counted sales + FM sales count                       │
│                                                                 │
│  3. "Sælgere på tavlen"                                         │
│     └─> Unique sælgere fra TM + FM                              │
│                                                                 │
│  4. Team Performance tabs                                       │
│     └─> Inkluderer FM salg i dag/uge/måned totaler              │
│                                                                 │
│  5. Top 20 Sælgere (allerede korrekt)                           │
│     └─> Bruger useCachedLeaderboard som inkluderer FM           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/dashboards/CphSalesDashboard.tsx` | Tilføj FM query, merge salgsdata, opdater team performance |

---

## Resultat

- "Eesy FM" og "Yousee" salg vises i "Salg per opgave" kort med logos
- Dagens samlede salgstal inkluderer FM salg
- Team performance inkluderer FM salg i dag/uge/måned kolonner
- Sælgere på tavlen tæller også FM sælgere
- Top 20 forbliver uændret (bruger allerede cached leaderboard med FM)
