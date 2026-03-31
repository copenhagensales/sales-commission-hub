
-- FM Checklist Templates
CREATE TABLE public.fm_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.employee_master_data(id)
);

-- FM Checklist Completions
CREATE TABLE public.fm_checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.fm_checklist_templates(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  completed_by UUID NOT NULL REFERENCES public.employee_master_data(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, completed_date)
);

-- Enable RLS
ALTER TABLE public.fm_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fm_checklist_completions ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read templates
CREATE POLICY "Authenticated users can read active templates"
  ON public.fm_checklist_templates FOR SELECT TO authenticated
  USING (true);

-- RLS: Authenticated users can manage templates
CREATE POLICY "Authenticated users can insert templates"
  ON public.fm_checklist_templates FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update templates"
  ON public.fm_checklist_templates FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- RLS: Authenticated users can read completions
CREATE POLICY "Authenticated users can read completions"
  ON public.fm_checklist_completions FOR SELECT TO authenticated
  USING (true);

-- RLS: Authenticated users can insert completions
CREATE POLICY "Authenticated users can insert completions"
  ON public.fm_checklist_completions FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS: Authenticated users can update completions
CREATE POLICY "Authenticated users can update completions"
  ON public.fm_checklist_completions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- RLS: Authenticated users can delete completions (uncheck)
CREATE POLICY "Authenticated users can delete completions"
  ON public.fm_checklist_completions FOR DELETE TO authenticated
  USING (true);

-- Seed predefined tasks
INSERT INTO public.fm_checklist_templates (title, description, weekdays, sort_order) VALUES
  ('Sørg for alle er informeret om standere', 'Informér alle sælgere om de skal tage standere med ud', '{0}', 1),
  ('Tjek dubletter igennem', 'Gennemgå og tjek for dubletter i systemet', '{0,1,2,3,4,5,6}', 2),
  ('Tjek difference fra PB til IM', 'Sammenlign PB og IM for differencer', '{0,1,2,3,4,5,6}', 3),
  ('Pak alle biler til sælgerne', 'Alle biler skal pakkes klar til sælgerne', '{0}', 4),
  ('Pak standere til sælgere m. offentlig transport', 'Pak standere til sælgere der tager offentlig transport', '{0}', 5),
  ('Alle biler afleveret + kvittering m. billede', 'Alle biler skal være afleveret og kvitteret med et billede. Ring ud til sælgere hvis de ikke har gjort dette.', '{6}', 6),
  ('Tag billeder af dashboards i biler (lamper)', 'Tag billeder af alle dashboards for at tjekke om der er lamper der lyser', '{0}', 7),
  ('Ryd biler op', 'Alle biler skal ryddes op', '{0}', 8),
  ('Tjek standere ved sygdom', 'Ved sygdom: sørg for at der er standere på lokationen. Især vigtigt hvis de står 3 personer.', '{0,1,2,3,4,5,6}', 9),
  ('Tjek om sælgere er kørt tidligere dagen før', 'Morgen-tjek: Er der nogen sælgere som er kørt for tidligt dagen før?', '{0,1,2,3,4,5,6}', 10),
  ('Send kannibalisering + ARPU ud til sælgerne', 'Send kannibalisering og ARPU ud. Flag: over 40% kannibalisering eller under 110 i ARPU.', '{0,1,2,3,4,5,6}', 11);
