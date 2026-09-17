CREATE TABLE public.lederne_campaign_review (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adversus_campaign_id text NOT NULL UNIQUE,
  client_campaign_id uuid REFERENCES public.client_campaigns(id) ON DELETE SET NULL,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.lederne_campaign_review TO authenticated;
GRANT ALL ON public.lederne_campaign_review TO service_role;

ALTER TABLE public.lederne_campaign_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view lederne campaign review"
ON public.lederne_campaign_review FOR SELECT TO authenticated
USING (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE POLICY "Owners can insert lederne campaign review"
ON public.lederne_campaign_review FOR INSERT TO authenticated
WITH CHECK (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE POLICY "Owners can update lederne campaign review"
ON public.lederne_campaign_review FOR UPDATE TO authenticated
USING (public.effective_is_owner() OR public.effective_is_superadmin())
WITH CHECK (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE TRIGGER update_lederne_campaign_review_updated_at
BEFORE UPDATE ON public.lederne_campaign_review
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source-scoped retention: only Lederne sales (source = 'adversus_lederne') lose
-- their member number after 90 days. Retention for every other Tryg sale is
-- untouched and still governed by campaign_retention_policies.
CREATE OR REPLACE FUNCTION public.gdpr_clean_lederne_member_numbers(
  p_dry_run boolean DEFAULT false,
  p_retention_days integer DEFAULT 90,
  p_batch_size integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => GREATEST(p_retention_days, 1));
  v_ids uuid[];
  v_total integer := 0;
BEGIN
  LOOP
    SELECT array_agg(s.id) INTO v_ids
    FROM (
      SELECT s.id
      FROM public.sales s
      WHERE s.source = 'adversus_lederne'
        AND s.sale_datetime < v_cutoff
        AND s.raw_payload ? 'member_number'
      ORDER BY s.sale_datetime
      LIMIT p_batch_size
    ) s;

    IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
      EXIT;
    END IF;

    v_total := v_total + array_length(v_ids, 1);

    IF p_dry_run THEN
      EXIT;
    END IF;

    UPDATE public.sales s
    SET raw_payload = (s.raw_payload - 'member_number')
    WHERE s.id = ANY (v_ids);
  END LOOP;

  IF NOT p_dry_run AND v_total > 0 THEN
    INSERT INTO public.gdpr_cleanup_log (action, records_affected, details, triggered_by)
    VALUES (
      'anonymize_lederne_member_number',
      v_total,
      jsonb_build_object('retention_days', p_retention_days, 'cutoff', v_cutoff, 'source', 'adversus_lederne'),
      'gdpr_clean_lederne_member_numbers'
    );
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'retention_days', p_retention_days,
    'cutoff', v_cutoff,
    'anonymized', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_clean_lederne_member_numbers(boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gdpr_clean_lederne_member_numbers(boolean, integer, integer) TO service_role;