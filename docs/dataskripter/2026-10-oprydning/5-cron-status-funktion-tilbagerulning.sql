-- Tilbagerulning: fjerner public.get_active_cron_jobs() igen (siden Stabilitet viser så fejl som før).
begin;
select core_compliance.stork_script_start('5-cron-status-funktion-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: get_active_cron_jobs fjernes', 'Mathias');
drop function if exists public.get_active_cron_jobs();
delete from core_compliance.secdef_register where funktion like '%get_active_cron_jobs%';
select core_compliance.stork_script_slut();
commit;
