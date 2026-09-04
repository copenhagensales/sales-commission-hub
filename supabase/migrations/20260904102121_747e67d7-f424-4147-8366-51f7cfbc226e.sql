CREATE TABLE public.monthly_goal_first_achievers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_key text NOT NULL,
  month_key text NOT NULL,
  employee_id uuid NOT NULL,
  employee_name text NOT NULL,
  achieved_count numeric NOT NULL,
  goal numeric NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_goal_first_achievers_unique UNIQUE (board_key, month_key)
);

GRANT SELECT ON public.monthly_goal_first_achievers TO authenticated;
GRANT SELECT ON public.monthly_goal_first_achievers TO anon;
GRANT ALL ON public.monthly_goal_first_achievers TO service_role;

ALTER TABLE public.monthly_goal_first_achievers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle kan se maanedens foerste maalopnaaer"
ON public.monthly_goal_first_achievers
FOR SELECT
TO anon, authenticated
USING (true);