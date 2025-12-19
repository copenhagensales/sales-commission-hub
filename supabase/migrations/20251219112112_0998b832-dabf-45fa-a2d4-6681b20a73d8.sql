-- Fjern den usikre policy der giver team members fuld adgang til hinandens sensitive data
-- Teammedlemmer skal i stedet bruge get_team_employees_basic_info() funktionen
-- som kun returnerer ikke-følsomme felter (navn, email, telefon, job titel)
DROP POLICY IF EXISTS "Team members can view each other" ON public.employee_master_data;