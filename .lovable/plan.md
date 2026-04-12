

## Fix: `position_id` mangler på medarbejdere

### Årsag
Ingen af medarbejder-oprettelsesflowene sætter `position_id`:
- `create-employee-user` (edge function) — sætter aldrig `position_id`
- `complete-employee-registration` (invitation flow) — sætter aldrig `position_id`
- `auto-segment-candidate` (kandidat → medarbejder) — sætter aldrig `position_id`

Uden `position_id` kan rettighedssystemet (`usePositionPermissions`) ikke slå rettigheder op, og medarbejdere mister adgang til funktioner.

### Løsning

**1. Database: Ret eksisterende medarbejdere (data-update)**

Sæt `position_id` baseret på `job_title` for alle aktive medarbejdere der mangler den:

| job_title | position_id | position_name |
|-----------|-------------|---------------|
| Salgskonsulent / salgskonsulent | `729194f5-...` | Salgskonsulent |
| Fieldmarketing / fieldmarketing | `f4c737ca-...` | Fieldmarketing |
| Rekruttering | `c5df66a2-...` | Rekruttering |
| SOME | `8682730a-...` | SOME |
| Ejer | `1ef14dcc-...` | Ejer |
| Teamleder | `412a9da6-...` | Teamleder |

**2. Database trigger: Auto-sæt `position_id` ved oprettelse**

Opret en trigger-funktion `auto_set_position_id()` der kører på INSERT og UPDATE af `employee_master_data`. Hvis `position_id IS NULL` og `job_title` matcher en kendt position, sættes `position_id` automatisk (case-insensitive match).

**3. Edge function: `create-employee-user/index.ts`**

Tilføj `position_id`-lookup baseret på `job_title` ved oprettelse af ny medarbejder, så fremtidige medarbejdere altid får en position.

### Filer der ændres

| Ændring | Detalje |
|---------|---------|
| **Database (data-update)** | Sæt `position_id` på ~20 aktive medarbejdere |
| **Database (migration)** | Opret trigger `auto_set_position_id` på `employee_master_data` |
| `supabase/functions/create-employee-user/index.ts` | Tilføj `position_id`-lookup ved employee insert |

### Resultat
- Alle eksisterende medarbejdere får korrekt `position_id`
- Fremtidige medarbejdere får automatisk `position_id` via trigger
- Ingen medarbejder mister adgang pga. manglende position igen

