-- Tilbagerulning af trin 3-dataskriptet (udsendelser): tabeller, visning, cron-job og menupunkt fjernes. Loggen går tabt (den er ny).
begin;
select core_compliance.stork_script_start('4-udsendelser-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning af trin 3 (udsendelser)', 'Mathias');
select cron.unschedule('udsendelser_oprydning') where exists (select 1 from cron.job where jobname = 'udsendelser_oprydning');
delete from public.sidebar_menu_config where item_key = 'side_udsendelser';
drop view if exists public.udsendelser_historik;
drop table if exists public.udsendelsespraeferencer;
drop table if exists public.udsendelser;
drop table if exists public.udsendelsestyper;
select core_compliance.stork_script_slut();
commit;
