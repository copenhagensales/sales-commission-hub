-- Trin 3 (Udsendelser), del 3: resten af forslaget »Notifikationer« (Mathias indsatte det 26/10): push-tekster som data (afløser
-- _shared/pushText.ts, når de er udfyldt), overblikstal til siden (tilmeldte pr. rolle og team, 7 dage pr. type, fejl, deaktiverede telefoner)
-- og logstatus dagsloft (Send-fanen: højst én manuel besked pr. medarbejder pr. dag).
-- Kørsel som registreret skript: 'SHA' = filens sha256. Testet på testkopien først (kæde 4 → 6 → 7 → 7r → 6r → 4r). Tilbagerulning: 7-push-tekster-overblik-tilbagerulning.sql.
-- Regler (0.5): ingen nye tabeller; udsendelser_overblik() er SECURITY DEFINER (aggregering, kun ejere, ingen persondata i svaret) og registreres automatisk som godkendt.
begin;
select core_compliance.stork_script_start('7-push-tekster-overblik.sql', 'SHA',
  'Udsendelser: push_titel/push_tekst/push_link på udsendelsestyper (tekster som data, seedet fra koden), funktionen udsendelser_overblik() (tal til siden, kun ejere), logstatus dagsloft',
  'Mathias (26/10: det oprindelige forslag »Notifikationer«: typer m. titel/tekst der kan rettes direkte, overblik, loft på én udsendelse pr. medarbejder pr. dag)');

-- 1. Push-tekster som data. Tom = koden bruges (fail-open). Seedet 1:1 fra _shared/pushText.ts.
alter table public.udsendelsestyper
  add column push_titel text,
  add column push_tekst text,
  add column push_link text;
comment on column public.udsendelsestyper.push_titel is 'Push: titel. Afløser teksten i koden (_shared/pushText.ts), når den er udfyldt. Må aldrig indeholde beløb, tal, navne eller kundedetaljer.';
comment on column public.udsendelsestyper.push_tekst is 'Push: brødtekst. Som push_titel.';
comment on column public.udsendelsestyper.push_link is 'Push: adresse i Stork, der åbnes ved tryk (fx /storkbook).';
update public.udsendelsestyper t set push_titel = v.titel, push_tekst = v.tekst, push_link = v.link
from (values
  ('pulsen-milestones',          'Ny Klub-milepæl', 'Du har nået et nyt Klub-niveau. Se det i Storkbook.',          '/storkbook'),
  ('send-ramp-risk-alerts',      'Opstart',         'En ny sælger på dit hold har brug for en hånd.',                '/onboarding-program?tab=opstartshold'),
  ('send-ramp-weekly-alerts',    '1-1 mangler',     'Der mangler ugens 1-1 for nye sælgere.',                        '/onboarding-program?tab=opstartshold'),
  ('send-compliance-alert-push', 'Compliance',      'Der er en kritisk compliance-alarm. Åbn Stork for detaljer.',   '/compliance'),
  ('send-push',                  'Stork',           'Testnotifikation – det virker.',                                '/')
) v(noegle, titel, tekst, link)
where t.noegle = v.noegle;

-- 2. Logstatus dagsloft (manuel besked sprunget over, fordi medarbejderen allerede har fået én i dag).
alter table public.udsendelser drop constraint udsendelser_status_check;
alter table public.udsendelser add constraint udsendelser_status_check
  check (status in ('sendt', 'fejl', 'ingen_tilmelding', 'fravalgt', 'slaaet_fra', 'stille_timer', 'planlagt', 'udenfor_regel', 'dagsloft'));

-- 3. Overblikstal til siden Udsendelser (kun ejere; kun tal, ingen persondata).
create function public.udsendelser_overblik()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select case when not public.is_owner(auth.uid()) then null::jsonb else jsonb_build_object(
    'brugere_med_login', (select count(*) from public.employee_master_data where is_active and auth_user_id is not null),
    'tilmeldte', (select count(distinct s.user_id) from public.push_subscriptions s
                  join public.employee_master_data e on e.auth_user_id = s.user_id and e.is_active
                  where s.is_active),
    'deaktiverede', (select count(*) from public.push_subscriptions where not is_active),
    'pr_rolle', (select coalesce(jsonb_agg(jsonb_build_object('rolle', r.rolle, 'tilmeldte', r.tilmeldte, 'i_alt', r.i_alt) order by r.rolle), '[]'::jsonb)
                 from (select coalesce(jp.system_role_key, '(uden stilling)') rolle,
                              count(*) filter (where exists (select 1 from public.push_subscriptions s where s.user_id = e.auth_user_id and s.is_active)) tilmeldte,
                              count(*) i_alt
                       from public.employee_master_data e
                       left join public.job_positions jp on jp.id = e.position_id
                       where e.is_active and e.auth_user_id is not null
                       group by 1) r),
    'pr_team', (select coalesce(jsonb_agg(jsonb_build_object('team', t.name, 'tilmeldte', x.tilmeldte, 'i_alt', x.i_alt) order by t.name), '[]'::jsonb)
                from (select tm.team_id,
                             count(distinct e.id) i_alt,
                             count(distinct e.id) filter (where exists (select 1 from public.push_subscriptions s where s.user_id = e.auth_user_id and s.is_active)) tilmeldte
                      from public.team_members tm
                      join public.employee_master_data e on e.id = tm.employee_id and e.is_active and e.auth_user_id is not null
                      group by tm.team_id) x
                join public.teams t on t.id = x.team_id),
    'syv_dage', (select coalesce(jsonb_agg(jsonb_build_object('kanal', u.kanal, 'type', u.type_noegle, 'sendt', u.sendt, 'fejl', u.fejl, 'sprunget', u.sprunget) order by u.kanal, u.type_noegle), '[]'::jsonb)
                 from (select kanal, type_noegle,
                              count(*) filter (where status = 'sendt') sendt,
                              count(*) filter (where status = 'fejl') fejl,
                              count(*) filter (where status not in ('sendt', 'fejl')) sprunget
                       from public.udsendelser
                       where tidspunkt >= now() - interval '7 days'
                       group by 1, 2) u),
    'fejl_7_dage', (select count(*) from public.udsendelser where status = 'fejl' and tidspunkt >= now() - interval '7 days')
  ) end;
$$;
comment on function public.udsendelser_overblik() is 'Tal til siden Udsendelser → Overblik (kun ejere): tilmeldte push pr. rolle/team, deaktiverede telefoner, udsendelser og fejl de sidste 7 dage pr. type. Ingen persondata.';
revoke all on function public.udsendelser_overblik() from public, anon;
grant execute on function public.udsendelser_overblik() to authenticated;

select core_compliance.stork_script_slut();
commit;
select (select count(*) from public.udsendelsestyper where push_titel is not null) typer_med_tekst,
       (select count(*) from pg_proc where proname = 'udsendelser_overblik') funktion;
