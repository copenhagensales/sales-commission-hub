-- Udsendelser, del 6 (Mathias 26/10: »koge det ned, så det hele står i overskrifter«): hver type får en gruppe (overskrift) og et flag
-- til_medarbejdere. Min profil → Notifikationer viser én overskrift pr. gruppe med én kontakt; typer, der aldrig går til medarbejdere
-- (kandidater, leverandører, Tryg, kunder, systemtest), vises ikke. udsendelse_mine_typer() udvides med gruppe og filtrerer på flaget.
-- Grupperingen bygger på Codex' modtageropgørelse (codex-modtagere.md). Kørsel som registreret skript: 'SHA' = filens sha256.
-- Testet på testkopien først. Tilbagerulning: 12-grupper-tilbagerulning.sql. Regler (0.5): kun data + én eksisterende SECURITY DEFINER-funktion (samme rettigheder).
begin;
select core_compliance.stork_script_start('12-grupper.sql', 'SHA',
  'Udsendelser: kolonnerne gruppe og til_medarbejdere på udsendelsestyper (overskrifter på Min profil; eksterne/kandidat-typer skjules); udsendelse_mine_typer() returnerer gruppe og filtrerer på til_medarbejdere',
  'Mathias (26/10: »koge det ned, så det hele står i overskrifter«)');

alter table public.udsendelsestyper
  add column gruppe text not null default 'Andet',
  add column til_medarbejdere boolean not null default true;
comment on column public.udsendelsestyper.gruppe is 'Overskrift på Min profil → Notifikationer og i Overblik. Én kontakt pr. gruppe for brugeren.';
comment on column public.udsendelsestyper.til_medarbejdere is 'Falsk = typen går aldrig til medarbejdere med login (kandidater, leverandører, Tryg, kunder, systemtest) og vises ikke på Min profil.';

update public.udsendelsestyper t set gruppe = v.gruppe, til_medarbejdere = v.til_medarb
from (values
  -- Ansættelse og kontrakter
  ('activate-employee-account',          'Ansættelse og kontrakter', true),
  ('send-employee-invitation',           'Ansættelse og kontrakter', true),
  ('send-contract-email',                'Ansættelse og kontrakter', true),
  ('send-contract-reminders',            'Ansættelse og kontrakter', true),
  ('send-contract-signed-confirmation',  'Ansættelse og kontrakter', true),
  ('send-code-of-conduct-reminder',      'Ansættelse og kontrakter', true),
  ('send-ai-instruction-email',          'Ansættelse og kontrakter', true),
  ('send-car-quiz-result',               'Ansættelse og kontrakter', true),
  -- Onboarding og ramp
  ('ramp_session_feedback',              'Onboarding og ramp', true),
  ('ramp_weekly_program',                'Onboarding og ramp', true),
  ('ramp_risk_flag',                     'Onboarding og ramp', true),
  ('send-ramp-weekly-alerts',            'Onboarding og ramp', true),
  ('send-ramp-risk-alerts',              'Onboarding og ramp', true),
  -- Kvalitet
  ('quality_feedback',                   'Kvalitet', true),
  ('quality_rejected',                   'Kvalitet', true),
  ('quality_team_summary',               'Kvalitet', true),
  ('quality_management_summary',         'Kvalitet', true),
  -- Compliance
  ('check-compliance-reviews',           'Compliance', true),
  ('send-compliance-alert-mail',         'Compliance', true),
  ('send-compliance-alert-push',         'Compliance', true),
  ('send-contract-compliance-digest',    'Compliance', true),
  -- Vagter og FM
  ('send-checklist-daily-summary',       'Vagter og FM', true),
  ('notify-vehicle-returned-mail',       'Vagter og FM', true),
  ('notify-vehicle-returned-sms',        'Vagter og FM', true),
  -- Storkbook og Klub
  ('pulsen-milestones',                  'Storkbook og Klub', true),
  -- Beskeder fra ledelsen
  ('send-besked-mail',                   'Beskeder fra ledelsen', true),
  ('send-besked-sms',                    'Beskeder fra ledelsen', true),
  ('send-besked-push',                   'Beskeder fra ledelsen', true),
  ('send-employee-sms',                  'Beskeder fra ledelsen', true),
  -- Ledelse (interne adviseringer til ledere/rekruttering/salg)
  ('send-deactivation-reminder',         'Ledelse', true),
  ('send-deactivation-followups',        'Ledelse', true),
  ('notify-referral-received',           'Ledelse', true),
  ('customer-inquiry-webhook',           'Ledelse', true),
  ('unsubscribe-candidate',              'Ledelse', true),
  -- Rekruttering: til kandidater (uden login) – vises ikke på Min profil
  ('send-recruitment-email',             'Rekruttering (kandidater)', false),
  ('send-recruitment-sms',               'Rekruttering (kandidater)', false),
  ('public-book-candidate',              'Rekruttering (kandidater)', false),
  ('afslag',                             'Rekruttering (kandidater)', false),
  ('process-scheduled-emails',           'Rekruttering (kandidater)', false),
  ('send-udsendelser',                   'Rekruttering (kandidater)', false),
  -- Eksterne: leverandører, Tryg – vises ikke på Min profil
  ('send-supplier-report',               'Eksterne (leverandører, Tryg)', false),
  ('supplier-report-scheduler',          'Eksterne (leverandører, Tryg)', false),
  ('weekly_lead_closure_report',         'Eksterne (leverandører, Tryg)', false),
  ('send-tryg-cancellation',             'Eksterne (leverandører, Tryg)', false),
  -- System/test (ejerens egne tests) – vises ikke på Min profil
  ('send-push',                          'System', false),
  ('send-test-email',                    'System', false)
) v(noegle, gruppe, til_medarb)
where t.noegle = v.noegle;

-- Returtypen ændres (gruppe kommer med), så funktionen genskabes; rettigheder sættes som i skript 9.
drop function public.udsendelse_mine_typer();
create function public.udsendelse_mine_typer()
returns table (noegle text, navn text, kanal text, beskrivelse text, aktiv boolean, gruppe text)
language sql
security definer
set search_path = ''
stable
as $$
  select t.noegle, t.navn, t.kanal, t.beskrivelse,
         coalesce((select p.aktiv from public.udsendelsespraeferencer p where p.user_id = auth.uid() and p.type_noegle = t.noegle and p.kanal = t.kanal), true) aktiv,
         t.gruppe
  from public.udsendelsestyper t
  where auth.uid() is not null
    and t.aktiv
    and t.til_medarbejdere
    and public.udsendelse_tilladt(auth.uid(), t.noegle)
  order by t.gruppe, t.kanal, t.navn;
$$;
comment on function public.udsendelse_mine_typer() is 'Min profil → Notifikationer: den indloggede brugers aktive udsendelsestyper (kun typer til medarbejdere, inden for modtagerreglen) med gruppe/overskrift og eget til-/fravalg. Ingen persondata.';
revoke all on function public.udsendelse_mine_typer() from public, anon;
grant execute on function public.udsendelse_mine_typer() to authenticated;

select core_compliance.stork_script_slut();
commit;
select gruppe, count(*) typer, bool_and(til_medarbejdere) til_medarb from public.udsendelsestyper group by 1 order by 1;
