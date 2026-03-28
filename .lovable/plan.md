

## Tilføj Deaktiverede Medarbejdere til Sletningspolitikker

### Ændring
Indsæt én ny række i `data_retention_policies`:

- `data_type`: `inactive_employees`
- `display_name`: `Deaktiverede medarbejdere (5 år efter stop)`
- `retention_days`: `1825` (5 år)
- `is_active`: `false`
- `cleanup_mode`: `delete_all`

### Kontekst
Der eksisterer allerede en `cleanup-inactive-employees` edge function der sletter inaktive medarbejdere med `employment_end_date` ældre end 5 år. Denne række fungerer som en synlig påmindelse og konfigurationspunkt i Sletningspolitikker-oversigten.

### Teknisk
Én SQL INSERT via insert-værktøjet. Ingen kodeændringer — "Øvrige datatyper"-sektionen viser automatisk den nye række.

