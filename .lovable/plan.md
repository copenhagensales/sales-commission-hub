
# Plan: Tilføj understøttelse af månedsløn for assistenter

## Problembeskrivelse

Johannes Hedebrink har en månedsløn på 40.000 kr, men `useAssistantHoursCalculation` behandler alle værdier som timelønninger. Dette betyder at hans løn beregnes forkert (40.000 kr × timer = astronomisk beløb).

## Løsning

Tilføj samme logik som `useStaffHoursCalculation` bruger - med en tærskelværdi på 1.000 kr til at skelne mellem timeløn og månedsløn. For månedslønnede prorateres lønnen baseret på arbejdsdage i perioden.

## Ændringer i useAssistantHoursCalculation.ts

### 1. Tilføj imports og konstant

```typescript
import { startOfMonth, endOfMonth } from "date-fns";
import { countWorkDaysInPeriod } from "@/lib/calculations";

const HOURLY_RATE_THRESHOLD = 1000; // Under dette = timeløn, over = månedsløn
```

### 2. Udvid interface

```typescript
interface AssistantHoursData {
  employeeId: string;
  hourlyRate: number;
  workedHours: number;
  baseSalary: number;
  vacationPay: number;
  totalSalary: number;
  isHourlyBased: boolean; // NY: true = timeløn, false = månedsløn
}
```

### 3. Tilføj logik til at skelne løntyper

For hver assistent:

```typescript
const monthlySalary = Number(salary?.monthly_salary) || 0;
const hourlyRate = Number(salary?.hourly_rate) || 0;

// Brug hourly_rate hvis sat, ellers tjek om monthly_salary er lav (timeløn)
const effectiveHourlyRate = hourlyRate > 0 
  ? hourlyRate 
  : (monthlySalary < HOURLY_RATE_THRESHOLD ? monthlySalary : 0);
const isHourlyBased = effectiveHourlyRate > 0;
```

### 4. Håndter månedslønnede separat

```typescript
if (!isHourlyBased) {
  // Proratér månedsløn baseret på arbejdsdage
  const monthStart = startOfMonth(periodStart);
  const monthEnd = endOfMonth(periodStart);
  
  const workdaysInPeriod = countWorkDaysInPeriod(periodStart, periodEnd);
  const workdaysInMonth = countWorkDaysInPeriod(monthStart, monthEnd);
  
  const prorationFactor = workdaysInMonth > 0 
    ? workdaysInPeriod / workdaysInMonth 
    : 1;
  const baseSalary = Math.round(monthlySalary * prorationFactor * 100) / 100;
  const vacationPay = baseSalary * VACATION_PAY_RATES.ASSISTANT;
  
  result[assistantId] = {
    employeeId: assistantId,
    hourlyRate: 0,
    workedHours: workdaysInPeriod, // Viser arbejdsdage for klarhed
    baseSalary,
    vacationPay,
    totalSalary: baseSalary + vacationPay,
    isHourlyBased: false,
  };
  continue;
}
// ... resten af time-baseret beregning
```

---

## Eksempel på beregning for Johannes (40.000 kr/md)

| Periode | Arbejdsdage i periode | Arbejdsdage i måneden | Proratering | Basisløn | Feriepenge (12,5%) | Total |
|---------|----------------------|----------------------|-------------|----------|-------------------|-------|
| 1 dag   | 1                    | 20                   | 1/20        | 2.000 kr | 250 kr            | 2.250 kr |
| 1 uge   | 5                    | 20                   | 5/20        | 10.000 kr| 1.250 kr          | 11.250 kr |
| Hel md  | 20                   | 20                   | 20/20       | 40.000 kr| 5.000 kr          | 45.000 kr |

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/hooks/useAssistantHoursCalculation.ts` | Tilføj understøttelse af månedsløn med proratering |

## Forventet resultat

- Jeppe Munk (timeløn 180 kr) beregnes som hidtil: timer × 180 kr × 1,125
- Johannes Hedebrink (månedsløn 40.000 kr) prorateres korrekt baseret på arbejdsdage
- Begges løn indgår i TDC Erhvervs assistentomkostninger
