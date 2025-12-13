-- Create quiz_templates table to store editable quiz questions
CREATE TABLE public.quiz_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('car_quiz', 'code_of_conduct', 'pulse_survey')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_points JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(quiz_type)
);

-- Enable RLS
ALTER TABLE public.quiz_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read quiz templates (needed for taking the quiz)
CREATE POLICY "Anyone can view quiz templates"
ON public.quiz_templates
FOR SELECT
USING (true);

-- Only owners and teamleders can update quiz templates
CREATE POLICY "Owners and teamleders can manage quiz templates"
ON public.quiz_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM employee_master_data e
    WHERE e.private_email = auth.jwt()->>'email'
    AND e.job_title IN ('Ejer', 'Teamleder')
    AND e.is_active = true
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_quiz_templates_updated_at
BEFORE UPDATE ON public.quiz_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default car quiz questions
INSERT INTO public.quiz_templates (quiz_type, questions, summary_points) VALUES (
  'car_quiz',
  '[
    {"id": 1, "question": "Hvad gælder, når du kører i Copenhagen Sales'' biler?", "options": [{"key": "A", "text": "Færdselsloven gælder kun, hvis bilen bruges til private ture"}, {"key": "B", "text": "Færdselsloven gælder altid, uanset om turen er privat eller erhverv"}, {"key": "C", "text": "Færdselsloven gælder ikke, hvis man kører for en virksomhed"}, {"key": "D", "text": "Det er op til føreren selv, hvilke regler der gælder"}], "correctAnswer": "B"},
    {"id": 2, "question": "Hvad sker der, hvis du kører vandvidskørsel i en Copenhagen Sales-bil?", "options": [{"key": "A", "text": "Virksomheden betaler alle omkostninger, inkl. hvis bilen konfiskeres"}, {"key": "B", "text": "Bilen kan blive konfiskeret, og du hæfter personligt for bilens værdi"}, {"key": "C", "text": "Der sker ikke noget særligt – det er ''kun'' en bøde"}, {"key": "D", "text": "Kun din førerret påvirkes, ikke noget økonomisk"}], "correctAnswer": "B"},
    {"id": 3, "question": "Hvordan er reglerne for privat brug af Copenhagen Sales'' biler?", "options": [{"key": "A", "text": "Det er tilladt frit, så længe man selv betaler benzinen"}, {"key": "B", "text": "Det er kun tilladt, hvis man spørger sin teamleder først"}, {"key": "C", "text": "Privat brug er forbudt og kan medføre skattepligt og konsekvenser ansættelsesmæssigt"}, {"key": "D", "text": "Det er okay, hvis man kun bruger bilen privat uden for arbejdstid"}], "correctAnswer": "C"},
    {"id": 4, "question": "Hvad kan der ske, hvis du alligevel bruger firmabilen privat?", "options": [{"key": "A", "text": "Ingenting, så længe bilen er forsikret"}, {"key": "B", "text": "Du kan blive skattepligtig af fri bil og kan få alvorlige ansættelsesmæssige konsekvenser"}, {"key": "C", "text": "Du får kun en mundtlig advarsel"}, {"key": "D", "text": "Du får automatisk højere løn"}], "correctAnswer": "B"},
    {"id": 5, "question": "Hvad kan der ske, hvis du kører for hurtigt i en Copenhagen Sales-bil på en måde, der anses som alvorlig eller uforsvarlig?", "options": [{"key": "A", "text": "Der sker som udgangspunkt ikke noget, det er jo ''bare'' en fartbøde"}, {"key": "B", "text": "Du kan få en bonus, hvis du når flere møder"}, {"key": "C", "text": "Du kan blive bortvist fra Copenhagen Sales"}, {"key": "D", "text": "Kun bilen bliver ''spærret'' i systemet, men du beholder jobbet"}], "correctAnswer": "C"},
    {"id": 6, "question": "Hvem betaler fartbøder, hvis du kører for hurtigt i en Copenhagen Sales-bil?", "options": [{"key": "A", "text": "Copenhagen Sales betaler altid"}, {"key": "B", "text": "Bøden deles mellem dig og virksomheden"}, {"key": "C", "text": "Din teamleder betaler"}, {"key": "D", "text": "Du betaler selv, da du er ansvarlig for din kørsel"}], "correctAnswer": "D"},
    {"id": 7, "question": "Hvem hæfter for parkeringsafgifter, hvis du parkerer forkert?", "options": [{"key": "A", "text": "Copenhagen Sales betaler automatisk alle parkeringsafgifter"}, {"key": "B", "text": "Din kollega, hvis det er dem, der bookede bilen"}, {"key": "C", "text": "Du hæfter selv for parkeringsafgifter, fordi du har ansvaret for, hvor og hvordan du parkerer"}, {"key": "D", "text": "Ingen betaler, medmindre det går til inkasso"}], "correctAnswer": "C"},
    {"id": 8, "question": "Hvad er korrekt ift. parkering og betaling?", "options": [{"key": "A", "text": "Du skal selv sikre, at du parkerer lovligt – men Copenhagen Sales betaler evt. parkeringsbillet (lovlig parkering)"}, {"key": "B", "text": "Du må parkere, hvor du vil, så længe du er under 10 minutter"}, {"key": "C", "text": "Du skal selv betale både parkering og parkeringsbøder"}, {"key": "D", "text": "Der er ingen regler for parkering, når det er firmabil"}], "correctAnswer": "A"}
  ]'::jsonb,
  '[
    "Færdselsloven gælder ALTID, når du kører i Copenhagen Sales'' biler",
    "Ved vandvidskørsel kan bilen blive konfiskeret, og du hæfter PERSONLIGT for bilens fulde værdi",
    "Privat brug af firmabiler er FORBUDT og kan medføre skattepligt og ansættelsesmæssige konsekvenser",
    "Du betaler SELV alle fartbøder og parkeringsafgifter ved ulovlig parkering",
    "Uforsvarlig kørsel kan medføre BORTVISNING fra Copenhagen Sales",
    "Copenhagen Sales betaler kun for lovlig parkering – du har ansvaret for at parkere korrekt",
    "Din kørsel overvåges via GPS/chip til sikkerhed og dokumentation"
  ]'::jsonb
);

