-- Trin 3 (Udsendelser): udsendelsestyper (alt vi sender ud, med tænd/sluk), udsendelser (én fælles log), præferencer pr. bruger,
-- og en visning over de gamle logtabeller, så historikken kan ses samme sted. Kørsel som registreret script: 'SHA' = filens sha256.
-- Godkendt: Mathias 26/10 (»inkludér dit forslag i forhold til notifikationer, så vi får lavet en side med alt vi sender ud og kan føre log på det«,
-- »lad os bare komme i mål med det hele i dag«). Testet på testkopien først. Tilbagerulning: 4-udsendelser-tilbagerulning.sql.
-- Regler (0.5): RLS slås til; kun ejere kan læse (modtager er persondata); views i public er security_invoker; ingen SECURITY DEFINER.
-- Edge-funktioner skriver via service role (uden om RLS) gennem det delte modul _shared/udsend.ts (Lovable-bundt U1).
begin;
select core_compliance.stork_script_start('4-udsendelser.sql', 'SHA',
  'Trin 3: tabellerne udsendelsestyper (37 typer fra opgørelsen), udsendelser (fælles log), udsendelsespraeferencer; visning udsendelser_historik over 6 gamle logtabeller; menupunkt side_udsendelser',
  'Mathias (26/10: »lad os bare komme i mål med det hele i dag«)');

create table public.udsendelsestyper (
  noegle text primary key,
  navn text not null,
  kanal text not null check (kanal in ('mail', 'sms', 'push')),
  udloeser text not null check (udloeser in ('handling', 'tidsplan', 'webhook')),
  modtagerregel text not null default '',
  aktiv boolean not null default true,
  stille_fra time, stille_til time,
  skabelon_noegle text,
  afsenderfunktion text not null,
  beskrivelse text not null default '',
  oprettet timestamptz not null default now(),
  opdateret timestamptz not null default now()
);
comment on table public.udsendelsestyper is 'Alt, Stork sender ud (mail, SMS, push): én række pr. type med tænd/sluk, stille timer og modtagerregel. Vedligeholdes på siden Udsendelser (ejere).';
alter table public.udsendelsestyper enable row level security;
create policy udsendelsestyper_laes on public.udsendelsestyper for select to authenticated using (public.is_owner(auth.uid()));
create policy udsendelsestyper_ret on public.udsendelsestyper for update to authenticated using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));

create table public.udsendelser (
  id uuid primary key default gen_random_uuid(),
  tidspunkt timestamptz not null default now(),
  kanal text not null check (kanal in ('mail', 'sms', 'push')),
  type_noegle text not null references public.udsendelsestyper (noegle),
  modtager text not null,
  modtager_employee_id uuid,
  modtager_candidate_id uuid,
  modtager_user_id uuid,
  emne text,
  status text not null check (status in ('sendt', 'fejl', 'ingen_tilmelding', 'fravalgt', 'slaaet_fra', 'stille_timer', 'planlagt')),
  fejl text,
  reference text,
  afsenderfunktion text not null,
  metadata jsonb not null default '{}'::jsonb
);
comment on table public.udsendelser is 'Fælles log over alt, Stork sender ud. modtager (e-mail/telefon/bruger-id) er persondata: kun ejere læser; opbevaring 90 dage (slettes af cron-jobbet udsendelser_oprydning).';
create index udsendelser_tidspunkt_idx on public.udsendelser (tidspunkt desc);
create index udsendelser_type_idx on public.udsendelser (type_noegle, tidspunkt desc);
create index udsendelser_employee_idx on public.udsendelser (modtager_employee_id);
alter table public.udsendelser enable row level security;
create policy udsendelser_laes on public.udsendelser for select to authenticated using (public.is_owner(auth.uid()));

