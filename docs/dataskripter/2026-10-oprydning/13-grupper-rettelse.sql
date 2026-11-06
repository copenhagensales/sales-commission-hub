-- Udsendelser: rettelse af gruppe/til_medarbejdere efter Codex' modtageropgørelse (codex-modtagere.md, 26/10):
-- send-udsendelser sender fra core_compliance.udsendelse (intern kø, ikke kandidater); send-tryg-cancellation går til to faste interne adresser
-- (ikke Tryg); customer-inquiry-webhook går til tre faste adresser; unsubscribe-candidate går til en konfigureret modtagerliste.
-- Faste adresser/konfigurerede lister er ikke et personligt valg → vises ikke på Min profil (til_medarbejdere = false).
-- Kørsel som registreret skript: 'SHA' = filens sha256. Kun data. Tilbagerulning: 13-grupper-rettelse-tilbagerulning.sql.
begin;
select core_compliance.stork_script_start('13-grupper-rettelse.sql', 'SHA',
  'Udsendelser: gruppe/til_medarbejdere rettet for 4 typer efter modtageropgørelse (send-udsendelser → System, send-tryg-cancellation → Ledelse; faste adresser/lister skjules på Min profil)',
  'Mathias (26/10: »koge det ned, så det hele står i overskrifter«)');
update public.udsendelsestyper set gruppe = 'System', navn = 'Udsendelseskø (core_compliance)', til_medarbejdere = false,
  beskrivelse = 'Sender mails fra den interne kø core_compliance.udsendelse (fase 0-rapporter og -advarsler).', opdateret = now()
  where noegle = 'send-udsendelser';
update public.udsendelsestyper set gruppe = 'Ledelse', til_medarbejdere = false,
  beskrivelse = 'Går til to faste interne adresser (ikke til Tryg). Ændres i koden, ikke pr. bruger.', opdateret = now()
  where noegle = 'send-tryg-cancellation';
update public.udsendelsestyper set til_medarbejdere = false,
  beskrivelse = 'Går til tre faste interne adresser. Ændres i koden, ikke pr. bruger.', opdateret = now()
  where noegle = 'customer-inquiry-webhook';
update public.udsendelsestyper set til_medarbejdere = false,
  beskrivelse = 'Går til den konfigurerede liste booking_notification_recipients (notify_on_cancel). Ændres dér, ikke pr. bruger.', opdateret = now()
  where noegle = 'unsubscribe-candidate';
select core_compliance.stork_script_slut();
commit;
select noegle, gruppe, til_medarbejdere from public.udsendelsestyper where noegle in ('send-udsendelser','send-tryg-cancellation','customer-inquiry-webhook','unsubscribe-candidate') order by 1;
