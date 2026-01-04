-- Create coaching_feedback_types lookup table
CREATE TABLE public.coaching_feedback_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label_da TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coaching_objections lookup table
CREATE TABLE public.coaching_objections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label_da TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on lookup tables
ALTER TABLE public.coaching_feedback_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_objections ENABLE ROW LEVEL SECURITY;

-- RLS for coaching_feedback_types
CREATE POLICY "Anyone can read feedback types" ON public.coaching_feedback_types FOR SELECT USING (true);
CREATE POLICY "Owners can manage feedback types" ON public.coaching_feedback_types FOR ALL USING (public.is_owner(auth.uid()));

-- RLS for coaching_objections
CREATE POLICY "Anyone can read objections" ON public.coaching_objections FOR SELECT USING (true);
CREATE POLICY "Owners can manage objections" ON public.coaching_objections FOR ALL USING (public.is_owner(auth.uid()));

-- Seed feedback types
INSERT INTO public.coaching_feedback_types (key, label_da, sort_order) VALUES
  ('indvending', 'Indvending', 1),
  ('aabning', 'Åbning/Intro', 2),
  ('pitch', 'Pitch/Value prop', 3),
  ('discovery', 'Discovery/Behovsafdækning', 4),
  ('close', 'Next step/Close', 5),
  ('tone', 'Tone/Tempo/Kontrol', 6),
  ('crm', 'CRM/Pipeline', 7);

-- Seed objections
INSERT INTO public.coaching_objections (key, label_da, sort_order) VALUES
  ('send_info', 'Send info på mail', 1),
  ('no_time', 'Ikke tid', 2),
  ('already_solution', 'Har allerede løsning', 3),
  ('not_dm', 'Ikke beslutningstager', 4),
  ('too_expensive', 'For dyrt', 5),
  ('call_later', 'Ring senere', 6),
  ('not_relevant', 'Ikke relevant', 7);

-- Create coaching_templates table
CREATE TABLE public.coaching_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  type_key TEXT NOT NULL REFERENCES public.coaching_feedback_types(key),
  title TEXT NOT NULL,
  objection_key TEXT REFERENCES public.coaching_objections(key),
  variant TEXT NOT NULL DEFAULT 'Standard',
  default_score INTEGER CHECK (default_score >= 0 AND default_score <= 2),
  strength_default TEXT NOT NULL,
  next_rep_default TEXT NOT NULL,
  say_this_default TEXT,
  success_criteria_default TEXT,
  drill_id TEXT REFERENCES public.onboarding_drills(id),
  reps_default INTEGER NOT NULL DEFAULT 5,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coaching_feedback table
CREATE TABLE public.coaching_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id),
  coach_id UUID NOT NULL REFERENCES public.employee_master_data(id),
  call_id UUID REFERENCES public.dialer_calls(id),
  template_id UUID REFERENCES public.coaching_templates(id),
  type_key TEXT NOT NULL REFERENCES public.coaching_feedback_types(key),
  objection_key TEXT REFERENCES public.coaching_objections(key),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 2),
  strength TEXT NOT NULL,
  next_rep TEXT NOT NULL,
  say_this TEXT,
  success_criteria TEXT,
  drill_id TEXT REFERENCES public.onboarding_drills(id),
  reps INTEGER,
  evidence TEXT,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coaching_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_feedback ENABLE ROW LEVEL SECURITY;

-- RLS for coaching_templates
CREATE POLICY "Teamleder+ can read templates" ON public.coaching_templates FOR SELECT USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "Owners can manage templates" ON public.coaching_templates FOR ALL USING (public.is_owner(auth.uid()));