create table public.udsendelsespraeferencer (
  user_id uuid not null,
  type_noegle text not null references public.udsendelsestyper (noegle) on delete cascade,
  kanal text not null check (kanal in ('mail', 'sms', 'push')),
  aktiv boolean not null default true,
  opdateret timestamptz not null default now(),
  primary key (user_id, type_noegle, kanal)
);
comment on table public.udsendelsespraeferencer is 'Brugerens egne til-/fravalg pr. udsendelsestype og kanal (Min profil → Notifikationer). Mangler rækken, gælder typens standard.';
alter table public.udsendelsespraeferencer enable row level security;
create policy udsendelsespraeferencer_egen on public.udsendelsespraeferencer for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Historikken fra de seks gamle logtabeller i samme form (læses med brugerens rettigheder).
create view public.udsendelser_historik with (security_invoker = true) as
  select 'mail'::text kanal, coalesce(template_key, 'mail') type_noegle, created_at tidspunkt, recipient_email modtager, subject emne, status, error_message fejl, 'scheduled_emails'::text kilde from public.scheduled_emails
  union all
  select 'mail', 'send-recruitment-email', created_at, coalesce(candidate_id::text, ''), left(content, 80), status, null, 'messages' from public.messages where message_type = 'email'
  union all
  select 'sms', case when context_type = 'candidate' then 'send-recruitment-sms' else 'send-employee-sms' end, created_at, coalesce(phone_number, ''), left(content, 80), coalesce(delivery_status, outcome), delivery_error_message, 'communication_logs' from public.communication_logs where direction = 'outbound'
  union all
  select 'mail', 'quality-mails', created_at, recipient_email, subject, status, error_message, 'quality_mail_log' from public.quality_mail_log
  union all
  select 'mail', 'send-deactivation-reminder', created_at, coalesce(recipients::text, ''), subject, status, error_message, 'deactivation_reminders_sent' from public.deactivation_reminders_sent
  union all
  select 'push', 'push:' || push_type, created_at, user_id::text, null, status, error_text, 'push_log' from public.push_log;

