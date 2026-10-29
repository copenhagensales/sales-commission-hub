-- Oprydning trin 1 (bundt a): det, der fjernes, gemmes i 60 dage og slettes derefter automatisk.
-- Kørsel som registreret script: 'SHA' = filens sha256.
-- Godkendt: Mathias 26/10 (»det der står til sletning må du meget gerne gemme et sted i 60 dage hvorefter det
-- automatisk slettes« og »Perfekt. Jeg er klar«).
-- FORUDSÆTNING: Lovable-bundt (a) er publiceret (34 sider og 6 edge-funktioner er væk), ellers får de sider fejl.
-- Testet på testkopien først. Tilbagerulning: 1-arkiv-oprydning-tilbagerulning.sql (virker indtil den automatiske sletning).
begin;
select core_compliance.stork_script_start('1-arkiv-oprydning.sql', 'SHA',
  'Oprydning trin 1: 20 tabeller, menupunkter og rettighedsnøgler bag 34 fjernede sider flyttes til skemaet arkiv_2026_10 (uden API-adgang); cron-jobs for fjernede funktioner afmeldes; et engangsjob sletter arkivet 60 dage efter kørsel',
  'Mathias (26/10: »gemme et sted i 60 dage hvorefter det automatisk slettes«, »Perfekt. Jeg er klar«)');

create schema arkiv_2026_10;
revoke all on schema arkiv_2026_10 from public;
comment on schema arkiv_2026_10 is 'Arkiv fra oprydning trin 1 (26/10-2026). Slettes automatisk af cron-jobbet arkiv_2026_10_slet 60 dage efter kørsel.';

-- Indholdsfortegnelse: hvad der ligger i arkivet, så tilbagerulningen kan være generel.
create table arkiv_2026_10._indhold (hvad text not null, navn text not null, raekker bigint, note text, oprettet timestamptz not null default now());

-- 1) Tabeller, som kun de fjernede sider og funktioner bruger.
--    Tjekket 26/10 mod kode (sider, komponenter, hooks), edge-funktioner, views, funktioner og fremmednøgler.
--    Ikke med: vehicle (4 beholdte tabeller peger på den), time_entry og employee_time_clocks (beholdte hooks),
--    deactivation_reminder_config (bruges af send-deactivation-reminder, som bliver).
do $do$
declare
  tabeller text[] := array['closing_shifts','weekend_cleanup_config',
    'economic_baseline_exclusions','economic_budget_lines','economic_client_mapping','economic_fordelingsregler',
    'economic_imports','economic_kategorier','economic_konto_mapping','economic_kontoplan','economic_posteringer',
    'employee_dashboards','extra_work','forecast_settings','sales_validation_uploads',
    'system_feedback','system_feedback_comments','system_feedback_access','system_feedback_recipients','vehicle_mileage'];
  t text; n bigint; r record;
begin
  -- Værn: ingen fremmednøgle fra en tabel, der bliver, må pege på en tabel, der arkiveres.
  for r in
    select rc.relname fra, fc.relname til
    from pg_constraint c
    join pg_class rc on rc.oid = c.conrelid
    join pg_class fc on fc.oid = c.confrelid
    join pg_namespace n on n.oid = fc.relnamespace
    where c.contype = 'f' and n.nspname = 'public'
      and fc.relname = any(tabeller) and not (rc.relname = any(tabeller))
  loop
    raise exception 'Stop: %.% peger på %, som skulle arkiveres', 'public', r.fra, r.til;
  end loop;

  -- Funktioner og views i public, der nævner tabellerne: kun til orientering (de flyttes ikke automatisk).
  for r in
    select p.oid::regprocedure::text sig
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and exists (select 1 from unnest(tabeller) x where p.prosrc ~* ('\m' || x || '\M'))
  loop
    raise notice 'Funktion i public nævner en arkiv-tabel: %', r.sig;
  end loop;
  for r in
    select v.viewname from pg_views v
    where v.schemaname = 'public'
      and exists (select 1 from unnest(tabeller) x where v.definition ~* ('\m' || x || '\M'))
  loop
    raise notice 'View i public bruger en arkiv-tabel (virker fortsat, OID-bundet): %', r.viewname;
  end loop;

  foreach t in array tabeller loop
    if to_regclass('public.' || t) is null then
      insert into arkiv_2026_10._indhold (hvad, navn, note) values ('tabel', t, 'FANDTES IKKE i public');
      continue;
    end if;
    execute format('select count(*) from public.%I', t) into n;
    execute format('alter table public.%I set schema arkiv_2026_10', t);
    insert into arkiv_2026_10._indhold (hvad, navn, raekker, note)
      values ('tabel', t, n, 'flyttet fra public; RLS, rettigheder, indeks og sekvenser følger med');
  end loop;
