

# Fix Sparkline alignment, størrelse og UI-forbedringer

## Problemer fra screenshot
1. **Forskudte grafer** — Sparklines er ikke justeret fordi de er wrappet i en conditional (`weeklyData && ...`) med `flex-1`, så rækker uden data mangler elementet og hele layoutet rykker.
2. **For små** — SVG er kun 80×28px, fylder lidt i det store mellemrum.
3. **Gennemsnit er generelt** — `divisionAvg` beregnes allerede korrekt per division (linje 137-144 i ActiveSeasonBoard), men det ser ud til at det er det der bruges. Dobbelttjek at QualificationBoard gør det samme.

## Ændringer

### 1. `ProvisionSparkline.tsx` — Gør større
- Øg `md` størrelse fra 80×28 til **140×36** (næsten dobbelt bredde)
- Øg `sm` fra 48×16 til **100×28**
- Behold proportionel strokeWidth

### 2. `ActiveSeasonBoard.tsx` + `QualificationBoard.tsx` — Fix alignment
- **Fjern conditional rendering** af sparkline-wrapperen. Vis ALTID flex-1 div'en, men vis kun grafen indeni hvis data findes. Dette sikrer at alle rækker har samme layout-struktur og intet forskyder sig.
- Ændr fra:
  ```tsx
  {weeklyData && weeklyData.length > 0 && (
    <div className="hidden sm:flex flex-1 ...">
      <ProvisionSparkline ... />
    </div>
  )}
  ```
  Til:
  ```tsx
  <div className="hidden sm:flex flex-1 justify-center items-center min-w-[120px]">
    {weeklyData && weeklyData.length > 0 && (
      <ProvisionSparkline ... />
    )}
  </div>
  ```
- Øg `min-w` fra 90px til 120px

### 3. Divisionsgennemsnit — allerede korrekt
Koden beregner allerede gennemsnit per division (kun spillerne i gruppen). Ingen ændring nødvendig her.

### 4. Yderligere UI-forbedringer

**a) Smooth path i stedet for kantet polyline**
- Erstat `<polyline>` med en `<path>` der bruger cubic bezier curves (catmull-rom interpolation) for en blødere, mere professionel kurve.

**b) Hover-highlight af individuelle datapunkter**
- Tilføj usynlige hit-areas (større cirkler) på hvert datapunkt der viser en tooltip med den specifikke dags værdi ved hover, i stedet for at vise alle 7 dage på én gang.

**c) Relativ performance-indikator**
- Vis en lille tekst-label under grafen ("↑12% over gns." eller "↓8% under gns.") der sammenligner spillerens ugetotal med divisionens gennemsnit. Giver hurtigt overblik uden at klikke.

## Filer der ændres
| Fil | Ændring |
|-----|---------|
| `ProvisionSparkline.tsx` | Større SVG, smooth bezier path, hover-highlights per punkt, performance-label |
| `ActiveSeasonBoard.tsx` | Fix alignment (altid render flex-1 wrapper) |
| `QualificationBoard.tsx` | Fix alignment (altid render flex-1 wrapper) |

