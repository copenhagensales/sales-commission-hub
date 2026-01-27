
# Plan: Personlig Anerkendelser-sektion

## Oversigt
Ændrer "Anerkendelser" sektionen på home-siden fra at vise globale top-performere til at vise **brugerens egne personlige stats**:

**Denne uge:**
- Din bedste dag (hvilken dag + beløb)
- Tjent denne uge (total så langt)

**Sidste uge:**
- Din bedste dag (hvilken dag + beløb)
- Tjent sidste uge (total)

## Datakilder

### Eksisterende data (kan genbruges)
| Metric | Kilde | Status |
|--------|-------|--------|
| `total_commission` (payroll) | `kpi_cached_values` med `scope_type=employee` | ✅ Findes |
| `total_commission` (today) | `kpi_cached_values` med `scope_type=employee` | ✅ Findes |

### Manglende data (skal beregnes live)
| Metric | Problem | Løsning |
|--------|---------|---------|
| `total_commission` (this_week) | Findes ikke i cache | Beregn fra `sale_items` |
| `best_day_this_week` | Findes ikke | Beregn fra `sale_items` |
| Samme for last_week | Findes ikke | Beregn fra `sale_items` |

**Bemærk**: Da `this_week` ikke findes i cachen, henter vi data direkte fra `sale_items` - dette virker pga. RLS bypass via `SECURITY DEFINER` funktionen.

## Implementering

### Trin 1: Nyt hook `usePersonalWeeklyStats`
Opretter et dedikeret hook der henter brugerens egen uge-data:

```typescript
// src/hooks/usePersonalWeeklyStats.ts

interface PersonalWeekStats {
  weekTotal: number;         // Total tjent i ugen
  bestDay: {
    date: string;            // YYYY-MM-DD
    commission: number;      // Beløb på bedste dag
  } | null;
}

interface PersonalWeeklyData {
  currentWeek: PersonalWeekStats;
  lastWeek: PersonalWeekStats;
}

export function usePersonalWeeklyStats(employeeId: string | null) {
  return useQuery({
    queryKey: ["personal-weekly-stats", employeeId],
    queryFn: async (): Promise<PersonalWeeklyData> => {
      // 1. Hent brugerens agent emails fra employee_agent_mapping
      // 2. Query sale_items for denne uge + sidste uge
      // 3. Aggreger:
      //    - weekTotal = SUM(mapped_commission)
      //    - bestDay = MAX per dato
      // 4. Returner struktureret data
    },
    enabled: !!employeeId,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
```

**Logik flow:**
1. Hent brugerens `agent_id`(s) via `employee_agent_mapping`
2. Hent tilhørende agent emails fra `agents` tabellen
3. Query `sale_items` joinede med `sales` for perioden
4. Filtrer på brugerens agent emails
5. Aggreger per dag og find bedste + total

### Trin 2: Ny komponent `PersonalRecognitions`
Erstatter `TabbedRecognitions` med en personlig version:

```typescript
// src/components/home/PersonalRecognitions.tsx

interface PersonalRecognitionsProps {
  currentWeek: PersonalWeekStats;
  lastWeek: PersonalWeekStats;
}

export function PersonalRecognitions({ currentWeek, lastWeek }: PersonalRecognitionsProps) {
  // Samme tab-struktur som før
  // Men nu med personlige labels:
  // - "Din bedste dag" i stedet for "Bedste dag"
  // - "Tjent denne uge" i stedet for "Top medarbejder"
}
```

**UI ændringer:**

| Før (global) | Efter (personlig) |
|--------------|-------------------|
| "Top medarbejder" med navn | "Tjent denne uge" med beløb |
| "Bedste dag" med andens navn | "Din bedste dag" med dato |

### Trin 3: Opdater Home.tsx
Integrerer det nye hook og komponent:

```typescript
// src/pages/Home.tsx

// Erstat:
const { data: weeklyRecognition } = useRecognitionKpis();

// Med:
const { data: personalStats } = usePersonalWeeklyStats(employee?.id);

// Og opdater komponenten:
<PersonalRecognitions
  currentWeek={personalStats?.currentWeek || { weekTotal: 0, bestDay: null }}
  lastWeek={personalStats?.lastWeek || { weekTotal: 0, bestDay: null }}
/>
```

## Tekniske detaljer

### Query for personlige stats
```sql
-- Pseudokode for hvad hooket gør:

-- Trin 1: Find brugerens agent emails
SELECT a.email 
FROM employee_agent_mapping eam
JOIN agents a ON eam.agent_id = a.id
WHERE eam.employee_id = :employeeId;

-- Trin 2: Hent salg for perioden
SELECT 
  DATE(s.sale_datetime) as sale_date,
  SUM(si.mapped_commission) as daily_total
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE s.agent_email IN (:userEmails)
  AND s.sale_datetime BETWEEN :weekStart AND :weekEnd
  AND s.status = 'approved'
GROUP BY DATE(s.sale_datetime);
```

### Dato-beregninger
- **Denne uge**: `startOfWeek(now, { weekStartsOn: 1 })` til `endOfWeek(now, { weekStartsOn: 1 })`
- **Sidste uge**: `subWeeks()` på ovenstående

### UI Design
Beholder samme visuelle stil som eksisterende `TabbedRecognitions`:
- Samme card layout med tabs
- Samme ikoner (Zap, Sparkles, etc.)
- Samme farveskema per tab
- Fjerner team badge (ikke relevant for egne stats)
- Viser dato i dansk format for "bedste dag"

## Filændringer

| Fil | Handling |
|-----|----------|
| `src/hooks/usePersonalWeeklyStats.ts` | **NY** - Hook til personlige uge-stats |
| `src/components/home/PersonalRecognitions.tsx` | **NY** - Personlig version af kortet |
| `src/pages/Home.tsx` | **ÆNDRING** - Brug nyt hook og komponent |
| `src/hooks/useRecognitionKpis.ts` | Uændret (kan stadig bruges andre steder) |
| `src/components/home/TabbedRecognitions.tsx` | Uændret (kan slettes senere hvis ikke brugt) |

## Forventet resultat

**Denne uge fane:**
```
┌─────────────────────────────────────┐
│ ⭐ Anerkendelser                    │
│ [Denne uge] [Sidste uge]            │
├─────────────────────────────────────┤
│ ⚡ TJENT DENNE UGE    ✨ DIN BEDSTE │
│    4.225 kr              DAG        │
│                         Tirsdag     │
│                         1.850 kr    │
└─────────────────────────────────────┘
```

**Sidste uge fane:**
```
┌─────────────────────────────────────┐
│ 🏆 TJENT SIDSTE UGE   📅 DIN BEDSTE │
│    8.450 kr              DAG        │
│                         Torsdag     │
│                         2.100 kr    │
└─────────────────────────────────────┘
```
