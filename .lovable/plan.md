

# Fix: Fieldmarketing medarbejdere på CS Top 20

## Problemet
Fieldmarketing sælgere (Martina, Noa, Rebecca osv.) vises ikke på CS Top 20 dashboardet af to årsager:

### Årsag 1: Fejl i product_pricing_rules query
Edge funktionen `calculate-kpi-values` forsøger at hente kolonner der ikke eksisterer:

| Kolonne funktionen bruger | Findes i database? |
|--------------------------|-------------------|
| `product_name` | ❌ Nej |
| `price_dkk` | ❌ Nej |

**Korrekt struktur:**
- Produktnavnet ligger i `products.name` (via join på `product_id`)
- Prisen ligger i `product_pricing_rules.revenue_dkk`

### Årsag 2: CS Top 20 henter kun fra `sales` tabellen
`handleCsTop20Data()` i `tv-dashboard-data` henter kun telesales - den inkluderer slet ikke `fieldmarketing_sales` tabellen.

---

## Løsning

### Del 1: Fix `calculate-kpi-values` edge function

**Fil:** `supabase/functions/calculate-kpi-values/index.ts`

Opdater `fetchFmCommissionMap()` funktionen (linje 179-198):

```typescript
// FRA (broken):
const { data: rules } = await supabase
  .from("product_pricing_rules")
  .select("product_name, commission_dkk, price_dkk")

// TIL (fixed):
const { data: rules } = await supabase
  .from("product_pricing_rules")
  .select(`
    product:products!inner(name),
    commission_dkk,
    revenue_dkk
  `)
  .eq("is_active", true)
```

Og opdater map-logikken:
```typescript
for (const rule of rules || []) {
  const key = rule.product?.name?.toLowerCase();
  if (key && !map.has(key)) {
    map.set(key, {
      commission: rule.commission_dkk || 0,
      price: rule.revenue_dkk || 0,
    });
  }
}
```

### Del 2: Tilføj fieldmarketing_sales til CS Top 20

**Fil:** `supabase/functions/tv-dashboard-data/index.ts`

I `handleCsTop20Data()` funktionen (linje 2098-2369):

1. Hent FM pricing map (genbrug logikken fra calculate-kpi-values)
2. Hent fieldmarketing_sales for alle tre perioder (today, week, payroll)
3. Match seller_id til employee_master_data for navne og avatars
4. Beregn provision baseret på product_name → product_pricing_rules
5. Kombiner FM og telesales i én samlet ranking

**Ny kode der skal tilføjes:**

```typescript
// Hent FM pricing map
const fmPricingMap = new Map();
const { data: pricingRules } = await supabase
  .from("product_pricing_rules")
  .select(`product:products!inner(name), commission_dkk, revenue_dkk`)
  .eq("is_active", true);

for (const rule of pricingRules || []) {
  const key = rule.product?.name?.toLowerCase();
  if (key && !fmPricingMap.has(key)) {
    fmPricingMap.set(key, rule.commission_dkk || 0);
  }
}

// Hent FM salg for alle perioder
const { data: fmSalesToday } = await supabase
  .from("fieldmarketing_sales")
  .select("id, seller_id, product_name, registered_at")
  .gte("registered_at", `${todayStr}T00:00:00`)
  .lte("registered_at", `${todayStr}T23:59:59`);

// ... samme for week og payroll

// Aggreger FM provision per employee
for (const sale of fmSalesToday || []) {
  const commission = fmPricingMap.get(sale.product_name?.toLowerCase()) || 0;
  // Tilføj til seller's total
}
```

---

## Filer der skal ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/calculate-kpi-values/index.ts` | Fix `fetchFmCommissionMap()` til korrekt join |
| `supabase/functions/tv-dashboard-data/index.ts` | Tilføj FM salg til `handleCsTop20Data()` |

---

## Teknisk sektion

### Database struktur (verificeret)
```
product_pricing_rules:
  - id (uuid)
  - product_id (uuid) ← joiner til products.id
  - commission_dkk (numeric)
  - revenue_dkk (numeric) ← IKKE price_dkk
  - is_active (boolean)

products:
  - id (uuid)
  - name (text) ← produktnavnet ligger her
```

### FM sales attribution
Fieldmarketing salg bruger `seller_id` direkte (matcher `employee_master_data.id`), ikke agent_email som telesales.

### Eksempel på korrekte priser fra database
- Switch Unlimited ATL: 6.196 kr kommission
- Switch Unlimited #1: 2.992 kr kommission  
- Switch Contact Center ATL: 2.125 kr kommission

---

## Forventet resultat
- FM sælgere med provision vises på CS Top 20
- Ranking kombinerer telesales og fieldmarketing
- FM sælgere vises med grøn "Field" badge
- Martina Cubranovic: ~29+ salg × 450 kr = ~13.000+ kr → burde være i top 20

