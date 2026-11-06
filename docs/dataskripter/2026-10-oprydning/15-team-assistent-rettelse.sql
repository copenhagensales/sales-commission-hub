-- Datarettelse (Mathias 26/10: »thomas er sælger«): teams.assistant_team_leader_id på team Fieldmarketing peger på en sælger
-- (medlem af Stab og TDC Erhverv), som derfor får lederudsendelser (kvalitet, deaktivering, firmabil) og er inden for lederreglen.
-- Feltet nulstilles; den rigtige assistent sættes af Mathias under Medarbejdere › Teams, hvis der skal være en.
-- Kørsel som registreret skript: 'SHA' = filens sha256. Kun én kolonne på én række; gammel værdi gemmes i arkivet til tilbagerulning.
begin;
select core_compliance.stork_script_start('15-team-assistent-rettelse.sql', 'SHA',
  'teams: assistant_team_leader_id nulstilles på team Fieldmarketing (pegede på en sælger); gammel værdi i arkiv_2026_10.teams_assistent_rettelse',
  'Mathias (26/10: »thomas er sælger«)');
create table if not exists arkiv_2026_10.teams_assistent_rettelse (team_id uuid primary key, gammel_assistent uuid, rettet timestamptz not null default now());
insert into arkiv_2026_10.teams_assistent_rettelse (team_id, gammel_assistent)
  select id, assistant_team_leader_id from public.teams
  where id = '900fc72c-8710-4933-9fc5-de89a78b03bf' and assistant_team_leader_id = 'cb135e08-d329-4b64-9533-2bbfc3910515'
  on conflict (team_id) do nothing;
update public.teams set assistant_team_leader_id = null, updated_at = now()
  where id = '900fc72c-8710-4933-9fc5-de89a78b03bf' and assistant_team_leader_id = 'cb135e08-d329-4b64-9533-2bbfc3910515';
select core_compliance.stork_script_slut();
commit;
select name, assistant_team_leader_id from public.teams where id = '900fc72c-8710-4933-9fc5-de89a78b03bf';
