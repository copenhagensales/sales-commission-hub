## Opdater sale_datetime for 9 TDC Erhverv OPP-numre

Kun dato ændres — klokkeslæt bevares. Ingen sletninger. Ingen ændringer på `sale_items`/commission ud over dato-flytningen.

### Migration

```sql
-- OPP-1082198 → 16/4 (1 record allerede 16/4, 2 flyttes)
UPDATE sales SET sale_datetime = make_timestamptz(2026, 4, 16,
  EXTRACT(HOUR FROM sale_datetime)::int,
  EXTRACT(MINUTE FROM sale_datetime)::int,
  EXTRACT(SECOND FROM sale_datetime), 'UTC')
WHERE id IN ('363585c4-e8d8-4715-b29d-f7c6d8aa1a4e','122ab003-b8ab-4cd1-a41c-8a16ad932ba5');

-- OPP-1081464 → 17/4 (3 records)
UPDATE sales SET sale_datetime = make_timestamptz(2026, 4, 17, ...)
WHERE id IN ('1f453ae4-...','e24b5370-...','7cf91ef8-...');

-- OPP-1073821 → 17/4 (2 records)
-- OPP-1070694 → 20/4 (1)
-- OPP-1082657 → 20/4 (1)
-- OPP-1082880 → 21/4 (1)
-- OPP-1082825 → 21/4 (2)
-- OPP-1083038 → 22/4 (1)
-- OPP-1083197 → 23/4 (1)
```

I alt 13 rækker opdateres.

### Rød zone

`sales` tabellen påvirker lønperiode-tilknytning (15→14-cyklus) og kan trigge pricing-rematch. Klokkeslæt bevares så time-baseret logik er uændret.
