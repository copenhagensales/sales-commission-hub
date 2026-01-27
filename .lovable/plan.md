
# Plan: Ny "Nye Medarbejdere" fane i Lønstyring

## Overblik
Opretter en ny fane "Nye medarbejdere" i lønstyringssiden, som viser medarbejdere og stab der er startet i den valgte lønperiode. Man kan bladre mellem lønperioder, og ved klik på en medarbejder åbnes deres stamkort.

## Funktionalitet
- Viser alle medarbejdere med `employment_start_date` inden for den valgte lønperiode
- Adskiller visning mellem "Medarbejdere" og "Stab" (baseret på `is_staff_employee` flag)
- Lønperiode-navigation (15. til 14.) med pile-knapper
- Klikbar række der åbner medarbejderens stamkort (`/employees/:id`)
- Viser relevante kolonner: Navn, Stilling, Startdato, Team

---

## Teknisk implementering

### Nye filer

#### 1. `src/components/salary/NewEmployeesTab.tsx`
Hovedkomponent for fanen med følgende struktur:

```text
┌─────────────────────────────────────────────────┐
│  < 15. jan. - 14. feb. >    [PayrollPeriodSelector]
├─────────────────────────────────────────────────┤
│  Medarbejdere (3)                               │
├─────────────────────────────────────────────────┤
│  Navn          │ Stilling │ Startdato │ Team   │
│  Anders Jensen │ Sælger   │ 17. jan.  │ Team A │
│  ...                                            │
├─────────────────────────────────────────────────┤
│  Stab (1)                                       │
├─────────────────────────────────────────────────┤
│  Navn          │ Stilling │ Startdato │ Afd.   │
│  Maria Hansen  │ HR       │ 20. jan.  │ Admin  │
└─────────────────────────────────────────────────┘
```

**Implementeringsdetaljer:**
- Bruger eksisterende `PayrollPeriodSelector` komponent til periode-navigation
- Henter medarbejderdata fra `employee_master_data` filtreret på `employment_start_date`
- Opdeler i to sektioner: Almindelige medarbejdere og Stab (via `is_staff_employee`)
- Ved klik på række: `navigate(\`/employees/\${employee.id}\`)`
- Viser loading state og tom-tilstand korrekt

### Ændringer i eksisterende filer

#### 2. `src/pages/SalaryTypes.tsx`
- Importerer den nye `NewEmployeesTab` komponent
- Tilføjer ny `<TabsTrigger value="new-employees">Nye medarbejdere</TabsTrigger>`
- Tilføjer tilhørende `<TabsContent>` med `NewEmployeesTab`

---

## Hook og dataflow

Opretter en hook til at hente nye medarbejdere:

**`useNewEmployees(periodStart: Date, periodEnd: Date)`**
- Query til `employee_master_data`
- Filter: `employment_start_date` mellem `periodStart` og `periodEnd`
- Filter: `is_active = true`
- Returnerer opdelt i medarbejdere og stab

---

## Kodestruktur

```
src/
├── components/salary/
│   └── NewEmployeesTab.tsx     # Ny komponent
└── pages/
    └── SalaryTypes.tsx          # Tilføjer fane
```

---

## UI-detaljer

**Tabelkolonner:**
| Kolonne | Felt | Format |
|---------|------|--------|
| Navn | `first_name + last_name` | Fuldt navn |
| Stilling | `job_title` | Tekst |
| Startdato | `employment_start_date` | "d. MMM yyyy" |
| Team/Afdeling | `teams` relation | Join på team_members |

**Interaktioner:**
- Hele rækken er klikbar med hover-effekt
- Klik åbner `/employees/:id` (eksisterende stamkortside)
- Pile-navigation skifter lønperiode

---

## Sekvensdiagram

```text
Bruger             NewEmployeesTab          Supabase          EmployeeDetail
  │                      │                      │                   │
  │──(åbn fane)─────────>│                      │                   │
  │                      │──(hent periode)─────>│                   │
  │                      │<──(medarbejdere)─────│                   │
  │<──(vis liste)────────│                      │                   │
  │                      │                      │                   │
  │──(klik på række)────>│                      │                   │
  │                      │──────────────(navigate)─────────────────>│
  │                      │                      │                   │
  │──(bladr periode)────>│                      │                   │
  │                      │──(ny periode query)─>│                   │
  │<──(opdater liste)────│                      │                   │
```
