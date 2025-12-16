
-- Drop the existing job_title-based policy and create a better one that checks system_roles
DROP POLICY IF EXISTS "SOME job title can manage content_items" ON public.content_items;

-- Create helper function to check if user has 'some' role
CREATE OR REPLACE FUNCTION public.is_some(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role = 'some'
  )
$$;

-- Create new policy that checks system_roles for 'some' role
CREATE POLICY "SOME role can manage content_items"
ON public.content_items
FOR ALL
USING (public.is_some(auth.uid()))
WITH CHECK (public.is_some(auth.uid()));
