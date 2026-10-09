ALTER TABLE public.data_import_definitions ADD COLUMN description text, ADD COLUMN upload_linked boolean NOT NULL DEFAULT false;
UPDATE public.data_import_definitions SET upload_linked = true WHERE key = 'eesy_tm_basket';
ALTER TABLE public.data_import_categories ADD COLUMN definition_id uuid REFERENCES public.data_import_definitions(id) ON DELETE CASCADE;
UPDATE public.data_import_categories SET definition_id = (SELECT id FROM public.data_import_definitions WHERE key = 'eesy_tm_basket') WHERE definition_id IS NULL;
ALTER TABLE public.data_import_categories DROP CONSTRAINT IF EXISTS data_import_categories_name_key;
CREATE UNIQUE INDEX data_import_categories_def_name_key ON public.data_import_categories (definition_id, name);

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
    SELECT q.id, e.key AS raw_key
    FROM public.cancellation_queue q
    JOIN public.data_import_definitions d ON d.key = 'eesy_tm_basket' AND d.client_id = q.client_id
    CROSS JOIN LATERAL jsonb_each(q.uploaded_data) e
    JOIN public.data_import_column_rules r ON r.definition_id = d.id AND r.column_name = lower(regexp_replace(btrim(e.key), '\s+', ' ', 'g'))
    JOIN public.data_import_categories c ON c.id = r.category_id AND c.definition_id = d.id
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