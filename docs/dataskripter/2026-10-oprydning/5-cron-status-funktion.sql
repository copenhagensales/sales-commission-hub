-- Gennemgangens fund (26/10): Administration → Stabilitet kalder public.get_active_cron_jobs(), som aldrig har eksisteret (siden februar).
-- Funktionen oprettes som SECURITY DEFINER (cron.job kan kun læses af postgres), kun for ejere, fast search_path.
-- 0.5-reglen registrerer den automatisk i core_compliance.secdef_register, fordi den oprettes i et registreret script.
-- Kørsel som registreret script: 'SHA' = filens sha256. Godkendt: Mathias 26/10 (»kan du få en agent … til at løbe alle sider og faner igennem« → rettelse).
-- Tilbagerulning: 5-cron-status-funktion-tilbagerulning.sql.
begin;
select core_compliance.stork_script_start('5-cron-status-funktion.sql', 'SHA',
  'Opretter public.get_active_cron_jobs() (SECURITY DEFINER, kun ejere, læser cron.job) til siden Administration → Stabilitet, som har kaldt en ikke-eksisterende funktion siden februar',
  'Mathias (26/10, gennemgangens fund)');

create function public.get_active_cron_jobs()
returns table (jobid bigint, jobname text, schedule text, command text, active boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select j.jobid, j.jobname::text, j.schedule::text, j.command::text, j.active
  from cron.job j
  where public.is_owner(auth.uid())
  order by j.jobname;
$$;
comment on function public.get_active_cron_jobs() is 'Cron-status til Administration → Stabilitet. Kun ejere (is_owner) får rækker; andre får tom liste.';
revoke all on function public.get_active_cron_jobs() from public, anon;
grant execute on function public.get_active_cron_jobs() to authenticated;

select core_compliance.stork_script_slut();
commit;
select funktion, status from core_compliance.secdef_register where funktion like '%get_active_cron_jobs%';
