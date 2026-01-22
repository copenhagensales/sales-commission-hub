-- =============================================
-- ØKONOMI-DASHBOARD: Kategorier, Mapping og Budget
-- =============================================

-- 1. Kategorier (de 12 noob-venlige kategorier)
CREATE TABLE public.economic_kategorier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  navn TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  beskrivelse TEXT,
  default_team_id UUID REFERENCES public.teams(id),
  is_expense BOOLEAN DEFAULT true, -- false for Omsætning
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.economic_kategorier ENABLE ROW LEVEL SECURITY;

-- RLS: Alle authenticated kan læse
CREATE POLICY "Authenticated can read kategorier" ON public.economic_kategorier
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS: Kun ejere kan ændre
CREATE POLICY "Owners can manage kategorier" ON public.economic_kategorier
  FOR ALL USING (public.is_owner(auth.uid()));

-- Insert de 12 starter-kategorier med default teams
INSERT INTO public.economic_kategorier (navn, sort_order, beskrivelse, default_team_id, is_expense) VALUES
('Omsætning', 1, 'Indtægter fra salg og ydelser', NULL, false),
('Direkte omkostninger (variabel)', 2, 'Variable omkostninger direkte knyttet til salg', NULL, true),
('Lokaler', 3, 'Husleje, rengøring og drift af lokaler', '09012ce9-e307-4f6d-a51e-f72af7200d74', true), -- Stab
('Software/IT', 4, 'Software, licenser og IT-systemer', '09012ce9-e307-4f6d-a51e-f72af7200d74', true), -- Stab
('Marketing/Annoncer', 5, 'Annoncering og markedsføring', '900fc72c-8710-4933-9fc5-de89a78b03bf', true), -- Fieldmarketing
('Transport/Kørsel', 6, 'Kørsel, brændstof og transport', '900fc72c-8710-4933-9fc5-de89a78b03bf', true), -- Fieldmarketing
('Rejser/Hotel', 7, 'Rejser, hotel og overnatning', '900fc72c-8710-4933-9fc5-de89a78b03bf', true), -- Fieldmarketing
('Markeder/Stadeplads', 8, 'Markeder, messer og stadepladser', '900fc72c-8710-4933-9fc5-de89a78b03bf', true), -- Fieldmarketing
('Bespisning/Restaurant', 9, 'Restauranter og bespisning', '900fc72c-8710-4933-9fc5-de89a78b03bf', true), -- Fieldmarketing
('Rådgivning/Konsulenter', 10, 'Ekstern rådgivning og konsulenter', '09012ce9-e307-4f6d-a51e-f72af7200d74', true), -- Stab
('Administration/Kontor', 11, 'Kontor, porto, telefon, forsikring', '09012ce9-e307-4f6d-a51e-f72af7200d74', true), -- Stab
('Øvrige', 12, 'Uklassificerede eller øvrige udgifter', '09012ce9-e307-4f6d-a51e-f72af7200d74', true); -- Stab

-- 2. Konto-mapping (konto → kategori/team)
CREATE TABLE public.economic_konto_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  konto_nr INTEGER NOT NULL REFERENCES public.economic_kontoplan(konto_nr) ON DELETE CASCADE,
  kategori_id UUID NOT NULL REFERENCES public.economic_kategorier(id),
  team_id UUID REFERENCES public.teams(id),
  active_from DATE DEFAULT '2000-01-01',
  active_to DATE DEFAULT '2099-12-31',
  note TEXT,
  is_auto_suggested BOOLEAN DEFAULT false,
  needs_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(konto_nr, active_from)
);

-- Enable RLS
ALTER TABLE public.economic_konto_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read konto_mapping" ON public.economic_konto_mapping
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can manage konto_mapping" ON public.economic_konto_mapping
  FOR ALL USING (public.is_owner(auth.uid()));

-- Index for hurtige opslag
CREATE INDEX idx_konto_mapping_konto ON public.economic_konto_mapping(konto_nr);
CREATE INDEX idx_konto_mapping_kategori ON public.economic_konto_mapping(kategori_id);
CREATE INDEX idx_konto_mapping_team ON public.economic_konto_mapping(team_id);

