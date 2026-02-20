

# Fix: Opdater stale `last_accessed_at` data

## Problem
Databasen viser at `last_accessed_at` sidst blev opdateret d. 22. januar for de aktive boards. Heartbeat-koden vi tilfoejede vil holde det opdateret fremover, men de nuvaerende data er foraeeldede -- derfor viser alle boards "Ubrugt i X dage".

## Loesning

### 1. Engangs-databaseopdatering
Koer en SQL-migration der saetter `last_accessed_at` til nu for alle aktive boards:

```text
UPDATE tv_board_access 
SET last_accessed_at = now() 
WHERE is_active = true;
```

### 2. Ingen kodeaendringer
Heartbeat-logikken i `useTvBoardConfig.ts` er allerede implementeret og vil holde `last_accessed_at` opdateret dagligt fremover. RLS-policies tillader allerede public updates paa aktive boards.