end $do$;

-- Den ene funktion, kun økonomimodulet bruger (kaldt fra /economic-siderne), og det ene view (posteringer_enriched,
-- kun brugt af /economic/posteringer) følger med, så arkiverede tal ikke kan læses gennem API'et via public.
-- update_fordelingsregel_counts() er en trigger-funktion på de flyttede tabeller og bliver i public (kaldes kun af triggeren).
do $do$
declare r record;
begin
  for r in
    select p.oid::regprocedure sig
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'auto_suggest_konto_mapping'
  loop
    execute format('alter function %s set schema arkiv_2026_10', r.sig);
    insert into arkiv_2026_10._indhold (hvad, navn, note) values ('funktion', r.sig::text, 'flyttet fra public');
  end loop;
  if to_regclass('public.posteringer_enriched') is not null then
    alter view public.posteringer_enriched set schema arkiv_2026_10;
    insert into arkiv_2026_10._indhold (hvad, navn, note) values ('view', 'posteringer_enriched', 'flyttet fra public');
  end if;
end $do$;

-- 2) Menupunkter (sidebar_menu_config) for de 34 fjernede adresser.
create table arkiv_2026_10.sidebar_menu_config as
  select * from public.sidebar_menu_config
  where href = any(array['/admin/economic-upload','/boards/sales','/client-forecast','/client-sales-overview','/closing-shifts',
    '/dashboard','/dashboards/design','/dashboards/relatel-products','/economic','/economic/budget','/economic/expenses',
    '/economic/mapping','/economic/posteringer','/economic/revenue-match','/economic/sales-validation','/excel-field-matcher',
    '/extra-work','/extra-work-admin','/mg/data-import','/my-time-clock','/onboarding-program/kursus','/pulsen/demo',
    '/reports/employee','/sales','/shift-planning/time-tracking','/storkbook/demo','/system-feedback','/tdc-salgsvaerktoej',
    '/vagt-flow/book-week','/vagt-flow/bookings','/vagt-flow/time-off','/vagt-flow/travel-expenses','/vagt-flow/vehicles']);
delete from public.sidebar_menu_config where id in (select id from arkiv_2026_10.sidebar_menu_config);
insert into arkiv_2026_10._indhold (hvad, navn, raekker, note)
  select 'menupunkter', 'sidebar_menu_config', count(*), 'kopieret og slettet fra public' from arkiv_2026_10.sidebar_menu_config;

