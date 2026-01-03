-- Tillad alle autentificerede brugere at se basale info om aktive medarbejdere
-- Dette er nødvendigt for Head-to-Head dueller, messaging og andre samarbejdsfunktioner
CREATE POLICY "Authenticated users can view active employees for h2h"
ON public.employee_master_data
FOR SELECT
TO authenticated
USING (is_active = true);