
# Plan: Centraliser FM-salg i Sales-tabellen

## Konceptuel Ændring

I stedet for at have FM-data i en separat tabel, behandler vi FM-registrering som en **datakilde** på lige fod med Adversus og Enreach. Dette giver én central `sales` tabel for alle salgstyper.

```text
┌─────────────────────────────────────────────────────────────────┐
│  NUVÆRENDE ARKITEKTUR (Fragmenteret)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Telesales (TM)              Field Marketing (FM)               │
│  ┌─────────────────┐         ┌─────────────────────┐            │
│  │ sales           │         │ fieldmarketing_sales│            │
│  ├─────────────────┤         ├─────────────────────┤            │
│  │ source: adversus│         │ seller_id           │            │
│  │ source: enreach │         │ location_id         │            │
│  │ client_campaign │         │ client_id           │            │
│  │ agent_email     │         │ product_name        │            │
│  │ validation_stat │         │ (ingen status!)     │            │
│  └─────────────────┘         └─────────────────────┘            │
│                                                                 │
│  → 22 filer med separate FM-queries                             │
│  → Annulleringer virker kun for TM                              │
│  → Duplikeret logik i dashboards                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  NY ARKITEKTUR (Centraliseret)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                        sales                              │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ source: 'adversus' | 'enreach' | 'fieldmarketing'         │  │
│  │ integration_type: 'adversus' | 'enreach' | 'manual'       │  │
│  │ client_campaign_id  (via products → client_campaigns)     │  │
│  │ agent_email / agent_name                                  │  │
│  │ customer_phone                                            │  │
│  │ validation_status                                         │  │
│  │ raw_payload: { fm_seller_id, fm_location_id, ... }        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  → Én tabel, én query-struktur                                  │
│  → Annulleringer virker for alle                                │
│  → Samme RLS, samme aggregering                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Mapping: FM-felter → Sales-felter

| FM-felt | Sales-felt | Bemærkning |
|---------|------------|------------|
| `seller_id` | `agent_email` + `agent_name` | Lookup via `employee_master_data` |
| `registered_at` | `sale_datetime` | Direkte mapping |
| `client_id` | `client_campaign_id` | Lookup via `products.client_campaign_id` |
| `product_name` | `normalized_data.product_name` | Eller nyt felt |
| `phone_number` | `customer_phone` | Direkte mapping |
| `location_id` | `raw_payload.fm_location_id` | Gem i JSONB for context |
| `comment` | `raw_payload.fm_comment` | Gem i JSONB |
| (nyt) | `source = 'fieldmarketing'` | Identificerer FM-salg |
| (nyt) | `integration_type = 'manual'` | Manuel registrering |
| (nyt) | `validation_status = 'pending'` | Default status |

## Implementeringsplan

### Fase 1: Database-forberedelse

**1.1 Tilføj kolonner til sales (hvis manglende)**

Sikre at `sales` kan håndtere FM-data:

```sql
-- Ingen nye kolonner nødvendige - sales har allerede:
-- source, integration_type, customer_phone, agent_name, 
-- agent_email, raw_payload, normalized_data, validation_status, sale_datetime
```

**1.2 Find korrekt client_campaign_id for FM-produkter**

FM-salg skal linkes til den rigtige kampagne via produktnavn:

```sql
-- Eksempel: Find campaign for "Eesy uden første måned"
SELECT p.name, cc.id as campaign_id, cc.name as campaign_name
FROM products p
JOIN client_campaigns cc ON p.client_campaign_id = cc.id
WHERE p.name ILIKE '%Eesy%';
```

### Fase 2: Migrer eksisterende FM-data

**2.1 Migreringsscript**

```sql
INSERT INTO sales (
  source,
  integration_type,
  sale_datetime,
  customer_phone,
  agent_name,
  agent_email,
  client_campaign_id,
  validation_status,
  raw_payload,
  created_at
)
SELECT 
  'fieldmarketing' as source,
  'manual' as integration_type,
  fm.registered_at as sale_datetime,
  fm.phone_number as customer_phone,
  CONCAT(e.first_name, ' ', e.last_name) as agent_name,
  COALESCE(e.work_email, e.private_email) as agent_email,
  -- Find client_campaign_id via product lookup
  (
    SELECT p.client_campaign_id 
    FROM products p 
    WHERE p.name = fm.product_name 
    LIMIT 1
  ) as client_campaign_id,
  'pending' as validation_status,
  jsonb_build_object(
    'fm_seller_id', fm.seller_id,
    'fm_location_id', fm.location_id,
    'fm_client_id', fm.client_id,
    'fm_product_name', fm.product_name,
    'fm_comment', fm.comment,
    'migrated_from', 'fieldmarketing_sales',
    'original_id', fm.id
  ) as raw_payload,
  fm.created_at
