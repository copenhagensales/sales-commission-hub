
# Udvidet soegning paa alle kundeoplysninger

## Problem
Soegefeltet soeger kun paa `customer_phone` og `customer_company` server-side. Brugeren vil ogsaa kunne soege paa navn, adresse, postnummer, by, e-mail, medlemsnummer, CVR, lead-ID, produktnavn m.m. fra baade `normalized_data` og `raw_payload`.

## Loesning
Flyt soegning til client-side og soeg paa tvaers af alle relevante felter.

## Tekniske detaljer

**Fil:** `src/components/cancellations/ManualCancellationsTab.tsx`

### 1. Tilfoej `normalized_data` til select
Udvid select-strengen til ogsaa at hente `normalized_data`.

### 2. Fjern server-side soegning
Fjern `.or(...)` filteret fra queryen og fjern `searchTerm` fra queryKey (da filtrering nu sker client-side).

### 3. Tilfoej matchesSearch helper
Soeg case-insensitivt i alle disse felter:

**Fra kolonner:** `customer_phone`, `customer_company`, `agent_name`

**Fra normalized_data:** `customer_name`, `customer_email`, `customer_address`, `customer_city`, `customer_zip`, `phone_number`, `external_reference`, `lead_id`, `member_number`, `product_name`, `subscription_type`, `campaign_name`, `akasse_type`, `current_akasse`, `association_type`, `lonsikring_type`, `coverage_amount`

**Fra raw_payload:** `CustomerName`, `CustomerPhone`, `CustomerCompany`, `uniqueId`, `leadId`, samt nested `leadResultFields` (alle vaerdier gennemsoeges)

```typescript
const matchesSearch = (sale, term) => {
  const lower = term.toLowerCase();
  const nd = sale.normalized_data as Record<string, unknown> | null;
  const rp = sale.raw_payload as Record<string, unknown> | null;

  // Direkte kolonner
  const directFields = [sale.customer_phone, sale.customer_company, sale.agent_name];

  // Normalized data felter
  const ndKeys = [
    'customer_name', 'customer_email', 'customer_address',
    'customer_city', 'customer_zip', 'phone_number',
    'external_reference', 'lead_id', 'member_number',
    'product_name', 'subscription_type', 'campaign_name',
    'akasse_type', 'current_akasse', 'association_type',
    'lonsikring_type', 'coverage_amount'
  ];
  const ndFields = ndKeys.map(k => nd?.[k]);

  // Raw payload top-level + leadResultFields
  const rpDirect = ['CustomerName','CustomerPhone','CustomerCompany','uniqueId','leadId'].map(k => rp?.[k]);
  const lrf = rp?.leadResultFields as Record<string, unknown> | null;
  const lrfValues = lrf ? Object.values(lrf) : [];

  const all = [...directFields, ...ndFields, ...rpDirect, ...lrfValues];
  return all.some(f => f != null && String(f).toLowerCase().includes(lower));
};
```

### 4. Opdater filteredSales memo
Kombiner agent-filter og soege-filter i samme memo:

```typescript
const filteredSales = useMemo(() => {
  let result = sales;
  if (selectedAgent) result = result.filter(s => s.agent_name === selectedAgent);
  if (searchTerm.trim()) result = result.filter(s => matchesSearch(s, searchTerm.trim()));
  return result;
}, [sales, selectedAgent, searchTerm]);
```

### 5. Opdater label
Aendr fra "Soeg (telefon/virksomhed)" til "Soeg (alle felter)".

Ingen database-aendringer er noedvendige.
