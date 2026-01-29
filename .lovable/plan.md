
# Lønperiode som standard på Fieldmarketing Dashboard

## Opsummering
Ændrer Fieldmarketing Dashboard så "Periodens sælgere" som standard viser data for lønperioden (15. til 14. i måneden) og omdøbes til "Lønperiode". Når brugeren manuelt vælger en dato via datovælgeren, skifter titlen til "Valgt periode".

## Ændringer

### 1. FieldmarketingDashboardFull.tsx

**Opdater standard dateRange til lønperiode:**

```typescript
// Tilføj import af getPayrollPeriod logik (eller genimplementer inline)
function getPayrollPeriod(baseDate: Date): { start: Date; end: Date } {
  const day = baseDate.getDate();
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  
  if (day >= 15) {
    return {
      start: new Date(year, month, 15),
      end: new Date(year, month + 1, 14, 23, 59, 59),
    };
  } else {
    return {
      start: new Date(year, month - 1, 15),
      end: new Date(year, month, 14, 23, 59, 59),
    };
  }
}
```

**Opdater useState til at bruge lønperiode:**

```typescript
// Før
const [dateRange, setDateRange] = useState<DateRange | undefined>({
  from: startOfMonth(new Date()),
  to: new Date(),
});

// Efter
const defaultPayrollPeriod = getPayrollPeriod(new Date());
const [dateRange, setDateRange] = useState<DateRange | undefined>({
  from: defaultPayrollPeriod.start,
  to: defaultPayrollPeriod.end,
});

// Track om brugeren har valgt en custom periode
const [isCustomRange, setIsCustomRange] = useState(false);
```

**Opdater onDateRangeChange handler:**

```typescript
const handleDateRangeChange = (range: DateRange | undefined) => {
  setDateRange(range);
  setIsCustomRange(true);
};
```

**Send isCustomRange videre til ClientDashboard:**

```typescript
<ClientDashboard 
  clientId={TAB_TO_CLIENT_ID[tab.value]} 
  clientName={tab.label}
  dateRange={dateRange}
  isPayrollPeriod={!isCustomRange}
/>
```

### 2. ClientDashboard komponent

**Opdater props interface:**

```typescript
interface ClientDashboardProps {
  clientId: string;
  clientName: string;
  dateRange: DateRange | undefined;
  isPayrollPeriod: boolean;
}
```

**Opdater CardTitle dynamisk:**

```typescript
<CardHeader className="flex flex-row items-center gap-2">
  <Users className="h-5 w-5 text-primary" />
  <CardTitle className="text-lg">
    {isPayrollPeriod ? "Lønperiode" : "Valgt periode"}
  </CardTitle>
</CardHeader>
```

### 3. DashboardDateRangePicker (valgfrit)

Tilføj "Lønperiode" som preset i dropdown:

```typescript
const presets = [
  { label: "Lønperiode", getValue: () => {
    const period = getPayrollPeriod(new Date());
    return { from: period.start, to: period.end };
  }},
  { label: "I dag", getValue: () => ({ from: startOfDay(new Date()), to: new Date() }) },
  // ... resten af presets
];
```

## Teknisk detalje

Lønperioden beregnes således:
- Hvis vi er **på eller efter den 15.** i måneden: perioden er 15. denne måned → 14. næste måned
- Hvis vi er **før den 15.** i måneden: perioden er 15. forrige måned → 14. denne måned

Eksempel (29. januar 2026):
- Lønperiode = 15. jan. 2026 → 14. feb. 2026

## Fil-ændringer

| Fil | Ændring |
|-----|---------|
| `src/pages/dashboards/FieldmarketingDashboardFull.tsx` | Tilføj `getPayrollPeriod`, opdater default state, tilføj `isCustomRange` tracking, opdater props |
| `src/components/dashboard/DashboardDateRangePicker.tsx` | Tilføj "Lønperiode" preset (valgfrit) |

## Resultat

1. Dashboard åbner med lønperioden (15.-14.) som default
2. Tabeltitel viser "Lønperiode" ved default
3. Når brugeren vælger en custom dato, skifter titlen til "Valgt periode"
4. Datovælgeren viser den korrekte lønperiode-range i knappen