FROM fieldmarketing_sales fm
LEFT JOIN employee_master_data e ON fm.seller_id = e.id;
```

### Fase 3: Opdater SalesRegistration

**3.1 Ændre `useCreateFieldmarketingSale` til at indsætte i `sales`**

```typescript
// src/hooks/useFieldmarketingSales.ts
export function useCreateFieldmarketingSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sales: CreateSaleParams[]) => {
      // Lookup employee info for each sale
      const enrichedSales = await Promise.all(sales.map(async (sale) => {
        // Get employee name/email
        const { data: employee } = await supabase
          .from("employee_master_data")
          .select("first_name, last_name, work_email, private_email")
          .eq("id", sale.seller_id)
          .single();

        // Get client_campaign_id from product
        const { data: product } = await supabase
          .from("products")
          .select("client_campaign_id")
          .eq("name", sale.product_name)
          .limit(1)
          .single();

        return {
          source: 'fieldmarketing',
          integration_type: 'manual',
          sale_datetime: sale.registered_at || new Date().toISOString(),
          customer_phone: sale.phone_number,
          agent_name: employee ? `${employee.first_name} ${employee.last_name}` : null,
          agent_email: employee?.work_email || employee?.private_email,
          client_campaign_id: product?.client_campaign_id,
          validation_status: 'pending',
          raw_payload: {
            fm_seller_id: sale.seller_id,
            fm_location_id: sale.location_id,
            fm_client_id: sale.client_id,
            fm_product_name: sale.product_name,
            fm_comment: sale.comment,
          }
        };
      }));

      const { data, error } = await supabase
        .from("sales")
        .insert(enrichedSales)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["fieldmarketing-sales"] });
    },
  });
}
```

### Fase 4: Opdater læse-hooks

**4.1 `useFieldmarketingSales` læser nu fra `sales`**

```typescript
export function useFieldmarketingSales(clientId?: string) {
  return useQuery({
    queryKey: ["fieldmarketing-sales", clientId],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          id,
          sale_datetime,
          customer_phone,
          agent_name,
          validation_status,
          raw_payload,
          client_campaign:client_campaigns!client_campaign_id(
            id, name, client:clients(id, name)
          )
        `)
        .eq("source", "fieldmarketing")
        .order("sale_datetime", { ascending: false });
      
      if (clientId) {
        // Filter by client via raw_payload
        query = query.eq("raw_payload->fm_client_id", clientId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Transform to existing interface for backwards compatibility
      return data.map(s => ({
        id: s.id,
        seller_id: s.raw_payload?.fm_seller_id,
        location_id: s.raw_payload?.fm_location_id,
        client_id: s.raw_payload?.fm_client_id,
        product_name: s.raw_payload?.fm_product_name,
        phone_number: s.customer_phone,
        comment: s.raw_payload?.fm_comment,
        registered_at: s.sale_datetime,
        validation_status: s.validation_status,
        // ... employee/location lookups as needed
      }));
    },
  });
}
```

### Fase 5: Opdater berørte komponenter (22 filer)

Gradvis migration - hooks abstraherer ændringen:

| Fil | Ændring |
|-----|---------|
| `ManualCancellationsTab.tsx` | Virker automatisk - FM-salg har nu `source = 'fieldmarketing'` |
| `CphSalesDashboard.tsx` | Fjern separate FM-queries, brug `source IN (...)` filter |
| `ClientDBTab.tsx` | Fjern FM-specifik logik |
| `RevenueByClient.tsx` | Fjern FM-specifik logik |
| `calculate-kpi-*` | Filter på `source` i stedet for separate tabeller |
| ... (17 flere) | Gradvis konsolidering |

### Fase 6: Cleanup

**6.1 Behold `fieldmarketing_sales` som backup**

```sql
-- Omdøb til backup efter succesfuld migration
ALTER TABLE fieldmarketing_sales RENAME TO fieldmarketing_sales_backup;

-- Evt. opret view for bagudkompatibilitet
CREATE VIEW fieldmarketing_sales AS
SELECT 
  id,
  raw_payload->>'fm_seller_id' as seller_id,
  raw_payload->>'fm_location_id' as location_id,
  raw_payload->>'fm_client_id' as client_id,
  raw_payload->>'fm_product_name' as product_name,
  customer_phone as phone_number,
  raw_payload->>'fm_comment' as comment,
  sale_datetime as registered_at,
  created_at
FROM sales
WHERE source = 'fieldmarketing';
```

## Filer der ændres

| Fil | Handling |
|-----|----------|
| Database migration | Migrer eksisterende FM-data til sales |
| `src/hooks/useFieldmarketingSales.ts` | Skriv til `sales`, læs fra `sales` |
| `src/pages/vagt-flow/SalesRegistration.tsx` | Opdater hook-brug |
| `src/components/cancellations/ManualCancellationsTab.tsx` | Virker automatisk |
| 18+ dashboard/rapport filer | Gradvis konsolidering |

## Fordele

1. **Én datakilde** - Alle salg i `sales` tabellen
2. **Annulleringer virker** - FM-salg har `validation_status`
3. **Simplere queries** - Ingen UNION eller separate fetches
4. **Bedre RLS** - Én policy for alle salg
5. **Konsistent aggregering** - `get_sales_aggregates_v2` dækker alt
6. **Fremtidssikret** - Nye datakilder følger samme mønster
