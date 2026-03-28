

## Tilføj 4 nye datatyper til Sletningspolitikker

### Ændring
Indsæt 4 nye rækker i `data_retention_policies` — alle deaktiverede:

| data_type | display_name | retention_days | cleanup_mode |
|-----------|-------------|----------------|--------------|
| `integration_logs` | Integrationslogfiler | 180 | delete_all |
| `login_events` | Login-historik | 365 | delete_all |
| `password_reset_tokens` | Password reset tokens | 30 | delete_all |
| `communication_logs` | Rekrutteringskommunikation | null | delete_all |

### Teknisk
- 4× SQL INSERT via insert-værktøjet
- Alle med `is_active = false`
- Vises automatisk i "Øvrige datatyper"-sektionen
- Udvid `gdpr-data-cleanup/index.ts` med cleanup-logik for de 4 nye datatyper

### Fil-ændringer
| Fil | Ændring |
|-----|---------|
| `supabase/functions/gdpr-data-cleanup/index.ts` | Tilføj cleanup-cases for `integration_logs`, `login_events`, `password_reset_tokens`, `communication_logs` |

