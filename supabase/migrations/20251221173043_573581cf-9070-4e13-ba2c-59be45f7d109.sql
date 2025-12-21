-- Update week expectations with new config
UPDATE public.onboarding_week_expectations SET
  title = 'Uge 1 – Lær at ringe',
  measure_on = ARRAY['aktivitet', 'BALA-adfærd', 'coaching + drills'],
  do_not_measure_on = ARRAY['omsætning', 'lukkerate', 'rutineret lyd'],
  good_day_definition = 'Du ringer, følger strukturen, og spørger om køb i relevante samtaler.',
  note = '0–5.000 kr i uge 1 kan være en rigtig god start.'
WHERE week_number = 1;

UPDATE public.onboarding_week_expectations SET
  title = 'Uge 2 – Lær at konvertere',
  measure_on = ARRAY['stabil aktivitet', 'BALA-score trend', 'ro ved indvendinger'],
  do_not_measure_on = ARRAY['topperformance', 'sammenligning med seniors'],
  good_day_definition = 'Kvaliteten er mere stabil end uge 1, og du forsøger at lukke i relevante samtaler.',
  note = 'Uge 2 handler om stabilitet – ikke perfektion.'
WHERE week_number = 2;

UPDATE public.onboarding_week_expectations SET
  title = 'Uge 3 – Bliv selvstændig',
  measure_on = ARRAY['selvstændighed', 'feedback → handling', 'stabil rytme'],
  do_not_measure_on = ARRAY['endeligt lønniveau', 'perfekt teknik'],
  good_day_definition = 'Du kan føre samtaler igennem uden at miste struktur og omsætter feedback hurtigt.',
  note = 'Uge 3 handler om klarhed og ejerskab – ikke at være færdig.'
WHERE week_number = 3;

-- Add leader_script column for the performance scripts
ALTER TABLE public.onboarding_days ADD COLUMN IF NOT EXISTS leader_script TEXT;

-- Add coaching_schedule_tag for W2_MWF and W3_TT patterns
ALTER TABLE public.onboarding_days ADD COLUMN IF NOT EXISTS coaching_schedule_tag TEXT;

-- Update all 15 days with the new detailed config
-- Day 1
UPDATE public.onboarding_days SET
  focus_id = 'START',
  focus_title = 'Kom i gang på telefonen',
  focus_description = 'Mod + rytme',
  daily_message = 'I dag er en god dag, hvis du ringer og får hul igennem. Omsætning er sekundært. Fokus er mod + rytme.',
  call_mission = 'Nå åbning + 1 behovsspørgsmål i så mange samtaler som muligt. Log kort.',
  checkout_blockers = ARRAY['Åbning', 'Indvendinger', 'Stilhed', 'Luk'],
  drill_id = 'OPENING_TO_QUESTION',
  drill_title = 'Åbning → behovsspørgsmål',
  drill_duration_min = 6,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = 'Velkomst + performance-ramme uge 1',
  leader_course_duration_min = 40,
  leader_course_ppt_id = 'W1_D1_WELCOME',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1,
  leader_script = 'Velkommen. Før vi går i gang: de første uger handler ikke om at være ''top-sælger''. De handler om at lære rytmen og blive tryg på telefonen.

I uge 1 måler vi dig på tre ting:
- at du ringer hver dag,
- at du prøver at følge vores struktur (BALA),
- og at du tager imod coaching og laver de drills du får.

Vi måler dig ikke på store tal i uge 1. Hvis du tjener 0–5.000 kroner i den første uge, kan det stadig være en rigtig god start, hvis du gør de rigtige ting.

Det vigtigste i dag: du får hul igennem, du prøver, og du bliver coachet tæt. Ingen forventer perfektion – vi forventer indsats og læring.'
WHERE day = 1 AND week = 1;

-- Day 2
UPDATE public.onboarding_days SET
  focus_id = 'OBJECTION',
  focus_title = 'Indvendinger uden panik',
  focus_description = 'Hold roen ved modstand',
  daily_message = 'I dag er en god dag, hvis du møder indvendinger og holder roen. Du skal ikke vinde alle – du skal blive stabil.',
  call_mission = 'Få mindst 3 indvendinger og kom tilbage til et spørgsmål hver gang. Ingen argumentation.',
  checkout_blockers = ARRAY['Indvendinger', 'Tempo', 'Stilhed', 'Struktur'],
  drill_id = 'OBJECTION_PING_PONG',
  drill_title = 'Indvendinger hurtig-respons',
  drill_duration_min = 10,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = 'Top-10 indvendinger + 2-trins respons',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W1_D2_OBJECTIONS',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1
