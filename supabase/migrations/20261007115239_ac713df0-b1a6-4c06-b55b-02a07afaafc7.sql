CREATE OR REPLACE FUNCTION public.gdpr_unmapped_sales_retention()
RETURNS TABLE(sale_id uuid, client_id uuid, retention_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH client_min AS (
    SELECT cc.client_id, min(p.retention_days) d
    FROM campaign_retention_policies p JOIN client_campaigns cc ON cc.id = p.client_campaign_id
    WHERE p.is_active AND p.cleanup_mode = 'anonymize_customer' AND p.retention_days > 0
    GROUP BY 1
  ), source_client AS (
    SELECT DISTINCT ON (s.source) s.source, cc.client_id
    FROM sales s JOIN client_campaigns cc ON cc.id = s.client_campaign_id
    WHERE s.source IS NOT NULL
    GROUP BY s.source, cc.client_id
    ORDER BY s.source, count(*) DESC
  )
  SELECT s.id,
         coalesce(mc.client_id, sc.client_id),
         coalesce(cm.d, 90)
  FROM sales s
  LEFT JOIN LATERAL (
    SELECT cc.client_id FROM adversus_campaign_mappings m JOIN client_campaigns cc ON cc.id = m.client_campaign_id
    WHERE m.adversus_campaign_id = s.dialer_campaign_id LIMIT 1
  ) mc ON true
  LEFT JOIN source_client sc ON sc.source = s.source
  LEFT JOIN client_min cm ON cm.client_id = coalesce(mc.client_id, sc.client_id)
  WHERE s.client_campaign_id IS NULL
$$;

CREATE OR REPLACE FUNCTION public.gdpr_clean_unmapped_sales(p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_identity_keys text[] := ARRAY[
    'customer_name','customer_email','customer_zip','customer_address','customer_city',
    'phone_number','member_number','current_akasse',
    'opp_nr','opp_nr.','opp-nr','opp-nr.','opp nr','opp nr.','opp_number','opp',
    'legacy_opp_number','sales_id','sales id','salesid'
  ];
  v_per_client jsonb;
  v_total integer;
  v_skipped integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _gdpr_unmapped (sale_id uuid PRIMARY KEY, client_id uuid, d integer, eligible boolean) ON COMMIT DROP;
  TRUNCATE _gdpr_unmapped;
  INSERT INTO _gdpr_unmapped
  SELECT r.sale_id, r.client_id, r.retention_days,
         EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)
         AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id
                         AND (si.needs_mapping IS TRUE OR si.mapped_commission IS NULL))
  FROM gdpr_unmapped_sales_retention() r
  JOIN sales s ON s.id = r.sale_id
  WHERE s.sale_datetime < now() - make_interval(days => r.retention_days)
    AND (s.customer_phone IS NOT NULL OR s.raw_payload IS NOT NULL
         OR s.external_reference_number IS NOT NULL OR s.external_sales_id IS NOT NULL);

  SELECT count(*) FILTER (WHERE eligible), count(*) FILTER (WHERE NOT eligible) INTO v_total, v_skipped FROM _gdpr_unmapped;
  SELECT coalesce(jsonb_agg(jsonb_build_object('client', coalesce(c.name, 'ukendt'), 'retention_days', x.d, 'anonymized', x.n, 'skipped_unmapped', x.k)), '[]'::jsonb)
    INTO v_per_client
  FROM (SELECT client_id, d, count(*) FILTER (WHERE eligible) n, count(*) FILTER (WHERE NOT eligible) k FROM _gdpr_unmapped GROUP BY 1,2) x
  LEFT JOIN clients c ON c.id = x.client_id;

  IF NOT p_dry_run THEN
    UPDATE sales s
    SET customer_phone = NULL,
        customer_company = 'Anonymiseret',
        raw_payload = NULL,
        external_reference_number = NULL,
        external_sales_id = NULL,
        normalized_data = CASE
          WHEN s.normalized_data IS NULL OR jsonb_typeof(s.normalized_data) <> 'object' THEN s.normalized_data
          ELSE COALESCE((SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(s.normalized_data) e
                         WHERE lower(btrim(e.key)) <> ALL (v_identity_keys)), '{}'::jsonb)
        END
    FROM _gdpr_unmapped u
    WHERE u.sale_id = s.id AND u.eligible;
  END IF;

  RETURN jsonb_build_object('dry_run', p_dry_run, 'anonymized', v_total, 'skipped_unmapped', v_skipped, 'clients', v_per_client);
