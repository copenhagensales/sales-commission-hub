

# Ret divisionsnavne og zone-regler på TV Dashboard

## Problemer
1. **Forkerte divisionsnavne**: TV dashboard viser "Division 1", "Division 2" osv. De korrekte navne (som brugt i resten af systemet) er:
   - Division 1 → **Superligaen**
   - Division 2 → **1. Division**
   - Division 3 → **2. Division** (osv: `division - 1`. Division)

2. **Forkerte zone-grænser**: Edge function bruger `playersPerDivision - 3` / `playersPerDivision - 1` for playoff/relegation. De korrekte regler (fra QualificationBoard/ActiveSeasonBoard) er:
   - Playoff ned: rank = `playersPerDivision - 3` eller `playersPerDivision - 4` (altså plads 11-12 ved 14 spillere)
   - Relegation: rank ≥ `playersPerDivision - 2` (altså plads 13-14 ved 14 spillere) — kun hvis **ikke** bund-division

3. **Manglende zone-badges**: Nuværende TV dashboard viser kun farvet border, men ikke tekst-badges ("Oprykker", "Playoff", "Nedrykker") som det eksisterende setup har.

## Ændringer

### 1. `supabase/functions/tv-league-data/index.ts`
- Ret zone-beregning til at matche de eksisterende boards:
  - `playoff`: rank 4-5 (ikke top div) ELLER rank `playersPerDivision - 4` / `playersPerDivision - 3`
  - `relegation`: rank ≥ `playersPerDivision - 2` (ikke bund div)

### 2. `src/pages/tv-board/TvLeagueDashboard.tsx`
- **Divisionsnavne**: Erstat "Division {n}" med korrekt navngivning:
  - Division 1 → "Superligaen" (med Trophy-ikon)
  - Division 2+ → "{n-1}. Division"
- **Zone-badges**: Tilføj tekst-badges i højre side af hver spiller-række:
  - Grøn "Oprykker" badge (promotion zone, ikke top div)
  - Gul "Top 3" badge (top zone, kun top div)
  - Orange "Playoff" badge (playoff zone)
  - Rød "Nedrykker" badge (relegation zone)
- Match styling fra eksisterende boards (halvgennemsigtige baggrunde, farvede tekst)

| Fil | Handling |
|-----|---------|
| `supabase/functions/tv-league-data/index.ts` | Ret playoff zone-grænser |
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Ret divisionsnavne + tilføj zone-badges |

