

## Nulstil kvalifikation til denne uge

### Hvad er problemet
Sæsonens datoer er sat til januar 2026. De er udløbet, og kvalifikationen kører ikke.

### Hvad skal ændres

**1 database-opdatering** — opdater sæson-datoerne:

| Felt | Nuværende | Ny værdi |
|------|-----------|----------|
| `qualification_source_start` | 12. jan | **16. marts (mandag)** |
| `qualification_source_end` | 24. jan | **22. marts (søndag)** |
| `qualification_start_at` | 11. jan | **16. marts (mandag)** |
| `qualification_end_at` | 24. jan | **22. marts (søndag kl 23:59)** |

```sql
UPDATE league_seasons
SET 
  qualification_source_start = '2026-03-16T00:00:00+01:00',
  qualification_source_end   = '2026-03-22T23:59:59+01:00',
  qualification_start_at     = '2026-03-16T00:00:00+01:00',
  qualification_end_at       = '2026-03-22T23:59:59+01:00'
WHERE id = 'dd9d9404-0a8c-4ed7-9c7a-2a446d54ff78';
```

**2. Nulstil standings** — slet alle eksisterende standings så de genberegnes med den nye periodes provision:

```sql
DELETE FROM league_qualification_standings
WHERE season_id = 'dd9d9404-0a8c-4ed7-9c7a-2a446d54ff78';
```

**3. Genberegn** — kald `league-calculate-standings` edge function for at beregne nye standings baseret på denne uges salg.

Ingen kodeændringer — kun data-opdatering og genberegning.

