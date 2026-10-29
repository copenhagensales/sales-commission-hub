-- Trin 3 (Udsendelser), del 4: typer for de planlagte mails. Tre afsendere (quality-mails, send-ramp-session-feedback, weekly-lead-closure-report)
-- sender ikke selv, men lægger mails i køen scheduled_emails (template_key), som process-scheduled-emails sender og logger. Funktionen bruger
-- template_key som type, når den findes i udsendelsestyper – så med disse rækker kan hver køskabelon slås fra og ses i overblikket hver for sig.
-- De tre ubrugte funktionsnavne-typer fjernes (kun hvis ingen log- eller præferencerækker peger på dem).
-- Kørsel som registreret skript: 'SHA' = filens sha256. Testet på testkopien først. Tilbagerulning: 8-planlagte-typer-tilbagerulning.sql.
-- Regler (0.5): kun data i en eksisterende tabel; ingen funktioner, ingen rettigheder.
begin;
select core_compliance.stork_script_start('8-planlagte-typer.sql', 'SHA',
  'Udsendelser: 9 typer for køskabelonerne i scheduled_emails (ramp, kvalitet, afslag, Tryg-ugerapport), så de kan slås fra hver for sig; 3 ubrugte funktionsnavne-typer fjernes',
  'Mathias (26/10: det oprindelige forslag »Notifikationer«: én række pr. beskedtype med tænd/sluk)');

delete from public.udsendelsestyper t
where t.noegle in ('quality-mails', 'send-ramp-session-feedback', 'weekly-lead-closure-report')
  and not exists (select 1 from public.udsendelser u where u.type_noegle = t.noegle)
  and not exists (select 1 from public.udsendelsespraeferencer p where p.type_noegle = t.noegle);

insert into public.udsendelsestyper (noegle, navn, kanal, udloeser, afsenderfunktion, skabelon_noegle, beskrivelse) values
  ('ramp_session_feedback',      'Ramp: feedback fra ugens forløb',   'mail', 'tidsplan', 'process-scheduled-emails', 'ramp_session_feedback',      'Lægges i køen af send-ramp-session-feedback; sendes af process-scheduled-emails.'),
  ('ramp_risk_flag',             'Ramp: risikoflag (mail)',           'mail', 'tidsplan', 'process-scheduled-emails', 'ramp_risk_flag',             'Lægges i køen af send-ramp-risk-alerts; sendes af process-scheduled-emails.'),
  ('ramp_weekly_program',        'Ramp: ugeprogram (mail)',           'mail', 'tidsplan', 'process-scheduled-emails', 'ramp_weekly_program',        'Lægges i køen af send-ramp-weekly-alerts; sendes af process-scheduled-emails.'),
  ('afslag',                     'Rekruttering: afslag',              'mail', 'handling', 'process-scheduled-emails', 'afslag',                     'Lægges i køen fra rekrutteringsflowet; sendes af process-scheduled-emails.'),
  ('quality_management_summary', 'Kvalitet: ledelsesopsummering',     'mail', 'tidsplan', 'process-scheduled-emails', 'quality_management_summary', 'Lægges i køen af quality-mails; sendes af process-scheduled-emails.'),
  ('quality_team_summary',       'Kvalitet: teamopsummering',         'mail', 'tidsplan', 'process-scheduled-emails', 'quality_team_summary',       'Lægges i køen af quality-mails; sendes af process-scheduled-emails.'),
  ('quality_feedback',           'Kvalitet: feedback til sælger',     'mail', 'tidsplan', 'process-scheduled-emails', 'quality_feedback',           'Lægges i køen af quality-mails; sendes af process-scheduled-emails.'),
  ('quality_rejected',           'Kvalitet: afvist salg',             'mail', 'tidsplan', 'process-scheduled-emails', 'quality_rejected',           'Lægges i køen af quality-mails; sendes af process-scheduled-emails.'),
  ('weekly_lead_closure_report', 'Tryg: ugentlig lead-rapport',       'mail', 'tidsplan', 'process-scheduled-emails', 'weekly_lead_closure_report', 'Lægges i køen af weekly-lead-closure-report; sendes af process-scheduled-emails.')
on conflict (noegle) do nothing;

select core_compliance.stork_script_slut();
commit;
select count(*) typer, count(*) filter (where afsenderfunktion = 'process-scheduled-emails') planlagte from public.udsendelsestyper;