-- 3. Fordelingsregler (overrides baseret på tekst/leverandør/kunde)
CREATE TABLE public.economic_fordelingsregler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority INTEGER NOT NULL DEFAULT 50,
  match_field TEXT NOT NULL CHECK (match_field IN ('tekst', 'leverandoer_nr', 'kunde_nr', 'konto_nr')),
  match_operator TEXT NOT NULL CHECK (match_operator IN ('contains', 'equals', 'starts_with', 'ends_with')),
  match_value TEXT NOT NULL,
  kategori_id UUID NOT NULL REFERENCES public.economic_kategorier(id),
  team_id UUID REFERENCES public.teams(id),
  active_from DATE DEFAULT '2000-01-01',
  active_to DATE DEFAULT '2099-12-31',
  note TEXT,
  is_active BOOLEAN DEFAULT true,
  affected_count INTEGER DEFAULT 0, -- Antal posteringer som matcher
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.economic_fordelingsregler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fordelingsregler" ON public.economic_fordelingsregler
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can manage fordelingsregler" ON public.economic_fordelingsregler
  FOR ALL USING (public.is_owner(auth.uid()));

-- Index for hurtige opslag
CREATE INDEX idx_fordelingsregler_priority ON public.economic_fordelingsregler(priority DESC);
CREATE INDEX idx_fordelingsregler_match ON public.economic_fordelingsregler(match_field, is_active);

