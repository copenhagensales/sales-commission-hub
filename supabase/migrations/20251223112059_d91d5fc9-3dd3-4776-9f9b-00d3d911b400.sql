-- Create table for historical employment data (former employees)
CREATE TABLE public.historical_employment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  team_name text NOT NULL,
  tenure_days integer GENERATED ALWAYS AS (end_date - start_date) STORED,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.historical_employment ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Managers can view historical employment"
ON public.historical_employment
FOR SELECT
TO authenticated
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Owners can manage historical employment"
ON public.historical_employment
FOR ALL
TO authenticated
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));