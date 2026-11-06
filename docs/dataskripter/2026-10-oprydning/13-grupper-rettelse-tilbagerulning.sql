-- Tilbagerulning: de fire typer tilbage til værdierne fra skript 12.
begin;
select core_compliance.stork_script_start('13-grupper-rettelse-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: gruppe/til_medarbejdere for 4 typer', 'Mathias');
update public.udsendelsestyper set gruppe = 'Rekruttering (kandidater)', navn = 'Udsendelser (masse-mail)', til_medarbejdere = false, beskrivelse = '', opdateret = now() where noegle = 'send-udsendelser';
update public.udsendelsestyper set gruppe = 'Eksterne (leverandører, Tryg)', til_medarbejdere = false, beskrivelse = '', opdateret = now() where noegle = 'send-tryg-cancellation';
update public.udsendelsestyper set til_medarbejdere = true, beskrivelse = '', opdateret = now() where noegle = 'customer-inquiry-webhook';
update public.udsendelsestyper set til_medarbejdere = true, beskrivelse = '', opdateret = now() where noegle = 'unsubscribe-candidate';
select core_compliance.stork_script_slut();
commit;
