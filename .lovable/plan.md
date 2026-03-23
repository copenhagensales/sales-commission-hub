

# Fix: Tillad fjernelse af stab-medarbejdere fra teams

## Problem
Fjern-knappen (X) vises kun når en medarbejder er på **præcis 1 team** (`getEmployeeTeamCount(emp.id) === 1`). Thomas Wehage er stab-medarbejder og er på flere teams, så knappen skjules.

For ikke-stab medarbejdere giver reglen mening (de bør flyttes i stedet for fjernes), men stab-medarbejdere skal frit kunne fjernes fra individuelle teams.

## Ændring

### `src/components/employees/TeamsTab.tsx` — linje 1393
Udvid betingelsen så X-knappen også vises for stab-medarbejdere:

```typescript
// Fra:
{getEmployeeTeamCount(emp.id) === 1 && editingTeam && (

// Til:
{(getEmployeeTeamCount(emp.id) === 1 || emp.is_staff_employee) && editingTeam && (
```

| Fil | Ændring |
|-----|---------|
| `src/components/employees/TeamsTab.tsx` | Linje 1393: vis fjern-knap for stab-medarbejdere uanset antal teams |

