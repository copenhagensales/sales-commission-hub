
# Plan: Ret 1.000-rækkers begrænsning i Excel-eksport

## Problem

Den nuværende eksport bruger en direkte Supabase-forespørgsel, som er begrænset til 1.000 rækker. Med flere end 1.000 fieldmarketing-salg siden 15/1 får du kun de første 1.000.

## Løsning

Brug den eksisterende `fetchAllRows` utility der automatisk paginerer og henter alle rækker.

## Teknisk ændring

**Fil: `src/components/fieldmarketing/FieldmarketingExcelExport.tsx`**

### Før (linje 14-30):
```typescript
const { data, error } = await supabase
  .from("fieldmarketing_sales")
  .select(`...`)
  .gte("registered_at", "2026-01-15T00:00:00")
  .order("registered_at", { ascending: false });
```

### Efter:
```typescript
import { fetchAllRows } from "@/utils/supabasePagination";

const data = await fetchAllRows(
  "fieldmarketing_sales",
  `id, registered_at, product_name, phone_number, comment, created_at,
   seller:employee_master_data!seller_id(first_name, last_name),
   location:location!location_id(name),
   client:clients!client_id(name)`,
  (q) => q.gte("registered_at", "2026-01-15T00:00:00"),
  { orderBy: "registered_at", ascending: false }
);
```

## Hvordan det virker

`fetchAllRows` utility'en:
1. Henter data i batches af 500 rækker ad gangen
2. Fortsætter automatisk indtil alle rækker er hentet
3. Returnerer det samlede array

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/fieldmarketing/FieldmarketingExcelExport.tsx` | Erstat direkte query med `fetchAllRows` |

## Forventet resultat

Excel-eksporten vil nu hente alle salg (uanset antal) fra 15. januar til nu.
