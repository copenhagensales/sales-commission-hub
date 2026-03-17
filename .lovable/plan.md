

## Problem

Rekrutteringsmedarbejdere (med `system_role_key = 'rekruttering'`) har **ikke** adgang til rekrutteringsdashboardet, fordi `can_view = false` er sat i `role_page_permissions` for kombinationen `role_key = 'rekruttering'` + `permission_key = 'menu_recruitment_dashboard'`.

Ruten `/recruitment` kræver `positionPermission: "menu_recruitment_dashboard"`, og route-guarden (`RoleProtectedRoute`) tjekker dette – og afviser adgang.

## Plan

**Én database-opdatering** – sæt `can_view = true` (og evt. `can_edit = true`) for `rekruttering`-rollen på alle relevante rekrutterings-permissions:

```sql
UPDATE role_page_permissions
SET can_view = true, can_edit = true
WHERE role_key = 'rekruttering'
  AND permission_key IN (
    'menu_section_rekruttering',
    'menu_recruitment_dashboard',
    'menu_candidates',
    'menu_upcoming_interviews',
    'menu_winback',
    'menu_upcoming_hires',
    'menu_messages_recruitment',
    'menu_sms_templates',
    'menu_email_templates_recruitment',
    'menu_referrals'
  );
```

Ingen kodeændringer er nødvendige – kun en database-opdatering af rettigheder.

