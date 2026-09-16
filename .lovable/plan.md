# Medarbejderfordele (rabataftaler)

Nyt menupunkt under "Anbefal en ven" i Mit Hjem, hvor alle medarbejdere kan se firmaets rabataftaler (fx Suit Club). Kun superadmin og medlemmer af teamet Stab kan oprette, rette og slette aftaler.

## Hvad brugeren ser

- Menupunkt "Fordele" under "Anbefal en ven" — synligt for alle med adgang til Stork.
- Side med kort pr. aftale: partnernavn, kort beskrivelse, om aftalen bruges online, fysisk eller begge, rabatkode (med kopier-knap) og eventuelt link.
- Søgefelt og filter på type (online / fysisk / begge).
- For superadmin og Stab: knappen "Tilføj aftale" samt rediger/slet på hver aftale, plus mulighed for at sætte en aftale inaktiv i stedet for at slette den.
- Inaktive aftaler er skjult for almindelige medarbejdere, men synlige (markeret) for Stab/superadmin.

## Felter pr. aftale (minimalt sæt)

- Partner (navn)
- Beskrivelse
- Type: online, fysisk eller begge
- Rabatkode (valgfri)
- Link (valgfri)
- Aktiv / inaktiv

## Teknisk

**Database (migration)**
- Ny tabel `public.employee_perks`: `partner_name`, `description`, `redemption_type` (enum-lignende check: `online` | `fysisk` | `begge`), `discount_code`, `link_url`, `is_active`, `sort_order`, `created_by`, `created_at`, `updated_at` + updated_at-trigger.
- GRANT: `SELECT` til `authenticated`, `SELECT, INSERT, UPDATE, DELETE` til `authenticated` (skrivning styres af policies), `ALL` til `service_role`. Ingen `anon`-adgang.
- RLS til:
  - Læsning: alle authenticated må se rækker hvor `is_active = true`; forvaltere må se alle.
  - Skrivning (insert/update/delete): kun via ny `SECURITY DEFINER`-funktion `public.can_manage_employee_perks(_user_id uuid)` = `is_owner(_user_id)` ELLER aktiv superadmin (samme mønster som `can_manage_dpa_documents`) ELLER medlem af teamet Stab (`team_members` → `teams.name = 'Stab'` via `employee_master_data.auth_user_id`). Teamnavnet slås op i data, ikke som hardkodet rolle-key.
  - `search_path = public` sættes eksplicit.

**Frontend**
- Ny hook `src/hooks/useEmployeePerks.ts` (React Query): liste, opret, opdater, slet, samt `canManagePerks` via RPC til `can_manage_employee_perks`. Al dataadgang gennem hooken — ingen Supabase-kald i komponenter.
- Ny side `src/pages/EmployeePerks.tsx` + dialog-komponent til opret/ret under `src/components/perks/`.
- Route `/perks` registreres i `src/routes/pages.ts` og `src/routes/config.tsx` med `access: "role"` og ny rettighedsnøgle `menu_employee_perks`.
- Rettighedsnøglen tilføjes i `src/config/permissionKeys.ts` (sektion `mit_hjem`, parent `menu_section_personal`) og i `src/config/permissions.ts` uden edit-option — redigering styres udelukkende af databasefunktionen.
- Menupunkt indsættes i `src/components/layout/AppSidebar.tsx` direkte efter "Anbefal en ven", styret af `p.canViewEmployeePerks`.
- Visningsrettigheden tildeles alle aktive roller i `role_page_permissions`, så alle kan se punktet.

**Ikke berørt**
Løn, provision, pricing, GDPR-flows, eksisterende rettighedslogik og alle eksisterende tabeller. Ingen ændringer i røde zoner ud over den nye rettighedsnøgle, som tilføjes additivt.

## Verifikation

- Typecheck.
- Opslag: rettighedsrækker oprettet for alle roller; ny tabel med RLS aktiv.
- Browsertjek: siden vises, en almindelig bruger ser ingen redigeringsknapper, superadmin ser dem.
