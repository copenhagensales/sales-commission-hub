

# RLS-policy for FM-medarbejdere på sale_items

## Problem
Funktionen `can_view_sale_as_employee()` kræver en `employee_agent_mapping` → `agents` kæde for at matche salg til medarbejder. FM-sælgere som Nora har ingen dialer/agent-mapping, så RLS blokerer adgang til `sale_items` — og kommission vises ikke i vagthistorikken.

Julie virker fordi hun **har** en `employee_agent_mapping`-post.

## Løsning
Tilføj én ny RLS SELECT-policy på `sale_items`:

```sql
CREATE POLICY "FM employees can view own FM sale_items"
ON public.sale_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales s
    JOIN employee_master_data e 
      ON LOWER(s.agent_email) = LOWER(e.work_email)
    WHERE s.id = sale_items.sale_id
      AND s.source = 'fieldmarketing'
      AND e.auth_user_id = auth.uid()
      AND e.is_active = true
  )
);
```

## Hvad det gør
- Giver aktive FM-medarbejdere adgang til `sale_items` for FM-salg hvor `agent_email` matcher deres `work_email`
- Begrænset til `source = 'fieldmarketing'` — påvirker ikke telemarketing-salg
- Kun egne salg (via `auth_user_id = auth.uid()`)
- Ingen kodeændringer nødvendige — kun database-policy

## Sikkerhed
- Medarbejderen kan kun se sine egne FM sale_items
- Eksisterende policies for managers og dialer-medarbejdere forbliver uændrede

