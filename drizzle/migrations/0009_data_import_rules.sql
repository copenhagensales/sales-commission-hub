CREATE TABLE public.data_import_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  retention_days integer CHECK (retention_days IS NULL OR retention_days > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.data_import_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  client_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.data_import_column_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.data_import_definitions(id) ON DELETE CASCADE,
  column_name text NOT NULL,
  category_id uuid REFERENCES public.data_import_categories(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, column_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_import_categories, public.data_import_definitions, public.data_import_column_rules TO authenticated;
GRANT ALL ON public.data_import_categories, public.data_import_definitions, public.data_import_column_rules TO service_role;
ALTER TABLE public.data_import_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_column_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read categories" ON public.data_import_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner write categories" ON public.data_import_categories FOR ALL TO authenticated USING (public.is_owner(auth.uid()) OR public.am_i_superadmin()) WITH CHECK (public.is_owner(auth.uid()) OR public.am_i_superadmin());
CREATE POLICY "read definitions" ON public.data_import_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner write definitions" ON public.data_import_definitions FOR ALL TO authenticated USING (public.is_owner(auth.uid()) OR public.am_i_superadmin()) WITH CHECK (public.is_owner(auth.uid()) OR public.am_i_superadmin());
CREATE POLICY "read column rules" ON public.data_import_column_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner write column rules" ON public.data_import_column_rules FOR ALL TO authenticated USING (public.is_owner(auth.uid()) OR public.am_i_superadmin()) WITH CHECK (public.is_owner(auth.uid()) OR public.am_i_superadmin());

ALTER TABLE public.cancellation_queue ADD COLUMN data_rule_applied_at timestamptz;
COMMENT ON COLUMN public.cancellation_queue.data_rule_applied_at IS 'Sat når uploaded_data er filtreret efter data_import_column_rules; kun disse rækker rammes af data_import_retention_run.';

INSERT INTO public.data_import_definitions (key, name, client_id)
VALUES ('eesy_tm_basket', 'Eesy TM kurvrettelser & salgsmatching', '81993a7b-ff24-46b8-8ffb-37a83138ddba');

CREATE OR REPLACE FUNCTION public.data_import_retention_run(_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rows integer := 0;
  _fields integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_owner(auth.uid()) OR public.am_i_superadmin()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  WITH expired AS (
    SELECT q.id, lower(btrim(e.key)) AS k, e.key AS raw_key
    FROM public.cancellation_queue q
    JOIN public.data_import_definitions d ON d.key = 'eesy_tm_basket' AND d.client_id = q.client_id
    CROSS JOIN LATERAL jsonb_each(q.uploaded_data) e
    JOIN public.data_import_column_rules r ON r.definition_id = d.id AND r.column_name = lower(btrim(e.key))
    JOIN public.data_import_categories c ON c.id = r.category_id
    WHERE q.data_rule_applied_at IS NOT NULL
      AND q.status <> 'pending'
      AND jsonb_typeof(q.uploaded_data) = 'object'
      AND c.retention_days IS NOT NULL
      AND q.created_at < now() - make_interval(days => c.retention_days)
  ), agg AS (
    SELECT id, array_agg(raw_key) AS keys FROM expired GROUP BY id
  ), upd AS (
    UPDATE public.cancellation_queue q SET uploaded_data = q.uploaded_data - agg.keys
    FROM agg WHERE q.id = agg.id AND NOT _dry_run
    RETURNING q.id
  )
  SELECT (SELECT count(*) FROM agg), (SELECT coalesce(sum(array_length(keys,1)),0) FROM agg)
  INTO _rows, _fields;

  IF NOT _dry_run THEN
    INSERT INTO public.gdpr_cleanup_log (action, records_affected, details, triggered_by)
    VALUES ('data_import_retention_eesy_tm_basket', _fields, jsonb_build_object('rows', _rows, 'fields', _fields), CASE WHEN auth.uid() IS NULL THEN 'cron' ELSE 'manual' END);
  END IF;

  RETURN jsonb_build_object('dry_run', _dry_run, 'rows', _rows, 'fields', _fields);
END;
$$;
REVOKE ALL ON FUNCTION public.data_import_retention_run(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.data_import_retention_run(boolean) TO authenticated, service_role;