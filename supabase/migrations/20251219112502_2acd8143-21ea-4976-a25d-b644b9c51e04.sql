-- Fjern usikre kontrakt-politikker
-- 1. "Anyone can view contracts with pending signatures" - giver uautoriserede adgang
-- 2. "Team members can view team contracts" - teammedlemmer bør ikke se hinandens kontrakter

DROP POLICY IF EXISTS "Anyone can view contracts with pending signatures" ON public.contracts;
DROP POLICY IF EXISTS "Team members can view team contracts" ON public.contracts;