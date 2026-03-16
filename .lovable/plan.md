

## Plan: Sæson 2 med kvalifikation denne uge

### Dataopdateringer (ingen skemaændringer)

**1. Afslut Sæson 1**
- Sæt `status = 'completed'`, `is_active = false` på Season 1
- Sæt Round 3 til `completed` (den er stadig `active`)

**2. Opret Sæson 2**

| Felt | Værdi | Begrundelse |
|------|-------|-------------|
| `qualification_source_start` | 15. mar 2026 | Provision beregnes fra i dag |
| `qualification_source_end` | 22. mar 2026 | Slutning af denne uge |
| `qualification_start_at` | 16. mar 2026 | Tilmelding åbner nu |
| `qualification_end_at` | 22. mar 2026 (søndag 23:59) | Kvalifikation slutter søndag |
| `start_date` | 23. mar 2026 (mandag) | Sæsonen starter mandag efter kvalifikation |
| `end_date` | `NULL` | Kører uendeligt |
| `status` | `qualification` | Aktiv kvalifikation nu |
| `is_active` | `true` | Synlig for brugere |

### Handlinger
- 2× data-opdateringer via insert-tool (UPDATE Season 1 + Round 3, INSERT Season 2)
- Ingen kodeændringer nødvendige — eksisterende hooks henter automatisk den aktive sæson

