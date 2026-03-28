

## Tilføj Jobansøgninger til Sletningspolitikker

### Ændring
Indsæt én ny række i `data_retention_policies` tabellen:

- `data_type`: `candidates`
- `display_name`: `Jobansøgninger`
- `retention_days`: null (ikke sat endnu)
- `is_active`: false
- `cleanup_mode`: `delete_all`

### Teknisk
Én SQL INSERT via insert-værktøjet. Ingen kodeændringer — den eksisterende "Øvrige datatyper"-sektion på RetentionPolicies-siden viser automatisk den nye række.

### Risiko
Ingen. Kun konfigurationsdata. Cleanup-jobbet er ikke aktiveret.

