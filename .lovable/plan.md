

## Fix: Hent ALLE rækker i godkendelseskøen

### Problem
Linje 373 har `.limit(200)` som afskærer data. Med 1000+ ventende rækker vises kun de første 200.

### Løsning

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`, linje 361-373**

Erstat den enkle query med pagineret fetch-loop:

```typescript
// Pagineret fetch - hent alle rækker i batches
let allData: any[] = [];
let from = 0;
const batchSize = 1000;

while (true) {
  let batchQuery = supabase
    .from("cancellation_queue")
    .select("id, sale_id, upload_type, status, reviewed_at, created_at, import_id, uploaded_data, opp_group, client_id")
    .order("created_at", { ascending: false })
    .range(from, from + batchSize - 1);

  if (statusFilter !== "all") {
    batchQuery = batchQuery.eq("status", statusFilter);
  }
  if (clientId) {
    batchQuery = batchQuery.eq("client_id", clientId);
  }

  const { data: batch, error } = await batchQuery;
  if (error) throw error;
  if (!batch || batch.length === 0) break;
  allData.push(...batch);
  if (batch.length < batchSize) break;
  from += batchSize;
}

const data = allData;
```

Resten af koden (linje 375+) forbliver uændret — den bruger allerede `data`-variablen.

