

## Produktrettelse med audit trail og rollback

### Hvad
1. Opret en `product_change_log` tabel til at tracke alle produkt-rettelser på `sale_items`
2. Erstat manuel prisberegning med `rematch-pricing-rules` edge function
3. Tilføj rollback-funktionalitet

### 1. Ny tabel: `product_change_log`

```sql
CREATE TABLE public.product_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL,
  cancellation_queue_id uuid REFERENCES public.cancellation_queue(id),
  old_product_id uuid,
  new_product_id uuid,
  old_product_name text,
  new_product_name text,
  old_commission numeric,
  new_commission numeric,
  old_revenue numeric,
  new_revenue numeric,
  changed_by uuid,
  change_reason text DEFAULT 'basket_difference_approval',
  rolled_back_at timestamptz,
  rolled_back_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.product_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read change log"
  ON public.product_change_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert change log"
  ON public.product_change_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update change log"
  ON public.product_change_log FOR UPDATE TO authenticated USING (true);
```

### 2. Ændring i `ApprovalQueueTab.tsx` — approveMutation (linje 727-768)

**Før opdatering af sale_items:** Gem snapshot af nuværende værdier i `product_change_log`:
- `old_product_id`, `old_product_name`, `old_commission`, `old_revenue`

**Opdater sale_items:** Kun `product_id` og `adversus_product_title` (fjern manuel prisberegning)

**Kald `rematch-pricing-rules`:** Med `{ sale_ids: overrideSaleIds }` for kampagne-aware prisberegning

**Log nye værdier:** Opdater `product_change_log` med `new_commission`/`new_revenue` efter rematch

**Invalidér queries:** Tilføj `sales`, `kpi`, `leaderboard` til invalidering i `onSuccess`

### 3. Rollback-funktionalitet

Tilføj en "Fortryd rettelse" knap i `ApprovedTab.tsx` for godkendte kurv-rettelser:
- Hent den relevante `product_change_log` entry
- Gendan `sale_items` med de gamle værdier (`old_product_id`, `old_product_name`)
- Kald `rematch-pricing-rules` igen for at genberegne priser
- Marker log-entry som `rolled_back_at` + `rolled_back_by`

### Filer
- **Migration:** Opret `product_change_log` tabel
- **`src/components/cancellations/ApprovalQueueTab.tsx`:** Audit logging + rematch-pricing-rules
- **`src/components/cancellations/ApprovedTab.tsx`:** Rollback-knap for kurv-rettelser

