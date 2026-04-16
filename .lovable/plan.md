

# Plan: Beskedtråd direkte i ticket (erstat email-uddybning)

## Hvad ændres
I stedet for at "Bed om uddybning" sender en email, bygges en beskedtråd direkte i ticket-dialogen. Admin og indberetter kan skrive frem og tilbage inde i selve ticketen.

## 1. Database: Ny `system_feedback_comments` tabel

```sql
CREATE TABLE public.system_feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.system_feedback(id) ON DELETE CASCADE,
  author_employee_id UUID REFERENCES public.employee_master_data(id),
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_feedback_comments ENABLE ROW LEVEL SECURITY;

-- Indberettere ser kommentarer på egne tickets, admins ser alle
CREATE POLICY "Users can view comments on own feedback"
  ON public.system_feedback_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.system_feedback sf
      WHERE sf.id = feedback_id AND sf.submitted_by = (
        SELECT emd.id FROM public.employee_master_data emd
        WHERE emd.auth_user_id = auth.uid() LIMIT 1
      )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Alle autentificerede kan indsætte kommentarer
CREATE POLICY "Authenticated users can insert comments"
  ON public.system_feedback_comments FOR INSERT TO authenticated
  WITH CHECK (true);
```

## 2. UI-ændringer i `SystemFeedback.tsx`

- **Beskedtråd i dialogen**: Mellem ticket-detaljer og admin-sektionen vises en tråd med alle kommentarer (admin-beskeder i lilla, bruger-beskeder i standard farve), sorteret kronologisk
- **Nyt svar-felt**: Både admin og indberetter får et tekstfelt + "Send"-knap til at skrive i tråden
- **"Bed om uddybning"-knappen**: Ændres til at sætte status til `needs_clarification` + scrolle til svar-feltet (ingen email)
- **Admin response-feltet**: Fjernes (erstattes af tråden)
- **Indberetter-visning**: Når status er `needs_clarification`, vises en tydelig prompt om at svare

## 3. Eksisterende admin_response
Migrér ikke — det eksisterende `admin_response`-felt beholdes i databasen for historik, men vises kun som en legacy-besked i tråden hvis den findes.

## Filer der ændres
- Database-migration (ny tabel + RLS)
- `src/pages/SystemFeedback.tsx` — beskedtråd + nyt input

