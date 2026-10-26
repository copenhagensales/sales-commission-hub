-- Tilbagerulning: de 9 køskabelon-typer fjernes (kun hvis ingen log-/præferencerækker peger på dem), og de 3 funktionsnavne-typer genskabes.
begin;
select core_compliance.stork_script_start('8-planlagte-typer-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: typer for planlagte mails', 'Mathias');
delete from public.udsendelsestyper t
where t.noegle in ('ramp_session_feedback', 'ramp_risk_flag', 'ramp_weekly_program', 'afslag', 'quality_management_summary', 'quality_team_summary', 'quality_feedback', 'quality_rejected', 'weekly_lead_closure_report')
  and not exists (select 1 from public.udsendelser u where u.type_noegle = t.noegle)
  and not exists (select 1 from public.udsendelsespraeferencer p where p.type_noegle = t.noegle);
insert into public.udsendelsestyper (noegle, navn, kanal, udloeser, afsenderfunktion) values
  ('quality-mails', 'Kvalitet: team- og ledelsesopsummering', 'mail', 'tidsplan', 'quality-mails'),
  ('send-ramp-session-feedback', 'Ramp: feedback fra ugens forløb', 'mail', 'tidsplan', 'send-ramp-session-feedback'),
  ('weekly-lead-closure-report', 'Tryg: ugentlig lead-rapport', 'mail', 'tidsplan', 'weekly-lead-closure-report')
on conflict (noegle) do nothing;
select core_compliance.stork_script_slut();
commit;
