

## Udfyld EmployeePrivacy.tsx med konkrete oplysninger

### Ændringer

**1. Kontaktperson (linje 132)** — placeholder `[indsæt kontaktperson eller mail]`
- Erstat med: "virksomhedens ejer" + en dynamisk visning af ejerens work_email hentet fra `employee_master_data` (job_title = "Ejer"). Fallback til teksten "din nærmeste leder" hvis ingen ejer findes.

**2. Opbevaring (linje 111-114)** — generisk tekst
- Erstat med den konkrete 5-årige retention-politik:
  - Løn- og økonomidata: 5 år (bogføringsloven)
  - Salgs- og provisionsdata: 5 år
  - Øvrig medarbejderdata: slettes senest 5 år efter fratrædelse
  - Ansøgerdata: 6 måneder efter afslag

**3. Adgang (linje 96-103)** — generisk
- Konkretiser med systemets faktiske roller:
  - Medarbejder: egne data (løn, provision, vagtplan)
  - Teamleder: teammedlemmers salgs- og vagtdata
  - Ejer/admin: fuld adgang til administration, løn og drift

### Fil
| Fil | Handling |
|-----|---------|
| `src/pages/compliance/EmployeePrivacy.tsx` | Opdater 3 sektioner med konkret indhold |

