

## Dataopdateringer for Sæson 1 → Sæson 2

Nuværende status i databasen:
- **Sæson 1** (id: `dd9d9404...`): `active`, `is_active: true`
- **Runde 5** (id: `bf0052a5...`): `active` under Sæson 1

### Trin 1: Afslut Sæson 1 + aktive runder

```sql
-- Afslut Sæson 1
UPDATE league_seasons 
SET status = 'completed', is_active = false 
WHERE id = 'dd9d9404-0a8c-4ed7-9c7a-2a446d54ff78';

-- Afslut Runde 5
UPDATE league_rounds 
SET status = 'completed' 
WHERE id = 'bf0052a5-a0cd-4cd6-ac4b-4b4407b56887';
```

### Trin 2: Opret Sæson 2 med kvalifikation denne uge

```sql
INSERT INTO league_seasons (
  season_number, status, is_active,
  qualification_source_start, qualification_source_end,
  qualification_start_at, qualification_end_at,
  start_date, end_date
) VALUES (
  2, 'qualification', true,
  '2026-03-15', '2026-03-22',
  '2026-03-16T00:00:00+01:00', '2026-03-22T23:59:59+01:00',
  '2026-03-23', NULL
);
```

### Resultat
- Sæson 1 lukkes helt ned (status `completed`)
- Sæson 2 oprettes med `qualification` status — tilmelding er åben nu
- `end_date = NULL` → sæsonen kører uendeligt
- Ingen kodeændringer nødvendige

