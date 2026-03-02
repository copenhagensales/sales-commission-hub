
# Fix: Tilføj "cancelled" til contract_status enum

## Problem
Databasen har en trigger (`remove_deactivated_employee_from_teams`) der automatisk sætter ventende kontrakter til status `cancelled` når en medarbejder deaktiveres. Men `cancelled` er ikke en gyldig værdi i `contract_status` enum'en, hvilket giver fejlen:

```
invalid input value for enum contract_status: "cancelled"
```

Gyldige værdier i dag: `draft`, `pending_employee`, `pending_manager`, `signed`, `rejected`, `expired`

## Løsning
En enkelt database-migration der tilføjer `cancelled` som gyldig enum-værdi:

```sql
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'cancelled';
```

## Konsekvens
- Deaktivering af medarbejdere (som Alfred Rud) vil fungere igen
- Ventende kontrakter vil korrekt blive markeret som annulleret ved deaktivering
- Ingen kodeændringer nødvendige -- kun database-fix