-- 3) Rettighedsnøgler, som kun de fjernede sider bruger (19 nøgler + deres fane-børn).
--    menu_dashboard_admin, menu_pulsen og menu_tdc_opsummering deles med beholdte sider og røres ikke.
create table arkiv_2026_10.role_page_permissions as
  select * from public.role_page_permissions
  where permission_key = any(array['menu_client_forecast','menu_closing_shifts','menu_dashboard','menu_economic_budget',
      'menu_economic_dashboard','menu_economic_expenses','menu_economic_mapping','menu_economic_upload','menu_extra_work',
      'menu_extra_work_admin','menu_fm_book_week','menu_fm_bookings','menu_fm_time_off','menu_fm_travel_expenses',
      'menu_fm_vehicles','menu_mg_data_import','menu_reports_employee','menu_sales','menu_time_tracking',
      'tab_extra_work_history','tab_extra_work_my'])
     or parent_key = any(array['menu_client_forecast','menu_closing_shifts','menu_dashboard','menu_economic_budget',
      'menu_economic_dashboard','menu_economic_expenses','menu_economic_mapping','menu_economic_upload','menu_extra_work',
      'menu_extra_work_admin','menu_fm_book_week','menu_fm_bookings','menu_fm_time_off','menu_fm_travel_expenses',
      'menu_fm_vehicles','menu_mg_data_import','menu_reports_employee','menu_sales','menu_time_tracking']);
delete from public.role_page_permissions where id in (select id from arkiv_2026_10.role_page_permissions);
insert into arkiv_2026_10._indhold (hvad, navn, raekker, note)
  select 'rettigheder', 'role_page_permissions', count(*), 'kopieret og slettet fra public' from arkiv_2026_10.role_page_permissions;

do $do$
begin
  if to_regclass('public.user_page_permissions') is not null then
    execute $q$create table arkiv_2026_10.user_page_permissions as
      select * from public.user_page_permissions
      where permission_key in (select distinct permission_key from arkiv_2026_10.role_page_permissions)$q$;
    execute 'delete from public.user_page_permissions where id in (select id from arkiv_2026_10.user_page_permissions)';
    execute $q$insert into arkiv_2026_10._indhold (hvad, navn, raekker, note)
      select 'rettigheder', 'user_page_permissions', count(*), 'kopieret og slettet fra public' from arkiv_2026_10.user_page_permissions$q$;
  end if;
end $do$;

-- 4) Cron-jobs, der kalder de 6 fjernede edge-funktioner, gemmes og afmeldes.
create table arkiv_2026_10.cron_jobs as
  select jobid, jobname, schedule, command, active from cron.job
  where command ~* 'send-closing-reminder|send-weekend-cleanup|notify-system-feedback|notify-feedback-status-change|import-economic-zip|generate-dashboard-layout';
select cron.unschedule(jobid) from arkiv_2026_10.cron_jobs;
insert into arkiv_2026_10._indhold (hvad, navn, raekker, note)
  select 'cron', 'afmeldte jobs', count(*), string_agg(jobname, ', ') from arkiv_2026_10.cron_jobs;

-- 5) Engangsjob: sletter arkivet 60 dage efter kørsel (kl. 03 UTC = 04 dansk tid), registrerer sig i ændringsloggen og afmelder sig selv.
do $do$
declare d date := (now() + interval '60 days')::date;
begin
  perform cron.schedule('arkiv_2026_10_slet',
    format('0 3 %s %s *', extract(day from d)::int, extract(month from d)::int),
    $job$
      select core_compliance.stork_script_start('arkiv_2026_10_slet (cron)', 'cron',
        'Automatisk sletning af arkiv_2026_10, 60 dage efter oprydning trin 1',
        'Mathias 26/10: »gemme et sted i 60 dage hvorefter det automatisk slettes«');
      drop schema if exists arkiv_2026_10 cascade;
      select core_compliance.stork_script_slut();
      select cron.unschedule('arkiv_2026_10_slet');
    $job$);
  insert into arkiv_2026_10._indhold (hvad, navn, note) values ('cron', 'arkiv_2026_10_slet', 'sletter arkivet ' || d::text || ' kl. 03 UTC');
end $do$;

select core_compliance.stork_script_slut();
commit;

-- Kontrol (læses af den, der kører skriptet).
select hvad, navn, raekker, note from arkiv_2026_10._indhold order by hvad, navn;
select count(*) tabeller_i_arkiv from pg_tables where schemaname = 'arkiv_2026_10';
select jobname, schedule from cron.job where jobname = 'arkiv_2026_10_slet';