WHERE day = 2 AND week = 1;

-- Day 3
UPDATE public.onboarding_days SET
  focus_id = 'B',
  focus_title = 'Behovsaktiverende spørgsmål',
  focus_description = 'Pitch mindre. Spørg mere.',
  daily_message = 'I dag er en god dag, hvis du stiller 2 gode behovsspørgsmål pr relevant samtale. Pitch mindre. Spørg mere.',
  call_mission = 'Min. 2 behovsspørgsmål + 1 opfølgning i relevante samtaler.',
  checkout_blockers = ARRAY['Spørgsmål', 'Tempo', 'Stilhed'],
  drill_id = 'QUESTION_LADDER',
  drill_title = 'Spørgsmåls-ladder',
  drill_duration_min = 8,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = 'Spørgestige + tempo',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W1_D3_NEEDS',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1
WHERE day = 3 AND week = 1;

-- Day 4
UPDATE public.onboarding_days SET
  focus_id = 'A_SOLUTION',
  focus_title = 'Spørg om køb (lukning intro)',
  focus_description = 'Turde spørge',
  daily_message = 'I dag er en god dag, hvis du spørger om accept i relevante samtaler. Målet er at turde spørge – ikke at alle siger ja.',
  call_mission = 'Spørg om accept i alle relevante samtaler. Tæl antal asks.',
  checkout_blockers = ARRAY['Lukning', 'Stilhed', 'Selvtillid'],
  drill_id = 'ASK_FOR_THE_ORDER',
  drill_title = 'Spørg om købet',
  drill_duration_min = 6,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = '3 standard-asks + stilhed',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W1_D4_CLOSE_INTRO',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1
WHERE day = 4 AND week = 1;

-- Day 5
UPDATE public.onboarding_days SET
  focus_id = 'A_NEED',
  focus_title = 'Accept på behov (opsummering)',
  focus_description = 'Fundament for salg',
  daily_message = 'I dag er en god dag, hvis du får accept på behov før du pitcher. Det er fundamentet for alt senere salg.',
  call_mission = 'Min. 5 gange: opsummer behov i én sætning + få ''fair?'' accept.',
  checkout_blockers = ARRAY['Opsummering', 'Stilhed', 'Tempo'],
  drill_id = 'NEEDS_SUMMARY_7SEC',
  drill_title = '7-sekund opsummering',
  drill_duration_min = 6,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = 'Accept på behov: sådan lyder det',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W1_D5_NEED_ACCEPT',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1
WHERE day = 5 AND week = 1;

-- Day 6
UPDATE public.onboarding_days SET
  focus_id = 'OPENING',
  focus_title = 'Den gode indledning + struktur',
  focus_description = 'Stabilitet > enkelt-salg',
  daily_message = 'Uge 2 starter nu: i dag er en god dag, hvis dine samtaler er mere strukturerede end i uge 1. Stabilitet > enkelt-salg.',
  call_mission = 'Start alle relevante samtaler med ramme + overgang til behov. Hold strukturen.',
  checkout_blockers = ARRAY['Struktur', 'Tempo', 'Overgang til behov'],
  drill_id = 'STRUCTURED_OPENING',
  drill_title = 'Struktureret åbning',
  drill_duration_min = 6,
  quiz_questions = 4,
  quiz_pass_score = 80,
  leader_course_title = 'Performance-ramme uge 2 + struktur',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W2_D6_STRUCTURE',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1,
  coaching_schedule_tag = 'W2_MWF',
  leader_script = 'Nu starter uge 2. I uge 1 handlede det om mod og rytme. I uge 2 handler det om stabilitet og kvalitet.

Det vi kigger efter nu er: at du rammer strukturen mere konsekvent, at du håndterer indvendinger roligere, og at du forsøger at lukke i de samtaler hvor det giver mening.

Vi sammenligner dig ikke med de erfarne sælgere. Vi sammenligner dig med dig selv fra sidste uge. Hvis du er mere stabil end uge 1, så går det den rigtige vej.'
WHERE day = 6 AND week = 2;

