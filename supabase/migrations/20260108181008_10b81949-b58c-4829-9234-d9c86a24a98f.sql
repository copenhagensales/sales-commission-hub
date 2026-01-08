-- Allow all authenticated users to view basic info of active employees for H2H feature
CREATE POLICY "Authenticated users can view active employees for h2h"
ON public.employee_master_data
FOR SELECT
USING (
  is_active = true 
  AND auth.role() = 'authenticated'
);