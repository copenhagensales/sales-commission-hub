
## Giv Sejer adgang til Kommende Opstarter

### Problem
Sejer Sylvester Schmidt har stillingsbetegnelsen "Assisterende Teamleder TM", men hans **position** i systemet er sat til "Salgskonsulent" (medarbejder-rolle). Medarbejder-rollen har ikke adgang til Kommende Opstarter.

### Løsning
Opdater Sejers `position_id` til den korrekte "Assisterende Teamleder TM"-position (`assisterendetm`-rollen), som allerede har:
- `can_view: true` for `menu_upcoming_starts`
- `visibility: all` (kan se alle teams)

### Ændring
**Database-opdatering (1 SQL statement):**
- Opdater `employee_master_data` for Sejer (id: `b2bb0f7f-...`) med `position_id` = `454291a1-...` (Assisterende Teamleder TM)

Dette giver ham automatisk alle de rettigheder der hører til "Assisterende Teamleder TM"-rollen, inkl. adgang til Kommende Opstarter med fuld visibility.
