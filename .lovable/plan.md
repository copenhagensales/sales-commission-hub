

# Fix: Tilføj DELETE RLS-policy til customer_inquiries

## Problem
Tabellen `customer_inquiries` har kun SELECT og UPDATE policies. Der mangler en DELETE policy, så sletning blokeres af Row Level Security.

## Ændring
Kør én SQL migration:

```sql
CREATE POLICY "Authenticated users can delete inquiries"
ON public.customer_inquiries
FOR DELETE
TO authenticated
USING (true);
```

Ingen kodeændringer nødvendige — UI og mutation er allerede korrekt implementeret.

