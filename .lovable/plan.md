
# Plan: Tilføj straksbetaling-knap med konvertering

## Oversigt
Tilføj en "Tilføj straksbetaling" knap til hver række i tabellen. Når medarbejderen klikker, vises en bekræftelsesdialog. Ved godkendelse opdateres salget med de højere provisions- og omsætningsværdier fra prisreglen.

---

## Database-ændring

### Tilføj kolonne til sale_items
```sql
ALTER TABLE sale_items ADD COLUMN is_immediate_payment boolean DEFAULT false;
```
Dette felt markerer om et salg er konverteret til straksbetaling.

---

## Frontend-ændringer

### 1. Udvid ImmediatePaymentSale interface
Tilføj felter til at håndtere konvertering:
```typescript
interface ImmediatePaymentSale {
  id: string;
  sale_datetime: string;
  customer_company: string | null;
  customer_phone: string | null;
  product_name: string;
  sale_item_id: string;           // Ny: ID for sale_item
  matched_pricing_rule_id: string; // Ny: Prisregel ID
  is_immediate_payment: boolean;   // Ny: Status
}
```

### 2. Tilføj mutation til konvertering
```typescript
const convertMutation = useMutation({
  mutationFn: async (sale: ImmediatePaymentSale) => {
    // 1. Hent prisregel med immediate_payment værdier
    const { data: rule } = await supabase
      .from("product_pricing_rules")
      .select("immediate_payment_commission_dkk, immediate_payment_revenue_dkk")
      .eq("id", sale.matched_pricing_rule_id)
      .single();
    
    // 2. Opdater sale_item med nye værdier
    await supabase
      .from("sale_items")
      .update({
        is_immediate_payment: true,
        mapped_commission: rule.immediate_payment_commission_dkk,
        mapped_revenue: rule.immediate_payment_revenue_dkk,
      })
      .eq("id", sale.sale_item_id);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["immediate-payment-ase-sales"] });
    toast({ title: "Straksbetaling tilføjet" });
  },
});
```

### 3. Tilføj knap og bekræftelsesdialog
Tilføj en ny kolonne "Handling" med en knap pr. række:

```typescript
<TableHead>Handling</TableHead>
...
<TableCell>
  {sale.is_immediate_payment ? (
    <Badge variant="success">Aktiveret</Badge>
  ) : (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm">Tilføj straksbetaling</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
          <AlertDialogDescription>
            Ved at tilføje straksbetaling øges din provision for dette salg.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuller</AlertDialogCancel>
          <AlertDialogAction onClick={() => convertMutation.mutate(sale)}>
            Bekræft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )}
</TableCell>
```

### 4. Opdater data-hentning
Inkluder `sale_item_id` og `is_immediate_payment` i query'en.

---

## Berørte filer

| Fil | Handling |
|-----|----------|
| Database migration | Tilføj `is_immediate_payment` kolonne |
| `src/pages/ImmediatePaymentASE.tsx` | Tilføj knap, dialog og mutation |

---

## Dataflow

```text
Klik "Tilføj straksbetaling"
        ↓
Bekræftelsesdialog vises
        ↓
Bekræft klik
        ↓
Hent prisregel → immediate_payment_commission_dkk, immediate_payment_revenue_dkk
        ↓
Opdater sale_items:
  - is_immediate_payment = true
  - mapped_commission = immediate_payment_commission_dkk
  - mapped_revenue = immediate_payment_revenue_dkk
        ↓
Invalidate query → UI opdateres → Badge viser "Aktiveret"
```
