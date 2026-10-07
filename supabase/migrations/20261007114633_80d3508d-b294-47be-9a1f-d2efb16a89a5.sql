-- Retention per dialer campaign id: direct campaign policy, else shortest policy of the same client.
CREATE OR REPLACE FUNCTION public.gdpr_dialer_campaign_retention()
RETURNS TABLE(campaign_external_id text, retention_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH direct AS (
    SELECT m.adversus_campaign_id AS cid, min(p.retention_days) AS d
    FROM adversus_campaign_mappings m
    JOIN campaign_retention_policies p ON p.client_campaign_id = m.client_campaign_id
     AND p.is_active AND p.retention_days > 0
    GROUP BY 1
  ), client_min AS (
    SELECT cc.client_id, min(p.retention_days) AS d
    FROM campaign_retention_policies p
    JOIN client_campaigns cc ON cc.id = p.client_campaign_id
    WHERE p.is_active AND p.retention_days > 0
    GROUP BY 1
  ), via_client AS (
    SELECT m.adversus_campaign_id AS cid, min(cm.d) AS d
    FROM adversus_campaign_mappings m
    JOIN client_campaigns cc ON cc.id = m.client_campaign_id
    JOIN client_min cm ON cm.client_id = cc.client_id
    WHERE NOT EXISTS (SELECT 1 FROM direct x WHERE x.cid = m.adversus_campaign_id)
    GROUP BY 1
  )
  SELECT cid, d FROM direct
  UNION ALL
  SELECT cid, d FROM via_client
$$;

-- Shortest campaign retention seen per integration (fallback for unlinked rows).
CREATE OR REPLACE FUNCTION public.gdpr_dialer_integration_retention()
RETURNS TABLE(integration_id uuid, retention_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH pairs AS (
    SELECT DISTINCT c.integration_id, c.campaign_external_id FROM dialer_calls c WHERE c.integration_id IS NOT NULL
    UNION
    SELECT DISTINCT s.integration_id, s.campaign_external_id FROM dialer_sessions s
  )
  SELECT p.integration_id, min(r.retention_days)
  FROM pairs p
  JOIN public.gdpr_dialer_campaign_retention() r ON r.campaign_external_id = p.campaign_external_id
  GROUP BY 1
$$;

-- Daily cleanup of contact identifiers in dialer_calls, dialer_sessions and adversus_events.
-- Statistical fields (time, duration, status/result, agent, campaign) are never touched.
CREATE OR REPLACE FUNCTION public.gdpr_run_dialer_calls_cleanup(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_allowed constant text[] := array['disposition','hangupCause','callType','answerTime','direction','wrapUpDuration','dialingDuration','isSale','result','project','orgCode'];
  v_fallback constant integer := 90;
  v_batch_size constant integer := 20000;
  v_batch integer;
  v_calls integer := 0;
  v_sessions integer := 0;
  v_events integer := 0;
  v_result jsonb;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _gdpr_camp_ret (cid text PRIMARY KEY, d integer) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _gdpr_int_ret (iid uuid PRIMARY KEY, d integer) ON COMMIT DROP;
  TRUNCATE _gdpr_camp_ret; TRUNCATE _gdpr_int_ret;
  INSERT INTO _gdpr_camp_ret SELECT campaign_external_id, min(retention_days) FROM public.gdpr_dialer_campaign_retention() GROUP BY 1;
  INSERT INTO _gdpr_int_ret SELECT integration_id, retention_days FROM public.gdpr_dialer_integration_retention();

  IF p_dry_run THEN
    SELECT count(*) INTO v_calls
    FROM dialer_calls dc
    LEFT JOIN _gdpr_camp_ret cr ON cr.cid = dc.campaign_external_id
    LEFT JOIN _gdpr_int_ret ir ON ir.iid = dc.integration_id
    WHERE dc.start_time < now() - make_interval(days => coalesce(cr.d, ir.d, v_fallback))
      AND (dc.lead_external_id IS DISTINCT FROM dc.id::text OR dc.recording_url IS NOT NULL
           OR (jsonb_typeof(dc.metadata) = 'object' AND EXISTS (
                 SELECT 1 FROM jsonb_object_keys(dc.metadata) k WHERE NOT (k = ANY (v_allowed)))));

    SELECT count(*) INTO v_sessions
    FROM dialer_sessions ds
    LEFT JOIN _gdpr_camp_ret cr ON cr.cid = ds.campaign_external_id
    LEFT JOIN _gdpr_int_ret ir ON ir.iid = ds.integration_id
    WHERE ds.lead_external_id IS NOT NULL
      AND coalesce(ds.start_time, ds.created_at) < now() - make_interval(days => coalesce(cr.d, ir.d, v_fallback));

    SELECT count(*) INTO v_events
    FROM adversus_events e
    LEFT JOIN _gdpr_int_ret ir ON ir.iid::text = e.payload->>'dialer_id'
    WHERE (e.payload ? 'raw_body' OR e.payload ? 'headers')
      AND coalesce(e.received_at, e.created_at) < now() - make_interval(days => coalesce(ir.d, v_fallback));

    RETURN jsonb_build_object('dry_run', true, 'dialer_calls', v_calls, 'dialer_sessions', v_sessions, 'adversus_events', v_events);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM data_retention_policies WHERE data_type = 'dialer_calls' AND is_active) THEN
    RETURN jsonb_build_object('skipped', 'no active dialer_calls policy');
  END IF;

  LOOP
    WITH batch AS (
      SELECT dc.id FROM dialer_calls dc
      LEFT JOIN _gdpr_camp_ret cr ON cr.cid = dc.campaign_external_id
      LEFT JOIN _gdpr_int_ret ir ON ir.iid = dc.integration_id
      WHERE dc.start_time < now() - make_interval(days => coalesce(cr.d, ir.d, v_fallback))
        AND (dc.lead_external_id IS DISTINCT FROM dc.id::text OR dc.recording_url IS NOT NULL
             OR (jsonb_typeof(dc.metadata) = 'object' AND EXISTS (
                   SELECT 1 FROM jsonb_object_keys(dc.metadata) k WHERE NOT (k = ANY (v_allowed)))))
      LIMIT v_batch_size
    )
    UPDATE dialer_calls dc
    SET lead_external_id = dc.id::text,  -- column is NOT NULL; own id cannot be looked up in the dialer
        recording_url = NULL,
        metadata = CASE WHEN jsonb_typeof(dc.metadata) = 'object' THEN NULLIF((
            SELECT coalesce(jsonb_object_agg(k, dc.metadata -> k), '{}'::jsonb)
            FROM jsonb_object_keys(dc.metadata) k WHERE k = ANY (v_allowed)), '{}'::jsonb)
          ELSE dc.metadata END,
        updated_at = now()
    FROM batch b WHERE dc.id = b.id;
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_calls := v_calls + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  LOOP
    WITH batch AS (
      SELECT ds.id FROM dialer_sessions ds
      LEFT JOIN _gdpr_camp_ret cr ON cr.cid = ds.campaign_external_id
      LEFT JOIN _gdpr_int_ret ir ON ir.iid = ds.integration_id
      WHERE ds.lead_external_id IS NOT NULL
        AND coalesce(ds.start_time, ds.created_at) < now() - make_interval(days => coalesce(cr.d, ir.d, v_fallback))
      LIMIT v_batch_size
    )
    UPDATE dialer_sessions ds
    SET lead_external_id = NULL,
        -- Enreach uses the lead id as session key; replace it with a random value.
        external_id = CASE WHEN ds.source = 'enreach' THEN gen_random_uuid()::text ELSE ds.external_id END
    FROM batch b WHERE ds.id = b.id;
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_sessions := v_sessions + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  LOOP
    WITH batch AS (
      SELECT e.id FROM adversus_events e
      LEFT JOIN _gdpr_int_ret ir ON ir.iid::text = e.payload->>'dialer_id'
      WHERE (e.payload ? 'raw_body' OR e.payload ? 'headers')
        AND coalesce(e.received_at, e.created_at) < now() - make_interval(days => coalesce(ir.d, v_fallback))
      LIMIT v_batch_size
    )
    UPDATE adversus_events e
    SET payload = (e.payload - 'raw_body' - 'headers') || jsonb_build_object('anonymized', true)
    FROM batch b WHERE e.id = b.id;
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_events := v_events + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  v_result := jsonb_build_object('dry_run', false, 'dialer_calls', v_calls, 'dialer_sessions', v_sessions,
                                 'adversus_events', v_events, 'fallback_days', v_fallback);

  INSERT INTO gdpr_cleanup_log (action, records_affected, details, triggered_by) VALUES
    ('dialer_calls_anonymized', v_calls, v_result, 'pg_cron'),
    ('dialer_sessions_anonymized', v_sessions, v_result, 'pg_cron'),
    ('adversus_events_payload_cleared', v_events, v_result, 'pg_cron');

  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.gdpr_run_dialer_calls_cleanup();

REVOKE ALL ON FUNCTION public.gdpr_dialer_campaign_retention() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gdpr_dialer_integration_retention() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gdpr_run_dialer_calls_cleanup(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_run_dialer_calls_cleanup(boolean) TO service_role;

-- Compliance check (added, existing checks unchanged). One day grace for the 03:45 run.
CREATE OR REPLACE FUNCTION public.compliance_check_dialer_identity()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_calls integer; v_sess integer; v_ev integer;
BEGIN
  WITH cr AS (SELECT campaign_external_id cid, min(retention_days) d FROM gdpr_dialer_campaign_retention() GROUP BY 1),
       ir AS (SELECT integration_id iid, retention_days d FROM gdpr_dialer_integration_retention())
  SELECT
    (SELECT count(*) FROM dialer_calls dc LEFT JOIN cr ON cr.cid = dc.campaign_external_id LEFT JOIN ir ON ir.iid = dc.integration_id
      WHERE dc.start_time < now() - make_interval(days => coalesce(cr.d, ir.d, 90) + 1)
        AND (dc.lead_external_id IS DISTINCT FROM dc.id::text OR dc.recording_url IS NOT NULL)),
    (SELECT count(*) FROM dialer_sessions ds LEFT JOIN cr ON cr.cid = ds.campaign_external_id LEFT JOIN ir ON ir.iid = ds.integration_id
      WHERE ds.lead_external_id IS NOT NULL
        AND coalesce(ds.start_time, ds.created_at) < now() - make_interval(days => coalesce(cr.d, ir.d, 90) + 1)),
    (SELECT count(*) FROM adversus_events e LEFT JOIN ir ON ir.iid::text = e.payload->>'dialer_id'
      WHERE (e.payload ? 'raw_body' OR e.payload ? 'headers')
        AND coalesce(e.received_at, e.created_at) < now() - make_interval(days => coalesce(ir.d, 90) + 1))
  INTO v_calls, v_sess, v_ev;

  PERFORM compliance_raise('dialer_lead_id_over_frist', 'HOEJ',
    'Lead-id eller kontaktdata i opkald, sessioner eller raa haendelser er over slettefristen',
    v_calls + v_sess + v_ev, 0,
    jsonb_build_object('dialer_calls', v_calls, 'dialer_sessions', v_sess, 'adversus_events', v_ev));
END;
$$;
REVOKE ALL ON FUNCTION public.compliance_check_dialer_identity() FROM PUBLIC, anon, authenticated;

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

  -- filter_laekage er nu identisk med blokeret_felt_slipper_igennem: luk den gamle dublet
  update compliance_alerts set status='resolved', resolved_at=now()
   where check_key='filter_laekage' and status<>'resolved';

  select count(*) into v_open from compliance_alerts where status='open';
  return jsonb_build_object('koert', now(), 'aabne_alarmer', v_open);
end $function$;