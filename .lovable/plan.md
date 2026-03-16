

## Fix: Giv Thomas Wehage adgang til Hoteller-fanen

### Problem
Thomas Wehage har rollen `assisterende_teamleder_fm`. Denne rolle har `can_view: false` for `tab_fm_hotels` — derfor vises Hotel-fanen ikke for ham.

### Løsning
Opdater rettigheden i `role_page_permissions` så `assisterende_teamleder_fm` får `can_view: true` og `can_edit: true` for `tab_fm_hotels` med `visibility: all`.

### Ændring
**Database-opdatering (1 SQL statement):**
```sql
UPDATE role_page_permissions
SET can_view = true, can_edit = true, visibility = 'all'
WHERE role_key = 'assisterende_teamleder_fm' AND permission_key = 'tab_fm_hotels';
```

Dette giver Thomas (og alle med samme rolle) fuld adgang til Hotel-fanen igen.

