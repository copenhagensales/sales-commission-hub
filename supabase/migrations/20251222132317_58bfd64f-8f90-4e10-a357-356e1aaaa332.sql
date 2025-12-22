-- Create table for TV board access codes
CREATE TABLE public.tv_board_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_slug text NOT NULL,
  access_code text NOT NULL UNIQUE,
  name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.tv_board_access ENABLE ROW LEVEL SECURITY;

-- Policy for public read access with valid code (needed for TV boards)
CREATE POLICY "Anyone can verify access codes"
  ON public.tv_board_access
  FOR SELECT
  USING (is_active = true);

-- Policy for admins to manage access codes
CREATE POLICY "Authenticated users can manage access codes"
  ON public.tv_board_access
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to generate random access code
CREATE OR REPLACE FUNCTION public.generate_access_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;