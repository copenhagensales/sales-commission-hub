
# Plan: Ret TV Link mapping for United Dashboard

## Problem
Når du opretter et TV Link på United dashboard'et, vises TDC Erhverv dashboard i stedet for United dashboard. 

Dette skyldes at `TvBoardDirect.tsx` og `TvBoardView.tsx` har en hård-kodet mapping hvor "united" slug'en fejlagtigt peger på `TdcErhvervDashboard` komponenten.

## Løsning
Opdater begge TV Board filer til at importere og bruge `UnitedDashboard` komponenten for "united" slug'en.

## Tekniske ændringer

### 1. TvBoardDirect.tsx
- Tilføj import af `UnitedDashboard` fra `@/pages/UnitedDashboard`
- Ret mapping i `dashboardComponents` fra:
  ```typescript
  "united": TdcErhvervDashboard
  ```
  til:
  ```typescript
  "united": UnitedDashboard
  ```

### 2. TvBoardView.tsx  
- Tilføj import af `UnitedDashboard` fra `@/pages/UnitedDashboard`
- Ret samme mapping i `dashboardComponents`

## Påvirkede filer
- `src/pages/tv-board/TvBoardDirect.tsx` (2 ændringer: import + mapping)
- `src/pages/tv-board/TvBoardView.tsx` (2 ændringer: import + mapping)

## Test
Efter ændringen vil TV link med koden "8T9N" korrekt vise United dashboard i stedet for TDC Erhverv.
