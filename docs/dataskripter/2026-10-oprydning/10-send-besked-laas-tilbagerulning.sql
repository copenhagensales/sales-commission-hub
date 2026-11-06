-- Tilbagerulning (= lås op): de tre send-besked-typer sættes til aktiv = true igen. Kan også gøres med kontakten på siden Udsendelser → Overblik.
begin;
select core_compliance.stork_script_start('10-send-besked-laas-tilbagerulning.sql', 'tilbagerulning', 'Udsendelser: send-besked-typerne låses op (aktiv = true)', 'Mathias');
update public.udsendelsestyper set aktiv = true, opdateret = now() where noegle in ('send-besked-mail', 'send-besked-sms', 'send-besked-push');
select core_compliance.stork_script_slut();
commit;
