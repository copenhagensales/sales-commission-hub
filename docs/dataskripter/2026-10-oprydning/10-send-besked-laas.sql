-- Trin 3 (Udsendelser): LÅS af den manuelle Send-fane. Mathias 26/10 17:20: »vigtigt at vi ikke sender noget ud pt. ved en fejl«.
-- De tre typer, send-besked sender med (send-besked-mail/-sms/-push), sættes til aktiv = false, så modulet stopper enhver manuel
-- udsendelse (status slaaet_fra), også fra Lovables forhåndsvisning. Alle automatiske afsendere er urørte (de har egne typer).
-- Låses op igen på siden Udsendelser → Overblik (kontakten) eller med 10-send-besked-laas-tilbagerulning.sql.
-- Kørsel som registreret skript: 'SHA' = filens sha256. Testet på testkopien først. Regler (0.5): kun data.
begin;
select core_compliance.stork_script_start('10-send-besked-laas.sql', 'SHA',
  'Udsendelser: de tre send-besked-typer (mail/sms/push) sættes til aktiv = false, så den manuelle Send-fane ikke kan sende noget, før Mathias låser op',
  'Mathias (26/10 17:20: »vigtigt at vi ikke sender noget ud pt. ved en fejl«)');
insert into public.udsendelsestyper (noegle, navn, kanal, udloeser, afsenderfunktion, aktiv, beskrivelse) values
  ('send-besked-mail', 'Manuel besked (mail)', 'mail', 'handling', 'send-besked', false, 'Ejerens manuelle besked fra Udsendelser → Send. Låst 26/10 indtil ejeren slår den til.'),
  ('send-besked-sms',  'Manuel besked (SMS)',  'sms',  'handling', 'send-besked', false, 'Ejerens manuelle besked fra Udsendelser → Send. Låst 26/10 indtil ejeren slår den til.'),
  ('send-besked-push', 'Manuel besked (push)', 'push', 'handling', 'send-besked', false, 'Ejerens manuelle besked fra Udsendelser → Send. Låst 26/10 indtil ejeren slår den til.')
on conflict (noegle) do update set aktiv = false, navn = excluded.navn, beskrivelse = excluded.beskrivelse, opdateret = now();
select core_compliance.stork_script_slut();
commit;
select noegle, aktiv from public.udsendelsestyper where noegle like 'send-besked-%' order by 1;
