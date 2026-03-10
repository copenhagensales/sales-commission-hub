
-- Add is_confidential column to contract_templates
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN NOT NULL DEFAULT false;

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Authenticated users can view active templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Managers can manage contract templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Rekruttering can view contract templates" ON public.contract_templates;

-- Recreate policies with confidential filter
CREATE POLICY "Authenticated users can view active templates"
ON public.contract_templates FOR SELECT
USING (
  is_active = true
  AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
);

CREATE POLICY "Managers can manage contract templates"
ON public.contract_templates FOR ALL
USING (
  is_teamleder_or_above(auth.uid())
  AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
)
WITH CHECK (
  is_teamleder_or_above(auth.uid())
  AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
);

CREATE POLICY "Rekruttering can view contract templates"
ON public.contract_templates FOR SELECT
USING (
  is_rekruttering(auth.uid())
  AND (NOT is_confidential OR can_access_confidential_contract(auth.uid()))
);
