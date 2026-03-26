

## Adgangsstyring til fejlrapporteringsmodulet

### Hvad bygges
En ny fane **"Adgang"** (owner-only) i `/system-feedback` hvor du kan styre hvilke medarbejdere der har adgang til formularen. Kun medarbejdere på adgangslisten (+ owners) kan se sidebar-linket og indsende/se egne rapporter.

### Database

**Ny tabel: `system_feedback_access`**

| Kolonne | Type |
|---|---|
| id | uuid PK |
| employee_id | uuid FK → employee_master_data (UNIQUE, ON DELETE CASCADE) |
| created_at | timestamptz |

RLS: Authenticated kan læse (for sidebar-check). Kun owners kan insert/delete.

**Opdatér RLS på `system_feedback`**: Insert-policy ændres så kun medarbejdere i `system_feedback_access` (eller owners) kan indsende.

### UI-ændringer

**1. `SystemFeedback.tsx`**
- Ny fane **"Adgang"** (kun owner) — identisk mønster som "Modtagere"-fanen: søg + tilføj/fjern medarbejdere
- Liste-fanen: Ikke-owners ser kun egne indrapporteringer (filtreret på `submitted_by`)
- Indsend-fanen: Virker uændret (RLS sikrer at kun folk med adgang kan indsende)

**2. `AppSidebar.tsx`**
- Sidebar-linket "Fejlrapportering" vises kun hvis brugeren er owner ELLER findes i `system_feedback_access`-tabellen
- Ny query der checker adgang ved sidebar-load

### Filer der ændres
1. **Migration** — opret `system_feedback_access` + opdatér insert-policy på `system_feedback`
2. **`src/pages/SystemFeedback.tsx`** — ny "Adgang"-fane + filtrer liste for ikke-owners
3. **`src/components/layout/AppSidebar.tsx`** — betinget visning af sidebar-link baseret på adgangstabel