-- Insert default fordelingsregler
INSERT INTO public.economic_fordelingsregler (priority, match_field, match_operator, match_value, kategori_id, team_id, note) VALUES
(100, 'tekst', 'contains', 'adversus', (SELECT id FROM public.economic_kategorier WHERE navn = 'Software/IT'), '09012ce9-e307-4f6d-a51e-f72af7200d74', 'Adversus dialer software'),
(90, 'tekst', 'contains', 'stadeplads', (SELECT id FROM public.economic_kategorier WHERE navn = 'Markeder/Stadeplads'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Stadepladser'),
(80, 'tekst', 'contains', 'marked', (SELECT id FROM public.economic_kategorier WHERE navn = 'Markeder/Stadeplads'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Markedsudgifter'),
(70, 'tekst', 'contains', 'hotel', (SELECT id FROM public.economic_kategorier WHERE navn = 'Rejser/Hotel'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Hotelovernatning'),
(60, 'tekst', 'contains', 'rejse', (SELECT id FROM public.economic_kategorier WHERE navn = 'Rejser/Hotel'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Rejseudgifter'),
(50, 'tekst', 'contains', 'restaur', (SELECT id FROM public.economic_kategorier WHERE navn = 'Bespisning/Restaurant'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Restaurantbesøg'),
(50, 'tekst', 'contains', 'bespis', (SELECT id FROM public.economic_kategorier WHERE navn = 'Bespisning/Restaurant'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Bespisning'),
(40, 'tekst', 'contains', 'km', (SELECT id FROM public.economic_kategorier WHERE navn = 'Transport/Kørsel'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Kørselsgodtgørelse'),
(40, 'tekst', 'contains', 'brændstof', (SELECT id FROM public.economic_kategorier WHERE navn = 'Transport/Kørsel'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Brændstof'),
(40, 'tekst', 'contains', 'braendstof', (SELECT id FROM public.economic_kategorier WHERE navn = 'Transport/Kørsel'), '900fc72c-8710-4933-9fc5-de89a78b03bf', 'Brændstof (alt. stavning)');

-- 4. Budget-linjer
CREATE TABLE public.economic_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  team_id UUID REFERENCES public.teams(id),
  kategori_id UUID NOT NULL REFERENCES public.economic_kategorier(id),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(year, month, team_id, kategori_id)
);

-- Enable RLS
ALTER TABLE public.economic_budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read budget" ON public.economic_budget_lines
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can manage budget" ON public.economic_budget_lines
  FOR ALL USING (public.is_owner(auth.uid()));

-- Index
CREATE INDEX idx_budget_year_month ON public.economic_budget_lines(year, month);
CREATE INDEX idx_budget_team ON public.economic_budget_lines(team_id);
CREATE INDEX idx_budget_kategori ON public.economic_budget_lines(kategori_id);

-- 5. Baseline-eksklusioner (hvilke kategorier brugeren vil ekskludere)
CREATE TABLE public.economic_baseline_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  kategori_id UUID NOT NULL REFERENCES public.economic_kategorier(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, kategori_id)
);

-- Enable RLS
ALTER TABLE public.economic_baseline_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own exclusions" ON public.economic_baseline_exclusions
  FOR ALL USING (auth.uid() = user_id);

-- 6. Funktion til auto-mapping af konti baseret på navn
CREATE OR REPLACE FUNCTION public.auto_suggest_konto_mapping()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
  v_konto RECORD;
  v_kategori_id UUID;
  v_oevrige_id UUID;
BEGIN
  -- Hent "Øvrige" kategori som fallback
  SELECT id INTO v_oevrige_id FROM economic_kategorier WHERE navn = 'Øvrige';
  
  -- Loop gennem alle konti uden mapping
  FOR v_konto IN 
    SELECT k.konto_nr, k.navn 
    FROM economic_kontoplan k
    WHERE NOT EXISTS (
      SELECT 1 FROM economic_konto_mapping m WHERE m.konto_nr = k.konto_nr
    )
  LOOP
    v_kategori_id := NULL;
    
    -- Match baseret på kontonavn (case-insensitive)
    IF LOWER(v_konto.navn) LIKE '%husleje%' OR LOWER(v_konto.navn) LIKE '%rengør%' OR LOWER(v_konto.navn) LIKE '%rengoring%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Lokaler';
    ELSIF LOWER(v_konto.navn) LIKE '%edb%' OR LOWER(v_konto.navn) LIKE '%software%' OR LOWER(v_konto.navn) LIKE '%licen%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Software/IT';
    ELSIF LOWER(v_konto.navn) LIKE '%annonc%' OR LOWER(v_konto.navn) LIKE '%reklame%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Marketing/Annoncer';
    ELSIF LOWER(v_konto.navn) LIKE '%stadeplads%' OR LOWER(v_konto.navn) LIKE '%marked%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Markeder/Stadeplads';
    ELSIF LOWER(v_konto.navn) LIKE '%rejse%' OR LOWER(v_konto.navn) LIKE '%hotel%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Rejser/Hotel';
    ELSIF LOWER(v_konto.navn) LIKE '%km%' OR LOWER(v_konto.navn) LIKE '%kørsel%' OR LOWER(v_konto.navn) LIKE '%brændstof%' OR LOWER(v_konto.navn) LIKE '%braendstof%' OR LOWER(v_konto.navn) LIKE '%bil%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Transport/Kørsel';
    ELSIF LOWER(v_konto.navn) LIKE '%restaur%' OR LOWER(v_konto.navn) LIKE '%bespis%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Bespisning/Restaurant';
    ELSIF LOWER(v_konto.navn) LIKE '%rådgiv%' OR LOWER(v_konto.navn) LIKE '%konsulent%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Rådgivning/Konsulenter';
    ELSIF LOWER(v_konto.navn) LIKE '%kontor%' OR LOWER(v_konto.navn) LIKE '%porto%' OR LOWER(v_konto.navn) LIKE '%telefon%' OR LOWER(v_konto.navn) LIKE '%forsikring%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Administration/Kontor';
    ELSIF LOWER(v_konto.navn) LIKE '%direkte omkost%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Direkte omkostninger (variabel)';
    ELSIF LOWER(v_konto.navn) LIKE '%omsætning%' OR LOWER(v_konto.navn) LIKE '%salg%' OR LOWER(v_konto.navn) LIKE '%indtægt%' THEN
      SELECT id INTO v_kategori_id FROM economic_kategorier WHERE navn = 'Omsætning';
    END IF;
    
    -- Brug fallback hvis ingen match
    IF v_kategori_id IS NULL THEN
      v_kategori_id := v_oevrige_id;
    END IF;
    
    -- Indsæt mapping med is_auto_suggested = true
    INSERT INTO economic_konto_mapping (konto_nr, kategori_id, team_id, is_auto_suggested, needs_review)
    SELECT 
      v_konto.konto_nr, 
      v_kategori_id, 
      k.default_team_id, 
      true,
      true
    FROM economic_kategorier k
    WHERE k.id = v_kategori_id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- 7. View: posteringer_enriched (joiner alt sammen)
CREATE OR REPLACE VIEW public.posteringer_enriched AS
WITH regel_matches AS (
  -- Find matchende fordelingsregler for hver postering
  SELECT DISTINCT ON (p.loebe_nr)
    p.loebe_nr,
    r.kategori_id AS regel_kategori_id,
    r.team_id AS regel_team_id,
    r.priority
  FROM economic_posteringer p
  CROSS JOIN economic_fordelingsregler r
  WHERE r.is_active = true
    AND p.dato >= r.active_from
    AND p.dato <= r.active_to
    AND (
      (r.match_field = 'tekst' AND r.match_operator = 'contains' AND LOWER(COALESCE(p.tekst, '')) LIKE '%' || LOWER(r.match_value) || '%')
      OR (r.match_field = 'tekst' AND r.match_operator = 'equals' AND LOWER(COALESCE(p.tekst, '')) = LOWER(r.match_value))
      OR (r.match_field = 'tekst' AND r.match_operator = 'starts_with' AND LOWER(COALESCE(p.tekst, '')) LIKE LOWER(r.match_value) || '%')
      OR (r.match_field = 'tekst' AND r.match_operator = 'ends_with' AND LOWER(COALESCE(p.tekst, '')) LIKE '%' || LOWER(r.match_value))
      OR (r.match_field = 'leverandoer_nr' AND r.match_operator = 'equals' AND p.leverandoer_nr::text = r.match_value)
      OR (r.match_field = 'kunde_nr' AND r.match_operator = 'equals' AND p.kunde_nr::text = r.match_value)
      OR (r.match_field = 'konto_nr' AND r.match_operator = 'equals' AND p.konto_nr::text = r.match_value)
    )
  ORDER BY p.loebe_nr, r.priority DESC
)
SELECT
  p.loebe_nr,
  TO_CHAR(p.dato, 'YYYY-MM') AS maaned,
  p.dato,
  p.konto_nr,
  k.navn AS kontonavn,
  p.tekst,
  p.beloeb_dkk,
  p.leverandoer_nr,
  p.kunde_nr,
  p.bilags_nr,
  -- Kategori: regel > mapping > fallback
  COALESCE(
    rkat.navn,
    mkat.navn,
    'Øvrige'
  ) AS kategori,
  COALESCE(rm.regel_kategori_id, m.kategori_id, (SELECT id FROM economic_kategorier WHERE navn = 'Øvrige')) AS kategori_id,
  -- Team: regel > mapping > kategori default > fallback
  COALESCE(
    rt.name,
    mt.name,
    mkat_default_t.name,
    'Stab'
  ) AS team,
  COALESCE(rm.regel_team_id, m.team_id, mkat.default_team_id, '09012ce9-e307-4f6d-a51e-f72af7200d74') AS team_id,
  -- Metadata
  CASE 
    WHEN rm.loebe_nr IS NOT NULL THEN 'regel'
    WHEN m.id IS NOT NULL THEN 'mapping'
    ELSE 'fallback'
  END AS klassificering_kilde,
  COALESCE(m.needs_review, rm.loebe_nr IS NULL AND m.id IS NULL) AS needs_review,
  p.import_id
FROM economic_posteringer p
LEFT JOIN economic_kontoplan k ON k.konto_nr = p.konto_nr
LEFT JOIN regel_matches rm ON rm.loebe_nr = p.loebe_nr
LEFT JOIN economic_konto_mapping m ON m.konto_nr = p.konto_nr 
  AND p.dato >= m.active_from AND p.dato <= m.active_to
LEFT JOIN economic_kategorier rkat ON rkat.id = rm.regel_kategori_id
LEFT JOIN economic_kategorier mkat ON mkat.id = m.kategori_id
LEFT JOIN teams rt ON rt.id = rm.regel_team_id
LEFT JOIN teams mt ON mt.id = m.team_id
LEFT JOIN teams mkat_default_t ON mkat_default_t.id = mkat.default_team_id;

-- Grant access to view
GRANT SELECT ON public.posteringer_enriched TO authenticated;

-- 8. Hjælpe-funktion til at opdatere affected_count på regler
CREATE OR REPLACE FUNCTION public.update_fordelingsregel_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE economic_fordelingsregler r
  SET affected_count = (
    SELECT COUNT(*)
    FROM economic_posteringer p
    WHERE r.is_active = true
      AND p.dato >= r.active_from
      AND p.dato <= r.active_to
      AND (
        (r.match_field = 'tekst' AND r.match_operator = 'contains' AND LOWER(COALESCE(p.tekst, '')) LIKE '%' || LOWER(r.match_value) || '%')
        OR (r.match_field = 'tekst' AND r.match_operator = 'equals' AND LOWER(COALESCE(p.tekst, '')) = LOWER(r.match_value))
        OR (r.match_field = 'tekst' AND r.match_operator = 'starts_with' AND LOWER(COALESCE(p.tekst, '')) LIKE LOWER(r.match_value) || '%')
        OR (r.match_field = 'tekst' AND r.match_operator = 'ends_with' AND LOWER(COALESCE(p.tekst, '')) LIKE '%' || LOWER(r.match_value))
        OR (r.match_field = 'leverandoer_nr' AND r.match_operator = 'equals' AND p.leverandoer_nr::text = r.match_value)
        OR (r.match_field = 'kunde_nr' AND r.match_operator = 'equals' AND p.kunde_nr::text = r.match_value)
        OR (r.match_field = 'konto_nr' AND r.match_operator = 'equals' AND p.konto_nr::text = r.match_value)
      )
  );
END;
$$;