
-- Update RLS policies to use team-based visibility via team_members table

-- 1. employee_master_data: Team members can view each other
CREATE POLICY "Team members can view each other"
ON public.employee_master_data
FOR SELECT
USING (is_in_my_teams(id));

-- 2. absence_request_v2: Team members can view team absence requests
CREATE POLICY "Team members can view team absence requests"
ON public.absence_request_v2
FOR SELECT
USING (is_in_my_teams(employee_id));

-- 3. career_wishes: Team members can view team career wishes
CREATE POLICY "Team members can view team career wishes"
ON public.career_wishes
FOR SELECT
USING (is_in_my_teams(employee_id));

-- 4. car_quiz_completions: Team members can view team completions
CREATE POLICY "Team members can view team quiz completions"
ON public.car_quiz_completions
FOR SELECT
USING (is_in_my_teams(employee_id));

-- 5. car_quiz_submissions: Team members can view team submissions
CREATE POLICY "Team members can view team quiz submissions"
ON public.car_quiz_submissions
FOR SELECT
USING (is_in_my_teams(employee_id));

-- 6. code_of_conduct_completions: Team members can view team completions
CREATE POLICY "Team members can view team coc completions"
ON public.code_of_conduct_completions
FOR SELECT
USING (is_in_my_teams(employee_id));

-- 7. code_of_conduct_attempts: Team members can view team attempts
CREATE POLICY "Team members can view team coc attempts"
ON public.code_of_conduct_attempts
FOR SELECT
USING (is_in_my_teams(employee_id));

-- 8. contracts: Team members can view team contracts
CREATE POLICY "Team members can view team contracts"
ON public.contracts
FOR SELECT
USING (is_in_my_teams(employee_id));
