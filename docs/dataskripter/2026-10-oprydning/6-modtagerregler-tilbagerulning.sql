-- Tilbagerulning: modtagerregler fjernes igen (kolonner, funktioner, status).
begin;
select core_compliance.stork_script_start('6-modtagerregler-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: modtagerregler for udsendelser', 'Mathias');
drop function if exists public.udsendelse_modtagere(text);
drop function if exists public.udsendelse_tilladt(uuid, text);
delete from core_compliance.secdef_register where funktion like '%udsendelse_%';
update public.udsendelser set status = 'fravalgt' where status = 'udenfor_regel';
alter table public.udsendelser drop constraint udsendelser_status_check;
alter table public.udsendelser add constraint udsendelser_status_check
  check (status in ('sendt', 'fejl', 'ingen_tilmelding', 'fravalgt', 'slaaet_fra', 'stille_timer', 'planlagt'));
alter table public.udsendelsestyper drop column regel_roller, drop column regel_teams, drop column regel_noegle;
select core_compliance.stork_script_slut();
commit;
