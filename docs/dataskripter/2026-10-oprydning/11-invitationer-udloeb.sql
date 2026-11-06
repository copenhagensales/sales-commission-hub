-- Oprydning (fundet under trin 3, 26/10): employee_invitations.status tillader kun pending/completed/expired, men koden har hidtil skrevet
-- 'invalidated' (afvist stille) → 207 gamle invitationer står som pending, selv om deres expires_at er passeret: 89 hos aktive medarbejdere
-- der allerede har login, 118 hos inaktive medarbejdere. Alle sættes til 'expired' (datoen ER udløbet; intet link virker). De ændrede id'er
-- gemmes i arkivet, så det kan rulles tilbage præcist. Kørsel som registreret skript: 'SHA' = filens sha256. Testet på testkopien først.
-- Tilbagerulning: 11-invitationer-udloeb-tilbagerulning.sql. Regler (0.5): kun data; ingen persondata flyttes (kun id'er).
begin;
select core_compliance.stork_script_start('11-invitationer-udloeb.sql', 'SHA',
  'employee_invitations: pending-invitationer med passeret expires_at og uden completed_at sættes til expired (gammel fejl: koden skrev ''invalidated'', som CHECK afviser); id''er gemmes i arkiv_2026_10.employee_invitations_udloeb',
  'Mathias (26/10: »Lad os bare gå videre med det i dag«)');
create table if not exists arkiv_2026_10.employee_invitations_udloeb (id uuid primary key, udloebet_af_skript timestamptz not null default now());
insert into arkiv_2026_10.employee_invitations_udloeb (id)
  select id from public.employee_invitations where status = 'pending' and expires_at < now() and completed_at is null
  on conflict (id) do nothing;
update public.employee_invitations i set status = 'expired'
  where i.status = 'pending' and i.expires_at < now() and i.completed_at is null;
select core_compliance.stork_script_slut();
commit;
select status, count(*) from public.employee_invitations group by 1 order by 1;
