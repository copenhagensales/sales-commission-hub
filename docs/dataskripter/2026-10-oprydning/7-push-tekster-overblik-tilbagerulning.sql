-- Tilbagerulning: push-tekster, overbliksfunktion og status dagsloft fjernes igen (koden bruger teksterne i _shared/pushText.ts, når kolonnerne mangler/er tomme).
begin;
select core_compliance.stork_script_start('7-push-tekster-overblik-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: push-tekster som data, udsendelser_overblik(), status dagsloft', 'Mathias');
drop function if exists public.udsendelser_overblik();
delete from core_compliance.secdef_register where funktion like '%udsendelser_overblik%';
update public.udsendelser set status = 'fravalgt' where status = 'dagsloft';
alter table public.udsendelser drop constraint udsendelser_status_check;
alter table public.udsendelser add constraint udsendelser_status_check
  check (status in ('sendt', 'fejl', 'ingen_tilmelding', 'fravalgt', 'slaaet_fra', 'stille_timer', 'planlagt', 'udenfor_regel'));
alter table public.udsendelsestyper drop column push_titel, drop column push_tekst, drop column push_link;
select core_compliance.stork_script_slut();
commit;