-- Insert default pulse survey questions
INSERT INTO public.quiz_templates (quiz_type, questions) VALUES (
  'pulse_survey',
  '[
    {"id": "nps_score", "label": "NPS", "question": "Hvor sandsynligt er det, at du vil anbefale Copenhagen Sales som arbejdsplads til en ven eller bekendt?", "type": "rating", "min": 0, "max": 10},
    {"id": "development_score", "label": "Udvikling", "question": "I hvor høj grad oplever du, at du bliver uddannet, trænet og udviklet som sælger i dit team?", "type": "rating", "min": 1, "max": 10},
    {"id": "leadership_score", "label": "Ledelse", "question": "Hvor tilfreds er du med den måde, din teamleder leder teamet på?", "type": "rating", "min": 1, "max": 10},
    {"id": "recognition_score", "label": "Anerkendelse", "question": "I hvor høj grad oplever du, at dine præstationer bliver anerkendt og belønnet på en fair måde?", "type": "rating", "min": 1, "max": 10},
    {"id": "energy_score", "label": "Energi", "question": "Hvordan vil du vurdere energien og stemningen i dit team lige nu?", "type": "rating", "min": 1, "max": 10},
    {"id": "seriousness_score", "label": "Seriøsitet", "question": "I hvor høj grad oplever du, at der arbejdes seriøst og målrettet i dit team?", "type": "rating", "min": 1, "max": 10},
    {"id": "leader_availability_score", "label": "Leder tid", "question": "I hvor høj grad oplever du, at din leder har tid og overskud til dig, når du har brug for det?", "type": "rating", "min": 1, "max": 10},
    {"id": "wellbeing_score", "label": "Trivsel", "question": "Hvor godt trives du samlet set i Copenhagen Sales lige nu?", "type": "rating", "min": 1, "max": 10},
    {"id": "psychological_safety_score", "label": "Tryghed", "question": "I hvor høj grad føler du dig tryg ved at sige din ærlige mening i teamet – også når du er uenig eller har kritik?", "type": "rating", "min": 1, "max": 10}
  ]'::jsonb
);