END;
$$;

CREATE OR REPLACE FUNCTION public.gdpr_run_campaign_sales_cleanup()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_unmapped jsonb;
BEGIN
  v_result := public.gdpr_clean_campaign_sales();

  INSERT INTO public.gdpr_cleanup_log (action, records_affected, details, triggered_by)
  VALUES (
    'campaign_sales_anonymized',
    COALESCE((v_result->>'anonymized')::int, 0),
    v_result,
    'pg_cron:gdpr-campaign-sales-cleanup'
  );

  -- Sales without campaign: retention from the client's shortest policy, else 90 days.
  v_unmapped := public.gdpr_clean_unmapped_sales(false);
  INSERT INTO public.gdpr_cleanup_log (action, records_affected, details, triggered_by)
  VALUES ('unmapped_sales_retention_backfill', COALESCE((v_unmapped->>'anonymized')::int, 0),
          v_unmapped, 'pg_cron:gdpr-campaign-sales-cleanup');

  RETURN v_result || jsonb_build_object('unmapped_sales', v_unmapped);
END;
$function$;

REVOKE ALL ON FUNCTION public.gdpr_unmapped_sales_retention() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gdpr_clean_unmapped_sales(boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compliance_check_unmapped_sales()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_since timestamptz; v numeric; d jsonb;
BEGIN
  v_since := compliance_since('nye_salg_uden_kampagne');
  SELECT count(*), coalesce(jsonb_agg(DISTINCT jsonb_build_object('kilde', source, 'dialer_kampagne', dialer_campaign_id)), '[]'::jsonb)
    INTO v, d
  FROM sales WHERE client_campaign_id IS NULL AND created_at > v_since;
  PERFORM compliance_raise('nye_salg_uden_kampagne', 'HOEJ', 'Nye salg er kommet ind uden kampagne',
    v, 0, jsonb_build_object('taelles_fra', v_since, 'kilder', d));
END;
$$;
REVOKE ALL ON FUNCTION public.compliance_check_unmapped_sales() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compliance_run_checks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v numeric; d jsonb; v_open integer; v_since timestamptz;
begin
  select extract(epoch from (now() - max(run_at)))/3600 into v from gdpr_cleanup_log;
  perform compliance_raise('cleanup_heartbeat','KRITISK','GDPR-oprydningen er ikke koert',
    coalesce(v,999), 26, jsonb_build_object('timer_siden_sidste_koersel', round(coalesce(v,999),1)));

  select count(*) into v from cron.job_run_details r join cron.job j using (jobid)
   where j.jobname like 'gdpr%' and r.start_time > now() - interval '26 hours'
     and r.status is distinct from 'succeeded';
  select coalesce(jsonb_agg(jsonb_build_object('job', j.jobname, 'status', r.status, 'tid', r.start_time)), '[]'::jsonb)
    into d from cron.job_run_details r join cron.job j using (jobid)
   where j.jobname like 'gdpr%' and r.start_time > now() - interval '26 hours'
     and r.status is distinct from 'succeeded';
  perform compliance_raise('cron_fejl','KRITISK','GDPR-job fejlede', v, 0, jsonb_build_object('koersler', d));

  with o as (
    select s.id, cc.name as kampagne from sales s
    join campaign_retention_policies p on p.client_campaign_id=s.client_campaign_id
     and p.is_active and p.cleanup_mode='anonymize_customer' and p.retention_days>0
    left join client_campaigns cc on cc.id=s.client_campaign_id
    where s.sale_datetime < now() - make_interval(days => p.retention_days)
      and coalesce(s.customer_company,'') <> 'Anonymiseret'
      and (s.customer_phone is not null or s.raw_payload is not null
           or s.external_reference_number is not null or s.external_sales_id is not null))
  select count(*), coalesce(jsonb_agg(distinct kampagne),'[]'::jsonb) into v, d from o;
  perform compliance_raise('over_frist_med_pii','HOEJ','Salg over slettefristen har stadig persondata',
    v, 0, jsonb_build_object('kampagner', d));

  with b as (
    select cc.name as kampagne,
      extract(day from (now() - (s.sale_datetime + make_interval(days => p.retention_days)))) as dage
    from sales s
    join campaign_retention_policies p on p.client_campaign_id=s.client_campaign_id
     and p.is_active and p.cleanup_mode='anonymize_customer' and p.retention_days>0
    left join client_campaigns cc on cc.id=s.client_campaign_id
    where s.sale_datetime < now() - make_interval(days => p.retention_days)
      and coalesce(s.customer_company,'') <> 'Anonymiseret'
      and (s.customer_phone is not null or s.raw_payload is not null)
      and (not exists (select 1 from sale_items si where si.sale_id=s.id)
           or exists (select 1 from sale_items si where si.sale_id=s.id
                      and (si.needs_mapping is true or si.mapped_commission is null))))
  select count(*) filter (where dage>30), coalesce(jsonb_agg(distinct kampagne) filter (where dage>30),'[]'::jsonb)
    into v, d from b;
  perform compliance_raise('umappet_over_30_dage','HOEJ',
    'Salg blokeret af manglende mapping mere end 30 dage efter fristen', v, 0, jsonb_build_object('kampagner', d));

  v_since := compliance_since('indtag_identitet');
  select count(*) into v from sales where created_at > v_since
     and normalized_data ?| array['customer_name','customer_address','customer_zip','customer_city','customer_email'];
  perform compliance_raise('indtag_identitet','KRITISK','Nye salg indeholder kundenavn eller adresse',
    v, 0, jsonb_build_object('taelles_fra', v_since));

  v_since := compliance_since('indtag_fritekst');
  select count(*) into v from sales where created_at > v_since and raw_payload is not null
     and (raw_payload::text ilike '%"Notater"%' or raw_payload::text ilike '%ote til lead%'
       or raw_payload::text ilike '%astgjorte noter%'
       or coalesce(btrim(raw_payload->>'fm_comment'),'') <> '');
  perform compliance_raise('indtag_fritekst','KRITISK','Nye salg indeholder saelgernoter',
    v, 0, jsonb_build_object('taelles_fra', v_since));

  perform ingestion_scan_fields(1);

  -- Erstatter den gamle last_seen-baserede kontrol: maaler paa faktiske salg, ikke paa hvornaar
  -- et felt sidst blev registreret. Den gamle gav falsk roedt i et doegn efter hver rettelse.
  select count(*), coalesce(jsonb_agg(jsonb_build_object('beholder',beholder,'felt',felt,'salg',salg)),'[]'::jsonb)
    into v, d from ingestion_filter_audit(24) where dom like 'FEJL%';
  perform compliance_raise('blokeret_felt_slipper_igennem','KRITISK',
    'Felt der skulle vaere blokeret kommer stadig ind', v, 0, jsonb_build_object('felter', d));

  select count(*), coalesce(jsonb_agg(jsonb_build_object('beholder',beholder,'felt',felt,'salg',salg)),'[]'::jsonb)
    into v, d from ingestion_filter_audit(24) where dom like 'NYT%';
  perform compliance_raise('felt_ikke_registreret','HOEJ',
    'Felter kommer ind som ikke findes i feltregistret', v, 0, jsonb_build_object('felter', d));

  select count(*), coalesce(jsonb_agg(jsonb_build_object('beholder', container, 'felt', field_label)),'[]'::jsonb)
    into v, d from ingestion_known_fields
   where first_seen > now() - interval '26 hours' and decision='UAFKLARET';
  perform compliance_raise('nyt_ukendt_felt','HOEJ','Nyt felt er begyndt at komme ind i Stork',
    v, 0, jsonb_build_object('felter', d));

  select count(*) into v from campaign_retention_policies
   where (not is_active or retention_days is null or retention_days <= 0)
      or updated_at > now() - interval '26 hours';
  perform compliance_raise('politik_aendret','HOEJ','En retentionspolitik er slaaet fra eller aendret', v, 0, '{}'::jsonb);

  perform compliance_check_dialer_identity();
  perform compliance_check_unmapped_sales();

  -- filter_laekage er nu identisk med blokeret_felt_slipper_igennem: luk den gamle dublet
  update compliance_alerts set status='resolved', resolved_at=now()
   where check_key='filter_laekage' and status<>'resolved';

  select count(*) into v_open from compliance_alerts where status='open';
  return jsonb_build_object('koert', now(), 'aabne_alarmer', v_open);
end $function$;