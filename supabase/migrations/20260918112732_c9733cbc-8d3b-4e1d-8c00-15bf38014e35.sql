CREATE TABLE public.board_monthly_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_key text NOT NULL,
  month_key text NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  employee_id uuid NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  target_amount numeric NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT board_monthly_goals_unique UNIQUE NULLS NOT DISTINCT (board_key, month_key, employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_monthly_goals TO authenticated;
GRANT SELECT ON public.board_monthly_goals TO anon;
GRANT ALL ON public.board_monthly_goals TO service_role;

ALTER TABLE public.board_monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_monthly_goals_select_all"
ON public.board_monthly_goals FOR SELECT
USING (true);

CREATE POLICY "board_monthly_goals_insert_leaders"
ON public.board_monthly_goals FOR INSERT TO authenticated
WITH CHECK (public.effective_is_teamleder_or_above());

CREATE POLICY "board_monthly_goals_update_leaders"
ON public.board_monthly_goals FOR UPDATE TO authenticated
USING (public.effective_is_teamleder_or_above())
WITH CHECK (public.effective_is_teamleder_or_above());

CREATE POLICY "board_monthly_goals_delete_leaders"
ON public.board_monthly_goals FOR DELETE TO authenticated
USING (public.effective_is_teamleder_or_above());

CREATE TRIGGER update_board_monthly_goals_updated_at
BEFORE UPDATE ON public.board_monthly_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_board_monthly_goals_board_month
ON public.board_monthly_goals (board_key, month_key);