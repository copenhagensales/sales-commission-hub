

## Fix: SØG-knap ikke synlig på bærbare computere

### Problem
Filter-panelet (Sheet) i Dagsrapporter har 7 dropdown-filtre stacked vertikalt. På bærbare med lavere skærmhøjde (typisk 768px-900px) overflower indholdet, og "SØG"-knappen i bunden bliver skubbet ud af viewporten. Brugerne kan ikke scrolle ned til den.

### Årsag
Filter-containeren (`flex-1 space-y-4` på linje 1120) har ingen `overflow-y-auto`, så den vokser ud over skærmhøjden i stedet for at blive scrollbar. SØG-knappen sidder i en separat `div` i bunden, men den bliver usynlig fordi flex-containeren aldrig begrænser sin højde.

### Løsning
Tilføj `overflow-y-auto` på filter-containeren, så filtrene kan scrolles mens SØG-knappen forbliver fast i bunden af panelet.

### Teknisk ændring

**Fil:** `src/pages/reports/DailyReports.tsx`

**Linje 1120** -- Tilføj scroll til filter-containeren:

```
// Fra:
<div className="flex-1 space-y-4">

// Til:
<div className="flex-1 space-y-4 overflow-y-auto">
```

Det er en ét-linje ændring. `flex-1` giver allerede containeren en bounded height inden for `h-full` flex-parent, og `overflow-y-auto` aktiverer scroll når indholdet overskrider den tilgængelige plads. SØG-knappen i `pt-6 border-t` div'en forbliver fast i bunden.

### Filer der ændres

| Fil | Ændring |
|---|---|
| `src/pages/reports/DailyReports.tsx` | Tilføj `overflow-y-auto` på filter-container (linje 1120) |

