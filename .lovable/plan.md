

# Fix: Slet-knap virker ikke — manglende DELETE RLS policy

## Problem
Tabellen `sales_validation_uploads` har RLS-policies for SELECT, INSERT og UPDATE, men **ingen for DELETE**. Derfor blokerer databasen sletningen stille, og intet sker når man klikker skraldespanden.

## Løsning
Tilføj en DELETE RLS policy på `sales_validation_uploads` der tillader autentificerede brugere at slette.

```sql
CREATE POLICY "Authenticated users can delete uploads"
ON public.sales_validation_uploads
FOR DELETE
TO authenticated
USING (true);
```

Én database-migration — ingen kodeændringer nødvendige.