-- Typerne fra opgørelsen (26/10): nøgle = edge-funktionens navn (+ kanal, når én funktion sender på to kanaler).
insert into public.udsendelsestyper (noegle, navn, kanal, udloeser, afsenderfunktion) values
  ('activate-employee-account', 'Velkomst: adgang til Stork', 'mail', 'handling', 'activate-employee-account'),
  ('check-compliance-reviews', 'Compliance: gennemgang forfalder', 'mail', 'tidsplan', 'check-compliance-reviews'),
  ('customer-inquiry-webhook', 'Ny kundehenvendelse (hjemmeside)', 'mail', 'webhook', 'customer-inquiry-webhook'),
  ('notify-referral-received', 'Ny anbefaling modtaget', 'mail', 'webhook', 'notify-referral-received'),
  ('notify-vehicle-returned-mail', 'Firmabil afleveret', 'mail', 'webhook', 'notify-vehicle-returned'),
  ('notify-vehicle-returned-sms', 'Firmabil afleveret', 'sms', 'webhook', 'notify-vehicle-returned'),
  ('process-scheduled-emails', 'Planlagte mails (afslag, svar, kø)', 'mail', 'tidsplan', 'process-scheduled-emails'),
  ('public-book-candidate', 'Samtale booket (kandidat)', 'mail', 'webhook', 'public-book-candidate'),
  ('pulsen-milestones', 'Storkbook: Klub-milepæl', 'push', 'tidsplan', 'pulsen-milestones'),
  ('quality-mails', 'Kvalitet: team- og ledelsesopsummering', 'mail', 'tidsplan', 'quality-mails'),
  ('send-ai-instruction-email', 'AI-instruktion (EU AI Act)', 'mail', 'handling', 'send-ai-instruction-email'),
  ('send-car-quiz-result', 'Bil-quiz: resultat', 'mail', 'handling', 'send-car-quiz-result'),
  ('send-checklist-daily-summary', 'FM-tjekliste: daglig opsummering', 'mail', 'tidsplan', 'send-checklist-daily-summary'),
  ('send-code-of-conduct-reminder', 'Kodeks: påmindelse', 'mail', 'tidsplan', 'send-code-of-conduct-reminder'),
  ('send-compliance-alert-mail', 'Compliance-advarsel', 'mail', 'handling', 'send-compliance-alert'),
  ('send-compliance-alert-push', 'Compliance-advarsel', 'push', 'handling', 'send-compliance-alert'),
  ('send-contract-compliance-digest', 'Kontrakter: compliance-opsummering', 'mail', 'tidsplan', 'send-contract-compliance-digest'),
  ('send-contract-email', 'Kontrakt til underskrift', 'mail', 'handling', 'send-contract-email'),
  ('send-contract-reminders', 'Kontrakt: påmindelse', 'mail', 'tidsplan', 'send-contract-reminders'),
  ('send-contract-signed-confirmation', 'Kontrakt underskrevet (bekræftelse)', 'mail', 'handling', 'send-contract-signed-confirmation'),
  ('send-deactivation-followups', 'Deaktivering: opfølgning', 'mail', 'tidsplan', 'send-deactivation-followups'),
  ('send-deactivation-reminder', 'Medarbejder deaktiveret (handling påkrævet)', 'mail', 'handling', 'send-deactivation-reminder'),
  ('send-employee-invitation', 'Invitation til Stork', 'mail', 'handling', 'send-employee-invitation'),
  ('send-employee-sms', 'SMS til medarbejder', 'sms', 'handling', 'send-employee-sms'),
  ('send-push', 'Testnotifikation (egen)', 'push', 'handling', 'send-push'),
  ('send-ramp-risk-alerts', 'Ramp: risikoflag (nye sælgere)', 'push', 'tidsplan', 'send-ramp-risk-alerts'),
  ('send-ramp-session-feedback', 'Ramp: feedback fra ugens forløb', 'mail', 'tidsplan', 'send-ramp-session-feedback'),
  ('send-ramp-weekly-alerts', 'Ramp: fredagspåmindelse', 'push', 'tidsplan', 'send-ramp-weekly-alerts'),
  ('send-recruitment-email', 'Rekruttering: mail til kandidat', 'mail', 'handling', 'send-recruitment-email'),
  ('send-recruitment-sms', 'Rekruttering: SMS til kandidat', 'sms', 'handling', 'send-recruitment-sms'),
  ('send-supplier-report', 'Leverandørrapport', 'mail', 'handling', 'send-supplier-report'),
  ('send-test-email', 'Testmail (ejer)', 'mail', 'handling', 'send-test-email'),
  ('send-tryg-cancellation', 'Tryg: annulleringsmail', 'mail', 'handling', 'send-tryg-cancellation'),
  ('send-udsendelser', 'Udsendelser (masse-mail)', 'mail', 'tidsplan', 'send-udsendelser'),
  ('supplier-report-scheduler', 'Leverandørrapport: daglig kø og påmindelser', 'mail', 'tidsplan', 'supplier-report-scheduler'),
  ('unsubscribe-candidate', 'Kandidat afmeldt', 'mail', 'webhook', 'unsubscribe-candidate'),
  ('weekly-lead-closure-report', 'Tryg: ugentlig lead-rapport', 'mail', 'tidsplan', 'weekly-lead-closure-report');

-- 90 dages opbevaring af loggen (persondata), som cron-job.
select cron.schedule('udsendelser_oprydning', '15 3 * * *', $job$ delete from public.udsendelser where tidspunkt < now() - interval '90 days' $job$);

-- Menupunkt under Administration (koden: struktur.ts side_udsendelser, synlig for ejere).
insert into public.sidebar_menu_config (id, item_key, parent_key, sort_order, visible, label_override, icon_name, href)
  select gen_random_uuid(), 'side_udsendelser', 'omraade_administration', 20, true, null, 'Send', '/udsendelser'
  where exists (select 1 from public.sidebar_menu_config where item_key = 'omraade_administration')
  on conflict (item_key) do nothing;

select core_compliance.stork_script_slut();
commit;
select (select count(*) from public.udsendelsestyper) typer, (select count(*) from public.udsendelser_historik) historik, (select count(*) from cron.job where jobname = 'udsendelser_oprydning') oprydningsjob;
