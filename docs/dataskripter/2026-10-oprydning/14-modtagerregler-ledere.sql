-- Udsendelser, del 7 (Mathias 26/10: »man skal bare kunne slå notifikationer til, og derefter er det styret via rettigheder, hvad der sendes ud«):
-- 1) ny regeldimension regel_ledere: »teamledere og assistenter« (teams.team_leader_id, teams.assistant_team_leader_id, team_assistant_leaders)
--    – nødvendig, fordi flere ledere i prod har stillingsrollen medarbejder (rolle alene ville blokere dem); udsendelse_tilladt udvides:
--    rolle_ok = (ingen rolle- og lederkrav) eller rolle ∈ regel_roller eller (regel_ledere og er leder); team_ok og noegle_ok som før; ejere altid inden for.
-- 2) reglerne lægges på de typer, hvor koden allerede kun sender til ledere/rekruttering/ejere (codex-modtagere.md), så ingen reel modtager mistes:
--    kvalitet (team/feedback/afvist) → ledere; ledelsesopsummering → ejer; deaktiveringer → ledere + rekruttering; ny anbefaling → rekruttering;
--    ramp-lederadviseringer (risikoflag, ugeprogram, mail + push) → ledere; firmabil afleveret (mail + SMS) → ledere. Feedback fra ugens forløb → alle (går også til sælgeren).
-- Kørsel som registreret skript: 'SHA' = filens sha256. Testet på testkopien først. Tilbagerulning: 14-modtagerregler-ledere-tilbagerulning.sql.
-- Regler (0.5): én eksisterende SECURITY DEFINER-funktion ændres (samme rettigheder, auto-registreres); kun data derudover.
begin;
select core_compliance.stork_script_start('14-modtagerregler-ledere.sql', 'SHA',
  'Udsendelser: regel_ledere (teamledere/assistenter) som regeldimension i udsendelse_tilladt; modtagerregler sat på 13 leder-/rekrutterings-/ejertyper (matcher koden)',
  'Mathias (26/10: »lad os få styr på al det … styret via rettigheder hvad der bliver sendt ud«)');

alter table public.udsendelsestyper add column regel_ledere boolean not null default false;
comment on column public.udsendelsestyper.regel_ledere is 'Sand = teamledere og assistenter (teams.team_leader_id/assistant_team_leader_id, team_assistant_leaders) er inden for reglen, uanset stillingsrolle. Kombineres med regel_roller som ELLER.';

create or replace function public.udsendelse_tilladt(p_user_id uuid, p_type text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  with t as (select regel_roller, regel_teams, regel_noegle, regel_ledere from public.udsendelsestyper where noegle = p_type),
  e as (
    select e.id employee_id, jp.system_role_key role_key
    from public.employee_master_data e
    left join public.job_positions jp on jp.id = e.position_id
    where e.auth_user_id = p_user_id
    limit 1
  ),
  leder as (
    select exists (
      select 1 from public.teams tm where tm.team_leader_id = (select employee_id from e) or tm.assistant_team_leader_id = (select employee_id from e)
      union all
      select 1 from public.team_assistant_leaders al where al.employee_id = (select employee_id from e)
    ) er_leder
  )
  select case
    when not exists (select 1 from t) then true
    when not exists (select 1 from t where coalesce(array_length(regel_roller, 1), 0) > 0 or coalesce(array_length(regel_teams, 1), 0) > 0 or regel_noegle is not null or regel_ledere) then true
    when public.is_owner(p_user_id) then true
    when not exists (select 1 from e) then false
    else
      exists (select 1 from t
              where (coalesce(array_length(t.regel_roller, 1), 0) = 0 and not t.regel_ledere)
                 or (select role_key from e) = any (t.regel_roller)
                 or (t.regel_ledere and (select er_leder from leder)))
      and exists (select 1 from t where coalesce(array_length(t.regel_teams, 1), 0) = 0
                  or exists (select 1 from public.team_members tm where tm.employee_id = (select employee_id from e) and tm.team_id = any (t.regel_teams)))
      and exists (select 1 from t where t.regel_noegle is null
                  or exists (select 1 from public.role_page_permissions r where r.role_key = (select role_key from e) and r.permission_key = t.regel_noegle and r.can_view))
  end;
$$;
comment on function public.udsendelse_tilladt(uuid, text) is 'Modtagerregel for udsendelser: (rolle ∈ regel_roller ELLER teamleder/assistent ved regel_ledere) OG team ∈ regel_teams OG can_view på regel_noegle. Tom regel = alle. Ejere altid inden for. Kaldes af _shared/udsend.ts og siden Udsendelser.';

update public.udsendelsestyper set regel_ledere = true, regel_roller = '{}'
  where noegle in ('quality_team_summary', 'quality_feedback', 'quality_rejected',
                   'ramp_risk_flag', 'ramp_weekly_program', 'send-ramp-risk-alerts', 'send-ramp-weekly-alerts',
                   'notify-vehicle-returned-mail', 'notify-vehicle-returned-sms');
update public.udsendelsestyper set regel_roller = '{ejer}' where noegle = 'quality_management_summary';
update public.udsendelsestyper set regel_ledere = true, regel_roller = '{rekruttering}'
  where noegle in ('send-deactivation-reminder', 'send-deactivation-followups');
update public.udsendelsestyper set regel_roller = '{rekruttering}' where noegle = 'notify-referral-received';
update public.udsendelsestyper set opdateret = now() where regel_ledere or coalesce(array_length(regel_roller, 1), 0) > 0;

select core_compliance.stork_script_slut();
commit;
select noegle, regel_roller, regel_ledere from public.udsendelsestyper where regel_ledere or coalesce(array_length(regel_roller, 1), 0) > 0 order by 1;