-- Day 7
UPDATE public.onboarding_days SET
  focus_id = 'B',
  focus_title = 'EFU + forberedelse',
  focus_description = 'Kvalitet > snak',
  daily_message = 'I dag er en god dag, hvis du går lidt dybere i behov uden at miste tempo. Kvalitet > snak.',
  call_mission = 'I 10 samtaler: brug EFU mindst én gang (1 opfølgning er nok).',
  checkout_blockers = ARRAY['Dybde', 'Tempo', 'Opsummering'],
  drill_id = 'EFU_LADDER',
  drill_title = 'EFU-stigen',
  drill_duration_min = 8,
  quiz_questions = 4,
  quiz_pass_score = 80,
  leader_course_title = 'EFU i praksis (1–2 opfølgninger max)',
  leader_course_duration_min = 25,
  leader_course_ppt_id = 'W2_D7_EFU',
  coaching_required = false
WHERE day = 7 AND week = 2;

-- Day 8
UPDATE public.onboarding_days SET
  focus_id = 'PRICE',
  focus_title = 'Pris (behov + indvending)',
  focus_description = 'Ingen rabat-refleks',
  daily_message = 'I dag er en god dag, hvis du håndterer ''dyrt'' roligt og fører tilbage til behov. Ingen rabat-refleks.',
  call_mission = 'Håndtér 3 pris-reaktioner roligt: anerkend → spørg → tilbage til behov.',
  checkout_blockers = ARRAY['Pris', 'Ro', 'Tilbage til behov'],
  drill_id = 'PRICE_DEFUSE',
  drill_title = 'Pris-defusering',
  drill_duration_min = 10,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = 'Pris som behov (værdi før pris)',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W2_D8_PRICE',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1,
  coaching_schedule_tag = 'W2_MWF'
WHERE day = 8 AND week = 2;

-- Day 9
UPDATE public.onboarding_days SET
  focus_id = 'L',
  focus_title = 'Præsentation af løsning (value bridge)',
  focus_description = 'Kort pitch koblet til behov',
  daily_message = 'I dag er en god dag, hvis din pitch er kort og koblet til behov. Mini-accept efter pitch.',
  call_mission = 'Pitch ≤ 20 sek i relevante samtaler + spørg ''giver det mening?'' og hold pause.',
  checkout_blockers = ARRAY['Pitch', 'Mini-accept', 'Stilhed'],
  drill_id = 'VALUE_BRIDGE_20SEC',
  drill_title = '20-sekund værdibro',
  drill_duration_min = 6,
  quiz_questions = 4,
  quiz_pass_score = 80,
  leader_course_title = 'Value bridge: behov → løsning → effekt',
  leader_course_duration_min = 25,
  leader_course_ppt_id = 'W2_D9_VALUE',
  coaching_required = false
WHERE day = 9 AND week = 2;

-- Day 10
UPDATE public.onboarding_days SET
  focus_id = 'A_SOLUTION',
  focus_title = 'Antagelse + lukning',
  focus_description = 'Luk roligt ved momentum',
  daily_message = 'I dag er en god dag, hvis du lukker roligt når du har momentum. Forsøg i de rigtige samtaler – ikke pres i alle.',
  call_mission = 'Lav 5 konkrete next-steps (tid/agenda) hvis ikke ja. Luk roligt når der er købssignal.',
  checkout_blockers = ARRAY['Timing', 'Ask', 'Next step'],
  drill_id = 'ASSUMPTIVE_CLOSE',
  drill_title = 'Antagelseslukning',
  drill_duration_min = 6,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = 'Antagelse uden pres + next-step kontrol',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W2_D10_ASSUMPTION',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1,
  coaching_schedule_tag = 'W2_MWF'
WHERE day = 10 AND week = 2;

-- Day 11
UPDATE public.onboarding_days SET
  focus_id = 'URGENCY',
  focus_title = 'Urgency (legitim fremdrift)',
  focus_description = 'Fremdrift uden pres',
  daily_message = 'Uge 3: i dag er en god dag, hvis du skaber fremdrift uden pres og ejer samtalen mere selvstændigt.',
  call_mission = 'I 10 relevante samtaler: brug 1 urgency-vinkel (konsekvens/plan) + spørg om accept.',
  checkout_blockers = ARRAY['Fremdrift', 'Pres', 'Ask'],
  drill_id = 'LEGIT_URGENCY',
  drill_title = 'Legitim urgency',
  drill_duration_min = 6,
  quiz_questions = 4,
  quiz_pass_score = 80,
  leader_course_title = 'Performance-ramme uge 3 + urgency uden manipulation',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W3_D11_URGENCY',
  coaching_required = false,
  leader_script = 'Uge 3 handler om at du bliver mere selvstændig. Ikke perfekt – men mere selvkørende.

