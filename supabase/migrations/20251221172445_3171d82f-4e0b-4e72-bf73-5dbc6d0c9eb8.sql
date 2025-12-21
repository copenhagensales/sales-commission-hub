-- Create table for editable performance expectations per week
CREATE TABLE public.onboarding_week_expectations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INTEGER NOT NULL UNIQUE CHECK (week_number BETWEEN 1 AND 3),
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#22c55e',
  measure_on TEXT[] NOT NULL DEFAULT '{}',
  do_not_measure_on TEXT[] NOT NULL DEFAULT '{}',
  good_day_definition TEXT NOT NULL,
  note TEXT,
  we_expect TEXT[] NOT NULL DEFAULT '{}',
  we_dont_expect TEXT[] NOT NULL DEFAULT '{}',
  good_week_criteria TEXT[] NOT NULL DEFAULT '{}',
  daily_message TEXT NOT NULL,
  progression_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_week_expectations ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view
CREATE POLICY "Authenticated can view week expectations"
  ON public.onboarding_week_expectations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Managers can manage
CREATE POLICY "Managers can manage week expectations"
  ON public.onboarding_week_expectations
  FOR ALL
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

-- Insert default data
INSERT INTO public.onboarding_week_expectations (week_number, title, color, measure_on, do_not_measure_on, good_day_definition, note, we_expect, we_dont_expect, good_week_criteria, daily_message, progression_text) VALUES
(1, 'Uge 1 – Lær at ringe', '#22c55e', 
  ARRAY['aktivitet', 'BALA-adfærd', 'coaching-compliance'],
  ARRAY['omsætning', 'lukkerate'],
  'Du ringer, følger strukturen og spørger om køb.',
  '0–5.000 kr i uge 1 kan være en rigtig god start.',
  ARRAY['Du ringer hver dag', 'Du følger BALA-strukturen (selv hvis det føles klodset)', 'Du tager imod daglig coaching', 'Du laver drills, når du får dem'],
  ARRAY['Høj omsætning', 'At du lukker stabilt', 'At du lyder rutineret'],
  ARRAY['Du er i gang på telefonen', 'Du stiller behovsspørgsmål', 'Du spørger om køb (også selvom svaret er nej)'],
  'I dag er en god dag, hvis du ringer og følger strukturen. Resultater kommer senere.',
  'I din fase vægter aktivitet og læring højere end omsætning.'
),
(2, 'Uge 2 – Lær at konvertere', '#eab308',
  ARRAY['stabil aktivitet', 'BALA-score', 'indvending-håndtering'],
  ARRAY['topperformance'],
  'Kvaliteten er bedre end i uge 1.',
  'Uge 2 handler ikke om at være god – men om at være mere stabil end uge 1.',
  ARRAY['Mere konsekvent brug af BALA', 'Roligere håndtering af indvendinger', 'Tydelige forsøg på lukning i relevante samtaler'],
  ARRAY['Topperformance', 'Sammenligning med erfarne sælgere'],
  ARRAY['Aktiviteten er stabil', 'BALA-score forbedres', 'De første rigtige salg/booking begynder at komme'],
  'I dag er en god dag, hvis kvaliteten er bedre end i går.',
  'Stabilitet og kvalitet er vigtigere end enkeltstående salg.'
),
(3, 'Uge 3 – Bliv selvstændig', '#3b82f6',
  ARRAY['selvstændighed', 'feedback-omsætning', 'stabil rytme'],
  ARRAY['endeligt lønniveau'],
  'Du kan gennemføre samtaler selvstændigt.',
  'Uge 3 handler om at blive klar – ikke om at være perfekt.',
  ARRAY['Du kan gennemføre en samtale fra start til slut', 'Du kan forklare dit eget fokusområde', 'Du omsætter feedback hurtigt til handling'],
  ARRAY['At du rammer dit fremtidige lønniveau', 'At du er "færdig"'],
  ARRAY['Du har en stabil rytme', 'Du har 1 klar styrke og 1 klart fokus', 'Du er klar til næste udviklingstrin'],
  'I dag er en god dag, hvis du arbejder mere selvstændigt.',
  'Din rytme og selvstændighed viser, hvor du er på vej hen.'
);

-- Add daily_message column to onboarding_days for day-specific messages
ALTER TABLE public.onboarding_days ADD COLUMN IF NOT EXISTS daily_message TEXT;

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_week_expectations_updated_at
  BEFORE UPDATE ON public.onboarding_week_expectations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();