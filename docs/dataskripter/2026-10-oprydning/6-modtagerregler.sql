-- Trin 3, tillæg (Mathias 26/10): notifikationer skal følge rettigheder, og ejeren skal kunne styre, hvem der får hvilke udsendelser, ud fra roller og teams.
-- Hver udsendelsestype får en modtagerregel (roller, teams, rettighedsnøgle); én databasefunktion afgør, om en modtager er inden for reglen,
-- og bruges både af det fælles modul (_shared/udsend.ts, status 'udenfor_regel') og af siden Udsendelser (»hvem får denne«).
-- Kørsel som registreret script: 'SHA' = filens sha256. Testet på testkopien. Tilbagerulning: 6-modtagerregler-tilbagerulning.sql.
begin;
select core_compliance.stork_script_start('6-modtagerregler.sql', 'SHA',
  'Udsendelser: modtagerregel pr. type (regel_roller, regel_teams, regel_noegle) + funktionerne udsendelse_tilladt(user, type) og udsendelse_modtagere(type); ny logstatus udenfor_regel',
  'Mathias (26/10: »sikre at notifikationer fungerer sammen med rettigheder … styre hvem der skal have hvilke notifikationer ud fra roller og teams«)');

alter table public.udsendelsestyper
  add column regel_roller text[] not null default '{}',
  add column regel_teams uuid[] not null default '{}',
  add column regel_noegle text;
comment on column public.udsendelsestyper.regel_roller is 'Tom = alle. Ellers kun modtagere, hvis stilling har en af disse system_role_key.';
comment on column public.udsendelsestyper.regel_teams is 'Tom = alle. Ellers kun modtagere, der er medlem af et af disse teams.';
comment on column public.udsendelsestyper.regel_noegle is 'Null = ingen krav. Ellers kun modtagere, hvis rolle har can_view på denne rettighedsnøgle (fx menu_compliance_admin).';

alter table public.udsendelser drop constraint udsendelser_status_check;
alter table public.udsendelser add constraint udsendelser_status_check
  check (status in ('sendt', 'fejl', 'ingen_tilmelding', 'fravalgt', 'slaaet_fra', 'stille_timer', 'planlagt', 'udenfor_regel'));

-- Er brugeren inden for typens modtagerregel? Tom regel = ja. Ukendt type = ja (fail-open som modulet). Ejere er altid inden for.
create function public.udsendelse_tilladt(p_user_id uuid, p_type text)
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
comment on function public.udsendelse_tilladt(uuid, text) is 'Modtagerregel for udsendelser: roller, teams og rettighedsnøgle pr. type. Kaldes af _shared/udsend.ts (service role) og af siden Udsendelser.';
revoke all on function public.udsendelse_tilladt(uuid, text) from public, anon;
grant execute on function public.udsendelse_tilladt(uuid, text) to authenticated, service_role;

-- Hvem får denne type i dag? Kun ejere får svar (antal + navne-id'er), til »hvem får denne« på siden.
create function public.udsendelse_modtagere(p_type text)
returns table (employee_id uuid, auth_user_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select e.id, e.auth_user_id
  from public.employee_master_data e
  where public.is_owner(auth.uid())
    and e.is_active = true
    and e.auth_user_id is not null
    and public.udsendelse_tilladt(e.auth_user_id, p_type)
  order by e.id;
$$;
revoke all on function public.udsendelse_modtagere(text) from public, anon;
grant execute on function public.udsendelse_modtagere(text) to authenticated;

select core_compliance.stork_script_slut();
commit;
select funktion, status from core_compliance.secdef_register where funktion like '%udsendelse_%' order by 1;
