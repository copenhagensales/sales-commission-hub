
# Plan: Synkronisér Dashboard-rettigheder med Database

## Problemanalyse

### Nuværende Situation

| Problem | Konsekvens |
|---------|------------|
| `menu_dashboards` findes kun i `permissionKeys.ts`, **IKKE** i databasen | Medarbejdere kan ikke se dashboard-miljøet i sidebaren |
| `menu_dashboard_admin` mangler i databasen | Ejere kan tilgå settings (via hardcode), men kan ikke delegere admin-adgang til andre |
| Legacy keys (`menu_dashboard`, `menu_fm_dashboard`, etc.) fylder databasen | Forvirrende og potentielt konfliktende med det nye system |

### Hvorfor Ejere Kan Se Settings (Men Andre Ikke Kan)
Ejere har en **hardcoded bypass** i `usePositionPermissions.ts` (linje 446-458):
```typescript
if (isOwner && !isPreviewMode) {
  return true; // Alle rettigheder for ejere
}
```

Dette giver ejere adgang til `/dashboards/settings`, men andre roller blokeres fordi `menu_dashboard_admin` ikke findes i `role_page_permissions`.

---

## Løsning: Seed Manglende Rettigheder + Oprydning

### Fase 1: Tilføj Manglende Dashboard-rettigheder til Databasen

Indsæt `menu_dashboards` og `menu_dashboard_admin` for alle roller:

```sql
-- Seed menu_dashboards for alle roller (standard: can_view = true for adgang til miljøet)
INSERT INTO role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
VALUES 
  ('ejer', 'menu_dashboards', true, true, 'all'),
  ('teamleder', 'menu_dashboards', true, false, 'team'),
  ('rekruttering', 'menu_dashboards', true, false, 'team'),
  ('fm_leder', 'menu_dashboards', true, false, 'team'),
  ('assisterende_teamleder_fm', 'menu_dashboards', true, false, 'team'),
  ('assisterendetm', 'menu_dashboards', true, false, 'team'),
  ('medarbejder', 'menu_dashboards', true, false, 'self'),
  ('fm_medarbejder_', 'menu_dashboards', true, false, 'self'),
  ('some', 'menu_dashboards', true, false, 'self'),
  ('backoffice', 'menu_dashboards', false, false, 'self')
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Seed menu_dashboard_admin (kun ejere som standard)
INSERT INTO role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
VALUES 
  ('ejer', 'menu_dashboard_admin', true, true, 'all'),
  ('teamleder', 'menu_dashboard_admin', false, false, 'team'),
  ('rekruttering', 'menu_dashboard_admin', false, false, 'team'),
  ('fm_leder', 'menu_dashboard_admin', false, false, 'team'),
  ('assisterende_teamleder_fm', 'menu_dashboard_admin', false, false, 'team'),
  ('assisterendetm', 'menu_dashboard_admin', false, false, 'team'),
  ('medarbejder', 'menu_dashboard_admin', false, false, 'self'),
  ('fm_medarbejder_', 'menu_dashboard_admin', false, false, 'self'),
  ('some', 'menu_dashboard_admin', false, false, 'self'),
  ('backoffice', 'menu_dashboard_admin', false, false, 'self')
ON CONFLICT (role_key, permission_key) DO NOTHING;
```

### Fase 2: Ryd Op i Legacy Dashboard Keys

Slet forældede dashboard-relaterede keys der ikke er defineret i `permissionKeys.ts`:

```sql
-- Fjern legacy dashboard keys (de nye: menu_dashboards, menu_dashboard_admin beholdes)
DELETE FROM role_page_permissions 
WHERE permission_key IN (
  'menu_dashboard',          -- gammel generisk key
  'menu_fm_dashboard',       -- gammel
  'menu_mg_test_dashboard',  -- gammel
  'menu_relatel_dashboard',  -- gammel
  'menu_tdc_erhverv_dashboard', -- gammel
  'menu_recruitment_dashboard', -- gammel (til rekruttering, ikke dashboards)
  'menu_security_dashboard',  -- separat sektion
  'menu_ase_dashboard',      -- gammel
  'menu_test_dashboard',     -- gammel
  'menu_tryg_dashboard'      -- gammel
);
```

---

## Forventet Resultat

### Efter Implementering

| Bruger | Dashboard-miljø | Dashboard-indstillinger |
|--------|-----------------|-------------------------|
| Ejer | ✅ Fuld adgang | ✅ Kan administrere |
| Teamleder | ✅ Via sidebar | ❌ (medmindre tildelt) |
| Medarbejder | ✅ Via sidebar | ❌ |

### I Permission Editor

Dashboards-sektionen vil vise:
- **menu_dashboards**: Kontrollerer adgang til selve dashboard-miljøet
- **menu_dashboard_admin**: Kontrollerer adgang til Dashboard Indstillinger

Administratorer kan nu tildele `menu_dashboard_admin` til andre roller via Permission Editor, så de også kan administrere dashboard-rettigheder.

---

## Filer/Database der Ændres

| Ressource | Ændring |
|-----------|---------|
| **Database: role_page_permissions** | Indsæt 20 nye rækker (10 for hver key) |
| **Database: role_page_permissions** | Slet ~30-50 legacy dashboard rækker |

Ingen kodeændringer er nødvendige - kun database-synkronisering.
