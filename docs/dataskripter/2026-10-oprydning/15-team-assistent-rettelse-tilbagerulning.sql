-- Tilbagerulning: den gamle assistent sættes tilbage på teamet.
begin;
select core_compliance.stork_script_start('15-team-assistent-rettelse-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: assistant_team_leader_id på team Fieldmarketing', 'Mathias');
update public.teams t set assistant_team_leader_id = a.gammel_assistent, updated_at = now()
  from arkiv_2026_10.teams_assistent_rettelse a where a.team_id = t.id and t.assistant_team_leader_id is null;
drop table if exists arkiv_2026_10.teams_assistent_rettelse;
select core_compliance.stork_script_slut();
commit;
