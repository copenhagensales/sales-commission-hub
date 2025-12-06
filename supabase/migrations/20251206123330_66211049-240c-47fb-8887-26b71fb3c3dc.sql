
-- Create a function to check if user is owner only (not teamleder)
CREATE OR REPLACE FUNCTION public.is_owner_only(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role = 'ejer'
  )
$$;

-- Create a function to check if employee is in user's team or user is owner
CREATE OR REPLACE FUNCTION public.can_view_employee(_employee_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Owners can see everyone
    public.is_owner(_user_id)
    OR
    -- Teamledere can see employees in their team (where they are the manager)
    EXISTS (
      SELECT 1 FROM public.employee_master_data
      WHERE id = _employee_id 
      AND manager_id = public.get_employee_id_for_user(_user_id)
    )
    OR
    -- Teamledere can see themselves
    _employee_id = public.get_employee_id_for_user(_user_id)
$$;

-- Drop existing policies that give teamledere too much access
DROP POLICY IF EXISTS "Managers can view all employee data" ON employee_master_data;
DROP POLICY IF EXISTS "Managers can manage employee data" ON employee_master_data;
DROP POLICY IF EXISTS "Managers can manage all absence requests" ON absence_request_v2;
DROP POLICY IF EXISTS "Managers can manage all contracts" ON contracts;
DROP POLICY IF EXISTS "Managers can view all quiz completions" ON car_quiz_completions;
DROP POLICY IF EXISTS "Managers can manage quiz completions" ON car_quiz_completions;
DROP POLICY IF EXISTS "Managers can view all quiz submissions" ON car_quiz_submissions;
DROP POLICY IF EXISTS "Managers can manage quiz submissions" ON car_quiz_submissions;
DROP POLICY IF EXISTS "Managers can manage attempts" ON code_of_conduct_attempts;
DROP POLICY IF EXISTS "Managers can manage completions" ON code_of_conduct_completions;
DROP POLICY IF EXISTS "Managers can view all consents" ON gdpr_consents;
DROP POLICY IF EXISTS "Managers can manage consents" ON gdpr_consents;
DROP POLICY IF EXISTS "Managers can view all requests" ON gdpr_data_requests;
DROP POLICY IF EXISTS "Managers can manage requests" ON gdpr_data_requests;
DROP POLICY IF EXISTS "Managers can manage all lateness records" ON lateness_record;
DROP POLICY IF EXISTS "Managers and rekruttering can view all career wishes" ON career_wishes;
DROP POLICY IF EXISTS "Managers and rekruttering can update career wishes" ON career_wishes;

-- employee_master_data: Owners see all, teamledere see their team
CREATE POLICY "Owners can view all employee data"
ON employee_master_data FOR SELECT
USING (is_owner(auth.uid()));

CREATE POLICY "Owners can manage all employee data"
ON employee_master_data FOR ALL
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

CREATE POLICY "Teamledere can view their team"
ON employee_master_data FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(id, auth.uid())
);

-- absence_request_v2: Owners manage all, teamledere manage their team
CREATE POLICY "Owners can manage all absence requests"
ON absence_request_v2 FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Teamledere can manage team absence requests"
ON absence_request_v2 FOR ALL
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- contracts: Owners manage all, teamledere manage their team
CREATE POLICY "Owners can manage all contracts"
ON contracts FOR ALL
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

CREATE POLICY "Teamledere can view team contracts"
ON contracts FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- car_quiz_completions: Team-restricted
CREATE POLICY "Owners can manage quiz completions"
ON car_quiz_completions FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Teamledere can view team quiz completions"
ON car_quiz_completions FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- car_quiz_submissions: Team-restricted
CREATE POLICY "Owners can manage quiz submissions"
ON car_quiz_submissions FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Teamledere can view team quiz submissions"
ON car_quiz_submissions FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- code_of_conduct_attempts: Team-restricted
CREATE POLICY "Owners can manage attempts"
ON code_of_conduct_attempts FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Teamledere can view team attempts"
ON code_of_conduct_attempts FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- code_of_conduct_completions: Team-restricted
CREATE POLICY "Owners can manage completions"
ON code_of_conduct_completions FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Teamledere can view team completions"
ON code_of_conduct_completions FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- gdpr_consents: Team-restricted
CREATE POLICY "Owners can manage all consents"
ON gdpr_consents FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Teamledere can view team consents"
ON gdpr_consents FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- gdpr_data_requests: Team-restricted
CREATE POLICY "Owners can manage all requests"
ON gdpr_data_requests FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Teamledere can view team requests"
ON gdpr_data_requests FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- lateness_record: Team-restricted
CREATE POLICY "Owners can manage all lateness records"
ON lateness_record FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Teamledere can manage team lateness records"
ON lateness_record FOR ALL
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);

-- career_wishes: Team-restricted for teamledere, rekruttering sees all
CREATE POLICY "Owners and rekruttering can view all career wishes"
ON career_wishes FOR SELECT
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Owners and rekruttering can update all career wishes"
ON career_wishes FOR UPDATE
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()))
WITH CHECK (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view team career wishes"
ON career_wishes FOR SELECT
USING (
  is_teamleder_or_above(auth.uid()) 
  AND can_view_employee(employee_id, auth.uid())
);
