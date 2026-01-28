
# Plan: Tilføj Feriepenge under Provisionsbeløb i HeroPerformanceCard

## Oversigt

Tilføj en diskret visning af **feriepenge** under hovedprovisionsbeløbet i Hero-kortet på forsiden. Baseret på brugerens `vacation_type` beregnes feriepenge som en procentdel af provisionen.

## Design

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│        ↗ 8.200 kr                                          │
│        provision denne periode                              │
│        + 1.025 kr feriepenge                    ← NY LINJE │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Feriepenge-linjen vises kun hvis medarbejderen har en `vacation_type` sat og beløbet er > 0.

## Feriepenge-beregning

Baseret på eksisterende logik fra `useSellerSalariesCached`:

| vacation_type | Beskrivelse | Rate |
|---------------|-------------|------|
| `vacation_pay` | Feriepenge medarbejder | 12.5% |
| `vacation_bonus` | Ferie med løn (betalt ferie) | 1% |
| `null` | Ingen feriepenge | 0% |

## Implementation

### 1. Udvid Employee Query i Home.tsx

Tilføj `vacation_type` til den eksisterende employee query:

```typescript
.select("id, first_name, last_name, job_title, team_id, employment_start_date, vacation_type")
```

### 2. Tilføj Props til HeroPerformanceCard

Tilføj `vacationPay` prop:

```typescript
interface HeroPerformanceCardProps {
  // ... eksisterende props
  vacationPay?: number;  // NY
}
```

### 3. Opdater HeroPerformanceCard UI

Under provisionsbeløbet, tilføj en diskret linje:

```tsx
{/* Commission stat */}
<div className="space-y-1">
  <div className="flex items-center justify-center md:justify-start gap-2">
    <TrendingUp className="w-5 h-5 text-primary" />
    <span className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
      {formatCommission(animatedCommission)} kr
    </span>
  </div>
  <p className="text-sm text-muted-foreground">
    provision denne periode
  </p>
  {/* NY: Feriepenge linje */}
  {vacationPay > 0 && (
    <p className="text-sm text-emerald-500/80">
      + {formatCommission(vacationPay)} kr feriepenge
    </p>
  )}
</div>
```

### 4. Beregn Feriepenge i Home.tsx

```typescript
// Vacation pay calculation (same logic as useSellerSalariesCached)
const vacationPayRate = useMemo(() => {
  if (!employee?.vacation_type) return 0;
  if (employee.vacation_type === 'vacation_pay') return 0.125; // 12.5%
  if (employee.vacation_type === 'vacation_bonus') return 0.01; // 1%
  return 0;
}, [employee?.vacation_type]);

const vacationPay = (personalStats?.periodCommission || 0) * vacationPayRate;
```

## Filer der ændres

| Fil | Handling |
|-----|----------|
| `src/pages/Home.tsx` | Tilføj `vacation_type` til query + beregn feriepenge |
| `src/components/home/HeroPerformanceCard.tsx` | Tilføj `vacationPay` prop og vis beløb |

## Resultat

Sælgeren ser nu:
- **Hovedprovision** (8.200 kr) i stor skrift
- **Feriepenge** (+ 1.025 kr) i mindre grøn tekst under provisionen
- Feriepenge vises kun hvis medarbejderen har en vacation_type og beløbet er > 0