-- RLS for coaching_feedback
CREATE POLICY "Employees can read own feedback" ON public.coaching_feedback FOR SELECT USING (employee_id = public.get_current_employee_id());
CREATE POLICY "Coaches can read feedback they gave" ON public.coaching_feedback FOR SELECT USING (coach_id = public.get_current_employee_id());
CREATE POLICY "Teamleder+ can manage feedback" ON public.coaching_feedback FOR ALL USING (public.is_teamleder_or_above(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_coaching_templates_updated_at BEFORE UPDATE ON public.coaching_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coaching_feedback_updated_at BEFORE UPDATE ON public.coaching_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 12 templates
INSERT INTO public.coaching_templates (type_key, title, objection_key, variant, strength_default, next_rep_default, say_this_default, success_criteria_default, reps_default, tags) VALUES
  ('indvending', 'Send info på mail – Standard', 'send_info', 'Standard',
   'Du holdt roen og afbrød ikke.',
   'Afklar hvad de mener med ''info'' + få mini-commit (10 min).',
   'Selvfølgelig—hvad skal jeg sende, for at det faktisk bliver relevant for jer?',
   'Enten booket 10 min eller tydeligt nej + aftalt follow-up.',
   5, ARRAY['Top12']),
  ('indvending', 'Ikke tid – Standard', 'no_time', 'Standard',
   'Du accepterede indvendingen uden at blive defensiv.',
   'Få lov til 60–90 sek med et micro-commit.',
   'Helt fair—hvis jeg holder det på 90 sek, kan du så sige ja/nej bagefter?',
   'Du får 90 sek pitch + ét kvalificerende spørgsmål.',
   5, ARRAY['Top12']),
  ('indvending', 'Har allerede en løsning – Standard', 'already_solution', 'Standard',
   'Du var nysgerrig og pressede ikke.',
   'Stil 2 gap-spørgsmål før du pitcher.',
   'Hvad er I mest tilfredse med—og hvad ville I ændre, hvis I kunne?',
   'Du får mindst ét improvement-område frem.',
   5, ARRAY['Top12']),
  ('indvending', 'Ikke beslutningstager – Standard', 'not_dm', 'Standard',
   'Du tog det professionelt og gik ikke i stå.',
   'Kortlæg proces + få intro/3-part møde.',
   'Hvem plejer at være med i den her beslutning—og vil du være åben for et 3-personers møde?',
   'Navn + næste step med relevant person (dato/tid eller intro).',
   5, ARRAY['Top12']),
  ('aabning', 'For langt/uklart formål', NULL, 'Standard',
   'Du lød venlig og energisk.',
   'Kort intro: hvem du er + hvorfor du ringer + permission.',
   'Hej [navn], det er [navn] fra [firma]—har du 30 sek, så jeg kan sige hvorfor jeg ringer?',
   'Prospect siger ja til 30 sek eller giver alternativt tidspunkt.',
   10, ARRAY['Top12']),
  ('aabning', 'Mangler relevans (ICP-hook)', NULL, 'Standard',
   'Du kom hurtigt i gang.',
   'Tilføj 1 line ICP-trigger.',
   'Jeg ringer fordi jeg taler med [rolle] i [branche] som ofte oplever [problem]—gælder det også hos jer?',
   'Du får ja/nej på relevans inden 20 sek.',
   10, ARRAY['Top12']),
  ('pitch', 'For produkt-tung (features)', NULL, 'Standard',
   'Du forklarede tydeligt.',
   'Skift til outcome + proof + spørgsmål.',
   'Vi hjælper typisk [rolle] med [outcome] ved at løse [problem]. Hvordan gør I det i dag?',
   'Pitch efterfølges af spørgsmål (ikke monolog).',
   10, ARRAY['Top12']),
  ('pitch', 'Mangler proof/konkret eksempel', NULL, 'Standard',
   'Du ramte et relevant problem.',
   'Tilføj 1 konkret case/benchmark.',
   'Typisk ser vi at [lignende virksomheder] kan [resultat] på [tid]. Hvordan ser det ud hos jer?',
   'Prospect svarer med nu-situation/tal.',
   10, ARRAY['Top12']),
  ('discovery', 'Pitcher før behov', NULL, 'Standard',
   'Du var engageret i dialogen.',
   'Spørg 2 spørgsmål før pitch (nu-situation + impact).',
   'Må jeg stille 2 hurtige spørgsmål, så jeg ikke skyder ved siden af?',
   'Min. 2 spørgsmål før value prop.',
   10, ARRAY['Top12']),
  ('discovery', 'Mangler impact', NULL, 'Standard',
   'Du fandt et problemområde.',
   'Få konsekvens frem i tid/kr/risiko.',
   'Hvad koster det jer (tid/kr), hvis det fortsætter sådan de næste 3 måneder?',
   'Impact formuleres konkret (tid/kr/risiko).',
   10, ARRAY['Top12']),
  ('discovery', 'Mister kontrol/struktur', NULL, 'Standard',
   'Du lyttede og gav plads.',
   'Sæt mini-agenda og styr blødt.',
   'Først 2 min om jeres setup, så siger jeg kort om os, og så aftaler vi næste step—ok?',
   'Samtalen følger agenda + du får next step.',
   5, ARRAY['Top12']),
  ('close', 'For blødt næste step', NULL, 'Standard',
   'Du var høflig og pressede ikke.',
   'Luk med 2 konkrete valgmuligheder + agenda.',
   'Hvis det giver mening, tager vi 15 min—passer tirsdag 10:00 eller onsdag 14:00 bedst?',
   'Booket møde med dato/tid + klar agenda.',
   10, ARRAY['Top12']);