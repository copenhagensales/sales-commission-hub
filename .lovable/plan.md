

## Giv Oscar Belcher adgang til Powerdag

### Analyse
Oscar Belcher er i **Stab**-teamet og er korrekt sat op (aktiv, har auth, kan se dashboards-sektionen). Powerdag har `globalAccess: true` i koden, som burde gøre det synligt for alle — men Stab-teamet har **ingen** `team_dashboard_permissions` rows overhovedet (heller ikke for andre dashboards). 

Det kan betyde at seeding aldrig har kørt for Stab, og der kan være en edge case i caching eller query-timing. Den sikreste løsning er at oprette en explicit permission-row.

### Ændring

**Database**: Indsæt en `team_dashboard_permissions` row for Stab + powerdag:

```sql
INSERT INTO team_dashboard_permissions (team_id, dashboard_slug, access_level)
VALUES ('09012ce9-e307-4f6d-a51e-f72af7200d74', 'powerdag', 'all')
ON CONFLICT (team_id, dashboard_slug) DO UPDATE SET access_level = 'all';
```

Dette sikrer at alle i Stab-teamet (inkl. Oscar) eksplicit får adgang til Powerdag via `team_dashboard_permissions` — uanset `globalAccess`-logikken.

### Resultat
Oscar Belcher vil se Powerdag i dashboard-listen og kan navigere til det.

