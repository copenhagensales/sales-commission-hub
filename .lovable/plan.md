

# Giv Relatel-teamet 'leadership' adgang til Relatel Produkter

## Hvad sker der
Indsætter én række i `team_dashboard_permissions` for Relatel-teamet (id: `f4210d48-...`) med `dashboard_slug = 'relatel-products'` og `access_level = 'leadership'`.

Det betyder kun Karl Koppel (teamleder) og Rasmus Andie Eltong (assisterende teamleder) kan se dashboardet. Almindelige Relatel-medarbejdere og andre teams har ingen adgang.

## Teknisk
Én data-insert via insert-tool:
```sql
INSERT INTO team_dashboard_permissions (team_id, dashboard_slug, access_level)
VALUES ('f4210d48-5062-4e3a-b945-7ff1d5a874dd', 'relatel-products', 'leadership')
ON CONFLICT (team_id, dashboard_slug) DO UPDATE SET access_level = 'leadership';
```

Ingen kodeændringer nødvendige.

