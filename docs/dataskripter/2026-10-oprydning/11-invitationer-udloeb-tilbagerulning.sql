-- Tilbagerulning: de invitationer, skriptet satte til expired, sættes til pending igen (præcis de id'er, der blev gemt i arkivet).
begin;
select core_compliance.stork_script_start('11-invitationer-udloeb-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: gamle invitationer tilbage til pending', 'Mathias');
update public.employee_invitations i set status = 'pending'
  where i.status = 'expired' and i.id in (select id from arkiv_2026_10.employee_invitations_udloeb);
drop table if exists arkiv_2026_10.employee_invitations_udloeb;
select core_compliance.stork_script_slut();
commit;
