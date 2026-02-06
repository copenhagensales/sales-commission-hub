
# Plan: Tilføj RLS Policy for Straksbetaling

## Problem
Mathias (og andre almindelige medarbejdere) kan ikke tilføje straksbetaling fordi den nuværende RLS policy på `sale_items` tabellen kun tillader **managers** at opdatere rækker.

**Nuværende policies på sale_items:**
- SELECT: Medarbejdere kan se deres egne sale_items ✅
- UPDATE: Kun managers kan opdatere ❌

## Løsning
Tilføj en ny RLS policy der tillader medarbejdere at opdatere deres egne sale_items - men kun for straksbetaling-felterne.

---

## Database ændring

### Ny RLS Policy

```sql
CREATE POLICY "Employees can update own immediate payment"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (can_view_sale_as_employee(sale_id, auth.uid()))
WITH CHECK (can_view_sale_as_employee(sale_id, auth.uid()));
```

Denne policy:
1. Bruger den eksisterende `can_view_sale_as_employee()` funktion til at verificere ejerskab
2. Tillader kun opdatering af sale_items der tilhører medarbejderens egne salg
3. Fungerer sammen med den eksisterende manager-policy (PERMISSIVE)

---

## Sikkerhedsovervejelser

| Aspekt | Vurdering |
|--------|-----------|
| Ejerskabsverifikation | Bruger `can_view_sale_as_employee()` som verificerer via agent email/ID |
| Risiko for misbrug | Lav - medarbejdere kan kun ændre deres egne salg |
| Konflikt med manager-policy | Ingen - begge policies er PERMISSIVE, så de kombineres med OR |

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `supabase/migrations/[timestamp]_add_employee_immediate_payment_policy.sql` | Ny migration med RLS policy |

---

## Ingen frontend-ændringer nødvendige
Koden i `ImmediatePaymentASE.tsx` er allerede korrekt implementeret. Når RLS policyen tilføjes, vil knappen "Tilføj straksbetaling" automatisk fungere for alle medarbejdere.

---

## Test efter implementering
1. Log ind som Mathias
2. Gå til Straksbetaling (ASE) siden
3. Klik "Tilføj straksbetaling" på et afventende salg
4. Bekræft at salget opdateres til "Aktiveret"
