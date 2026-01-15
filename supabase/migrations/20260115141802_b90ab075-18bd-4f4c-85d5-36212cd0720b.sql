-- Create data_visibility_rules table
CREATE TABLE public.data_visibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  data_scope text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('all', 'team', 'self', 'none')),
  context text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (role_key, data_scope, context)
);

-- Enable RLS
ALTER TABLE public.data_visibility_rules ENABLE ROW LEVEL SECURITY;

-- Everyone can read visibility rules
CREATE POLICY "Everyone can view visibility rules"
ON public.data_visibility_rules
FOR SELECT
USING (true);

-- Only owners can manage visibility rules
CREATE POLICY "Owners can manage visibility rules"
ON public.data_visibility_rules
FOR ALL
USING (public.is_owner(auth.uid()));

-- Insert standard visibility rules for each role and scope

-- Medarbejder rules
INSERT INTO public.data_visibility_rules (role_key, data_scope, visibility, description) VALUES
('medarbejder', 'leaderboard_ranking', 'all', 'Kan se alle på leaderboards med navn og provision'),
('medarbejder', 'sales_count_others', 'all', 'Kan se andres salgsantal'),
('medarbejder', 'h2h_stats', 'all', 'Kan se Head-to-Head statistik for alle'),
('medarbejder', 'commission_details', 'self', 'Kan kun se egen detaljeret provisionsopgørelse'),
('medarbejder', 'salary_breakdown', 'self', 'Kan kun se egen lønspecifikation'),
('medarbejder', 'employee_performance', 'self', 'Kan kun se egen performance-rapport');

-- Teamleder rules
INSERT INTO public.data_visibility_rules (role_key, data_scope, visibility, description) VALUES
('teamleder', 'leaderboard_ranking', 'all', 'Kan se alle på leaderboards'),
('teamleder', 'sales_count_others', 'all', 'Kan se alles salgsantal'),
('teamleder', 'h2h_stats', 'all', 'Kan se Head-to-Head statistik for alle'),
('teamleder', 'commission_details', 'team', 'Kan se teammedlemmers provisionsdetaljer'),
('teamleder', 'salary_breakdown', 'team', 'Kan se teammedlemmers lønspecifikation'),
('teamleder', 'employee_performance', 'team', 'Kan se teammedlemmers performance-rapporter');

-- Rekruttering rules
INSERT INTO public.data_visibility_rules (role_key, data_scope, visibility, description) VALUES
('rekruttering', 'leaderboard_ranking', 'all', 'Kan se alle på leaderboards'),
('rekruttering', 'sales_count_others', 'all', 'Kan se alles salgsantal'),
('rekruttering', 'h2h_stats', 'all', 'Kan se Head-to-Head statistik'),
('rekruttering', 'commission_details', 'self', 'Kan kun se egen provision'),
('rekruttering', 'salary_breakdown', 'self', 'Kan kun se egen løn'),
('rekruttering', 'employee_performance', 'all', 'Kan se alles performance til rekrutteringsformål');

-- SOME rules
INSERT INTO public.data_visibility_rules (role_key, data_scope, visibility, description) VALUES
('some', 'leaderboard_ranking', 'all', 'Kan se alle på leaderboards'),
('some', 'sales_count_others', 'all', 'Kan se alles salgsantal'),
('some', 'h2h_stats', 'all', 'Kan se Head-to-Head statistik'),
('some', 'commission_details', 'self', 'Kan kun se egen provision'),
('some', 'salary_breakdown', 'self', 'Kan kun se egen løn'),
('some', 'employee_performance', 'self', 'Kan kun se egen performance');

-- Ejer rules
INSERT INTO public.data_visibility_rules (role_key, data_scope, visibility, description) VALUES
('ejer', 'leaderboard_ranking', 'all', 'Kan se alle på leaderboards'),
('ejer', 'sales_count_others', 'all', 'Kan se alles salgsantal'),
('ejer', 'h2h_stats', 'all', 'Kan se Head-to-Head statistik for alle'),
('ejer', 'commission_details', 'all', 'Kan se alles provisionsdetaljer'),
('ejer', 'salary_breakdown', 'all', 'Kan se alles lønspecifikation'),
('ejer', 'employee_performance', 'all', 'Kan se alles performance-rapporter');

-- Add trigger for updated_at
CREATE TRIGGER update_data_visibility_rules_updated_at
BEFORE UPDATE ON public.data_visibility_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();