Det vi kigger efter nu er: at du kan føre en samtale igennem uden at miste struktur, at du omsætter feedback hurtigt, og at du holder en stabil rytme.

Det vigtigste er ikke dit endelige lønniveau endnu. Det vigtigste er at du viser, at du kan bygge en vane og en metode. Det er den metode, der giver dig de store måneder senere.'
WHERE day = 11 AND week = 3;

-- Day 12
UPDATE public.onboarding_days SET
  focus_id = 'CALLBACK',
  focus_title = 'Callbacks (kvalificér + book konkret)',
  focus_description = 'Ingen løse ender',
  daily_message = 'I dag er en god dag, hvis du ikke efterlader løse ender. Alle callbacks skal have tid + agenda + kriterie.',
  call_mission = 'Ingen callback uden tid + agenda + ''hvad mangler for ja?''.',
  checkout_blockers = ARRAY['Callbacks', 'Kontrol', 'Next step'],
  drill_id = 'QUALIFIED_CALLBACK',
  drill_title = 'Kvalificeret callback',
  drill_duration_min = 8,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = 'Callback disciplin (kvalificér eller luk)',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W3_D12_CALLBACKS',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1,
  coaching_schedule_tag = 'W3_TT'
WHERE day = 12 AND week = 3;

-- Day 13
UPDATE public.onboarding_days SET
  focus_id = 'A_SOLUTION',
  focus_title = 'Luk på købssignaler (advanced)',
  focus_description = 'Reager hurtigt på delaccepter',
  daily_message = 'I dag er en god dag, hvis du reagerer hurtigt på delaccepter og lukker uden at overforklare.',
  call_mission = 'Fang 5 delaccepter og luk direkte på dem (inden 5 sek).',
  checkout_blockers = ARRAY['Timing', 'Stilhed', 'Ask'],
  drill_id = 'CLOSE_ON_SIGNAL',
  drill_title = 'Luk på signal',
  drill_duration_min = 8,
  quiz_questions = 5,
  quiz_pass_score = 80,
  leader_course_title = 'Delaccept → ask (ingen forklaring)',
  leader_course_duration_min = 25,
  leader_course_ppt_id = 'W3_D13_SIGNALS',
  coaching_required = false
WHERE day = 13 AND week = 3;

-- Day 14
UPDATE public.onboarding_days SET
  focus_id = 'STRUCTURE',
  focus_title = 'Typiske fejl + clean pipeline',
  focus_description = 'Arbejd renere',
  daily_message = 'I dag er en god dag, hvis du arbejder renere: struktur, next step, ingen rod. Det er sådan du bliver selvstændig.',
  call_mission = 'Ingen samtale uden næste skridt. Hold styr på dispositioner og opfølgning.',
  checkout_blockers = ARRAY['Struktur', 'Next step', 'Overblik'],
  drill_id = 'CLEAN_PIPELINE',
  drill_title = 'Ren pipeline',
  drill_duration_min = 5,
  quiz_questions = 4,
  quiz_pass_score = 80,
  leader_course_title = 'Top rookie-fejl + fix i morgen',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W3_D14_MISTAKES',
  coaching_required = true,
  coaching_focus_only = true,
  coaching_reviews_per_rep = 1,
  coaching_schedule_tag = 'W3_TT'
WHERE day = 14 AND week = 3;

-- Day 15
UPDATE public.onboarding_days SET
  focus_id = 'MINDSET',
  focus_title = 'Mentalitet + graduation',
  focus_description = 'Klarhed > perfektion',
  daily_message = 'I dag er en god dag, hvis du kan beskrive din styrke, dit fokus og din plan fremad. Klarhed > perfektion.',
  call_mission = 'Hold rytmen og brug din ''1 sætning'' aktivt. Afslut uge 3 med stabilitet.',
  checkout_blockers = ARRAY['Energi', 'Selvtillid', 'Struktur'],
  drill_id = 'RESET_AFTER_NO',
  drill_title = 'Reset efter nej',
  drill_duration_min = 3,
  quiz_questions = 6,
  quiz_pass_score = 80,
  leader_course_title = 'Graduation + plan uge 4–8',
  leader_course_duration_min = 30,
  leader_course_ppt_id = 'W3_D15_GRADUATION',
  coaching_required = false
WHERE day = 15 AND week = 3;