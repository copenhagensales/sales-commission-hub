-- Tilbagerulning: reglerne nulstilles, regel_ledere fjernes, udsendelse_tilladt tilbage til udgaven fra skript 6.
begin;
select core_compliance.stork_script_start('14-modtagerregler-ledere-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: regel_ledere + modtagerregler på 13 typer', 'Mathias');
update public.udsendelsestyper set regel_roller = '{}', opdateret = now()
  where noegle in ('quality_team_summary', 'quality_feedback', 'quality_rejected', 'quality_management_summary',
                   'ramp_risk_flag', 'ramp_weekly_program', 'send-ramp-risk-alerts', 'send-ramp-weekly-alerts',
                   'notify-vehicle-returned-mail', 'notify-vehicle-returned-sms',
                   'send-deactivation-reminder', 'send-deactivation-followups', 'notify-referral-received');
create or replace function public.udsendelse_tilladt(p_user_id uuid, p_type text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  with t as (select regel_roller, regel_teams, regel_noegle from public.udsendelsestyper where noegle = p_type),
  e as (
    select e.id employee_id, jp.system_role_key role_key
    from public.employee_master_data e
    left join public.job_positions jp on jp.id = e.position_id
    where e.auth_user_id = p_user_id
    limit 1
  )
  select case
    when not exists (select 1 from t) then true
    when not exists (select 1 from t where coalesce(array_length(regel_roller, 1), 0) > 0 or coalesce(array_length(regel_teams, 1), 0) > 0 or regel_noegle is not null) then true
    when public.is_owner(p_user_id) then true
    when not exists (select 1 from e) then false
    else
      exists (select 1 from t where coalesce(array_length(t.regel_roller, 1), 0) = 0 or (select role_key from e) = any (t.regel_roller))
      and exists (select 1 from t where coalesce(array_length(t.regel_teams, 1), 0) = 0
                  or exists (select 1 from public.team_members tm where tm.employee_id = (select employee_id from e) and tm.team_id = any (t.regel_teams)))
      and exists (select 1 from t where t.regel_noegle is null
                  or exists (select 1 from public.role_page_permissions r where r.role_key = (select role_key from e) and r.permission_key = t.regel_noegle and r.can_view))
  end;
$$;
alter table public.udsendelsestyper drop column regel_ledere;
select core_compliance.stork_script_slut();
commit;
