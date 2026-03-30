

## Giv 4 roller adgang til annullerings-faner

### Problem
Rollerne `assisterendetm`, `assisterende_teamleder_fm`, `fm_leder` og `teamleder` mangler `can_view` på nogle annullerings-faner, så de ikke kan se Upload, Godkendelseskø og Godkendte.

### Nuværende status i databasen

| Rolle | upload | approval | approved |
|-------|--------|----------|----------|
| assisterende_teamleder_fm | ✅ view+edit | ❌ | mangler |
| assisterendetm | ❌ | ❌ | mangler |
| fm_leder | ✅ view+edit | ❌ | mangler |
| teamleder | ✅ view | ❌ | mangler |

### Ændringer (kun data-opdateringer, ingen kode)

**1. Opdater eksisterende rækker — sæt `can_view = true`:**
- `assisterendetm` → `tab_cancellations_upload`
- `assisterendetm` → `tab_cancellations_approval`
- `assisterende_teamleder_fm` → `tab_cancellations_approval`
- `fm_leder` → `tab_cancellations_approval`
- `teamleder` → `tab_cancellations_approval`

**2. Opret manglende rækker — `tab_cancellations_approved`:**
- Indsæt nye permission-rækker for alle 4 roller med `can_view = true, can_edit = false`

Ingen kodeændringer nødvendige — UI'et bruger allerede `canView('tab_cancellations_*')` korrekt.

