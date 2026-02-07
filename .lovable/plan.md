

# UI Forbedring: Tabel-kolonne Alignment i DB per Klient

## Problem

Tabellen har følgende layoutproblemer:
1. **Kolonnebredder er ikke konsistente** - data og headers flugter ikke
2. **Expand-knap tager plads** men er ikke synkroniseret med kolonnebredder
3. **Progress-bar og DB%** har forskellige bredder per række
4. **Manglende faste kolonnebredder** - tabellen justerer dynamisk baseret på indhold

## Løsning

Tilføj eksplicitte kolonnebredder til tabellen så alt flugter korrekt:

### Ændringer i ClientDBTab.tsx (TableHeader)

| Kolonne | Nuværende | Ny bredde |
|---------|-----------|-----------|
| Expand-knap | `w-8` | `w-10` (fast) |
| Klient | Auto | `min-w-[140px]` |
| Team | Auto | `min-w-[100px]` |
| Salg | Auto | `w-[70px] text-right` |
| Omsætning | Auto | `w-[120px] text-right` |
| Omkostninger | Auto | `w-[120px] text-right` |
| Final DB | Auto | `w-[110px] text-right` |
| DB% | Auto | `w-[140px]` |
| Actions | `w-10` | `w-12` (fast) |

### Ændringer i ClientDBExpandableRow.tsx

Matcher kolonnebredder fra header:

```tsx
// Expand button
<TableCell className="w-10 p-2">

// Client name
<TableCell className="font-medium min-w-[140px]">

// Team
<TableCell className="text-muted-foreground text-sm min-w-[100px]">

// Sales
<TableCell className="text-right tabular-nums w-[70px]">

// Revenue
<TableCell className="text-right w-[120px]">

// Costs
<TableCell className="text-right text-destructive tabular-nums w-[120px]">

// Final DB
<TableCell className="text-right font-semibold tabular-nums w-[110px]">

// DB% with progress
<TableCell className="w-[140px]">

// Actions
<TableCell className="w-12">
```

### Ekstra forbedringer

1. **Tilføj `table-fixed` layout** til Table-komponenten for at håndhæve faste kolonnebredder
2. **Konsistent padding** på alle celler
3. **Bedre DB% layout** med fast bredde på progress-bar container

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/salary/ClientDBTab.tsx` | Opdater TableHeader med faste bredder |
| `src/components/salary/ClientDBExpandableRow.tsx` | Match kolonnebredder fra header |

## Forventet resultat

- Alle kolonner flugter perfekt mellem header og data-rækker
- Ensartet udseende uanset indholdsbredde
- Professionelt og overskueligt tabel-layout

