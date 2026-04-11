

## Fix: Ghost procent viser 0% fordi status-værdien er forkert

### Problem
Koden filtrerer på `status === "ghosted"` (engelsk), men i databasen hedder værdien `"ghostet"` (dansk). Der er 33 kandidater med status `ghostet` i databasen, men ingen med `ghosted` — derfor viser KPI'en altid 0%.

### Løsning
Ændre alle `"ghosted"` status-checks i `RecruitmentDashboard.tsx` til `"ghostet"`.

### Fil
| Fil | Ændring |
|-----|---------|
| `src/pages/recruitment/RecruitmentDashboard.tsx` | Erstat `"ghosted"` med `"ghostet"` i filter-kald og funnel-order (linje 107, 117, 125) |

