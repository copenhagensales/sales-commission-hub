-- Tilbagerulning af oprydning trin 1: alt i arkiv_2026_10 lægges tilbage i public, cron-jobs genoprettes, slettejobbet afmeldes.
-- Virker kun, så længe arkivet findes (før den automatiske sletning). Kørsel som registreret script.
begin;
select core_compliance.stork_script_start('1-arkiv-oprydning-tilbagerulning.sql', 'tilbagerulning',
  'Tilbagerulning af oprydning trin 1 (arkiv_2026_10 tilbage til public)', 'Mathias');

select cron.unschedule('arkiv_2026_10_slet') where exists (select 1 from cron.job where jobname = 'arkiv_2026_10_slet');

-- Tabeller og funktioner tilbage (generelt: alt, der blev flyttet, står i _indhold).
do $do$
declare r record;
begin
  for r in select navn from arkiv_2026_10._indhold where hvad = 'tabel' and raekker is not null loop
    execute format('alter table arkiv_2026_10.%I set schema public', r.navn);
  end loop;
  for r in
    select p.oid::regprocedure sig from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'arkiv_2026_10'
  loop
    execute format('alter function %s set schema public', r.sig);
  end loop;
  for r in select viewname from pg_views where schemaname = 'arkiv_2026_10' loop
    execute format('alter view arkiv_2026_10.%I set schema public', r.viewname);
  end loop;
end $do$;

-- Menupunkter og rettigheder tilbage.
insert into public.sidebar_menu_config select * from arkiv_2026_10.sidebar_menu_config on conflict do nothing;
insert into public.role_page_permissions select * from arkiv_2026_10.role_page_permissions on conflict do nothing;
do $do$
begin
  if to_regclass('arkiv_2026_10.user_page_permissions') is not null then
    execute 'insert into public.user_page_permissions select * from arkiv_2026_10.user_page_permissions on conflict do nothing';
  end if;
end $do$;

-- Cron-jobs for de fjernede funktioner tilbage (kun meningsfuldt, hvis funktionerne også er lagt tilbage i Lovable).
do $do$
declare r record;
begin
  for r in select jobname, schedule, command from arkiv_2026_10.cron_jobs loop
    perform cron.schedule(r.jobname, r.schedule, r.command);
  end loop;
end $do$;

drop schema arkiv_2026_10 cascade;

select core_compliance.stork_script_slut();
commit;

select count(*) filter (where relname like 'economic_%') economic_tilbage,
       count(*) filter (where relname = 'system_feedback') feedback_tilbage
from pg_stat_user_tables where schemaname = 'public';
