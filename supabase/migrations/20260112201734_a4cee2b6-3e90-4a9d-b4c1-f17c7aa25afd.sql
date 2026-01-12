-- Tilføj ny KPI definition: Vagter
INSERT INTO public.kpi_definitions (
  slug,
  name,
  category,
  description,
  calculation_formula,
  sql_query,
  data_sources,
  important_notes,
  example_value
) VALUES (
  'shifts',
  'Vagter',
  'hours',
  'Definerer hvad en vagt er. Enhver synlig vagt i Vagtplan leder tæller som en gyldig vagt - uanset om den kommer fra individuel undtagelse eller team-standardindstillinger.',
  E'VAGT DEFINITION:\nEn vagt eksisterer hvis mindst ÉN af følgende er opfyldt:\n1. Individuel undtagelse findes (shift tabel)\n2. Team dag-specifik konfiguration findes (team_standard_shift_days)\n3. Team general fallback findes (team_standard_shifts WHERE is_primary = true)\n\nALLE tre niveauer tæller som en GYLDIG VAGT!\n\nVAGT-HIERARKI (for at bestemme HVILKEN vagt der vises):\n1. Individuel undtagelse prioriteres højest\n2. Team dag-specifik næsthøjest\n3. Team general fallback bruges hvis intet andet findes\n\nTIMER-BEREGNING (baseret på hours_source fra team_standard_shifts):\n- "shift": Timer = (end_time - start_time) - pause\n- "timestamp": Timer = effective_hours ELLER (clock_out - clock_in - break_minutes)\n\nPAUSE-BEREGNING:\n- Eksplicit break_minutes fra shift/time_stamps\n- team_shift_breaks (generel eller dag-specifik)\n- Standard 30 min for vagter over 6 timer\n\n"VAGT MANGLER" DEFINITION:\n- Medarbejderen har salg den dag\n- OG ingen vagt i HELE hierarkiet (hverken individuel, team-dag eller team-fallback)\n- OG ingen time_stamps for datoen',
  E'-- Tjek om medarbejder har en vagt på dato (fra et hvilket som helst niveau)\nWITH employee_team AS (\n  SELECT tm.employee_id, tm.team_id\n  FROM team_members tm\n  WHERE tm.employee_id = :employee_id\n  LIMIT 1\n),\nhas_shift AS (\n  -- Niveau 1: Individuel undtagelse\n  SELECT TRUE as has_shift, ''individual'' as source\n  FROM shift\n  WHERE employee_id = :employee_id AND date = :date\n  \n  UNION ALL\n  \n  -- Niveau 2: Team dag-specifik\n  SELECT TRUE as has_shift, ''team_day'' as source\n  FROM employee_team et\n  JOIN team_standard_shifts tss ON et.team_id = tss.team_id AND tss.is_primary = true\n  JOIN team_standard_shift_days tssd ON tss.id = tssd.shift_id\n  WHERE tssd.day_of_week = EXTRACT(ISODOW FROM :date::date)\n  \n  UNION ALL\n  \n  -- Niveau 3: Team general fallback (kun hverdage)\n  SELECT TRUE as has_shift, ''team_fallback'' as source\n  FROM employee_team et\n  JOIN team_standard_shifts tss ON et.team_id = tss.team_id AND tss.is_primary = true\n  WHERE EXTRACT(ISODOW FROM :date::date) NOT IN (6, 7)\n)\nSELECT \n  CASE WHEN EXISTS (SELECT 1 FROM has_shift) \n       THEN TRUE \n       ELSE FALSE \n  END as har_vagt;',
  ARRAY['shift', 'team_standard_shifts', 'team_standard_shift_days', 'team_shift_breaks', 'team_members', 'time_stamps'],
  ARRAY[
    'Alle synlige vagter tæller - Hvis en vagt vises i Vagtplan leder, er det en gyldig vagt (uanset kilde)',
    'Team-standard = gyldig vagt - En medarbejder med team-standard vagt har en vagt, selvom der ikke er individuel undtagelse',
    'Vagtplan leder er autoritativ - ShiftOverview.tsx er kilden til sandhed',
    'hours_source bestemmer timer - "shift" bruger planlagte tider, "timestamp" bruger faktiske stemplinger',
    'Weekend-logik - Weekender viser kun vagter med eksplicit dag-konfiguration (team_standard_shift_days)',
    'Vagt mangler - Kun hvis INGEN vagt findes i hele hierarkiet OG medarbejder har aktivitet',
    'day_of_week konvention - Database bruger 1=mandag til 7=søndag (ISODOW format)',
    'is_primary - Kun den primære team-vagt bruges til fallback-beregninger'
  ],
  E'Eksempel:\n\nAnders Schmidt (Relatel): 08:00-16:00\n→ Kommer fra team_standard_shifts (fallback)\n→ TÆLLER SOM EN VAGT ✓\n\nAlem Dashamir (United): 08:33-16:30, 7.0t\n→ Kommer fra shift tabel (individuel undtagelse)\n→ TÆLLER SOM EN VAGT ✓\n\nBegge har en gyldig vagt - kilden er irrelevant!'
);