CREATE TABLE IF NOT EXISTS public.pricing_backup_2026_04_28 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL CHECK (backup_type IN ('sale_item','pricing_rule','product','cancellation')),
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_backup_2026_04_28_type_entity
  ON public.pricing_backup_2026_04_28 (backup_type, entity_id);

ALTER TABLE public.pricing_backup_2026_04_28 ENABLE ROW LEVEL SECURITY;

-- Ingen policies = ingen adgang for almindelige brugere; kun service_role bypass'er RLS.
COMMENT ON TABLE public.pricing_backup_2026_04_28 IS
  'Rollback-snapshot for 2026-prisstrukturopdatering (Eesy TM, 9 produkter, sale_datetime >= 2026-03-15). Bevares mindst 90 dage.';