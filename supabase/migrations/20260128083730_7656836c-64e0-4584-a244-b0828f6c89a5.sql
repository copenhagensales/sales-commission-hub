-- Opret event_attendees tabel
CREATE TABLE public.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.company_events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'attending' CHECK (status IN ('attending', 'not_attending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (event_id, employee_id)
);

-- Index for hurtige opslag
CREATE INDEX idx_event_attendees_event ON public.event_attendees(event_id);
CREATE INDEX idx_event_attendees_employee ON public.event_attendees(employee_id);

-- Enable RLS
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Alle autentificerede kan se deltagere
CREATE POLICY "Users can view all attendees" ON public.event_attendees
  FOR SELECT TO authenticated USING (true);

-- Medarbejdere kan indsætte deres egen deltagelse
CREATE POLICY "Employees can insert own attendance" ON public.event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE LOWER(private_email) = LOWER(auth.jwt()->>'email') 
       OR LOWER(work_email) = LOWER(auth.jwt()->>'email')
  ));

-- Medarbejdere kan opdatere deres egen deltagelse
CREATE POLICY "Employees can update own attendance" ON public.event_attendees
  FOR UPDATE TO authenticated
  USING (employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE LOWER(private_email) = LOWER(auth.jwt()->>'email') 
       OR LOWER(work_email) = LOWER(auth.jwt()->>'email')
  ));

-- Medarbejdere kan slette deres egen deltagelse
CREATE POLICY "Employees can delete own attendance" ON public.event_attendees
  FOR DELETE TO authenticated
  USING (employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE LOWER(private_email) = LOWER(auth.jwt()->>'email') 
       OR LOWER(work_email) = LOWER(auth.jwt()->>'email')
  ));

-- Trigger for updated_at
CREATE TRIGGER update_event_attendees_updated_at
  BEFORE UPDATE ON public.event_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();