

## Problem

Billedet viser at CS Top 20 kun viser ca. 8 entries per kolonne — rækkerne er stadig for store til at 20 entries kan passe. Avatars, padding og tekst skal yderligere reduceres.

## Ændringer i `src/pages/CsTop20Dashboard.tsx`

1. **Endnu mere kompakte rækker i TV-mode**:
   - Row padding: `px-3 py-1.5` → `px-2 py-[3px]`
   - Avatar: `h-7 w-7` → `h-5 w-5`
   - Navn: `text-sm` → `text-xs`
   - Commission badge: `text-sm px-2 py-1` → `text-xs px-1.5 py-0.5`
   - Rank width: `w-8` → `w-5`
   - Rank emoji: `text-base` → `text-xs`
   - Rank number: `text-sm` → `text-[10px]`
   - Salg-tekst: `text-[10px]` → `text-[8px]`
   - Team badge: `text-[9px]` → `text-[7px]`, padding `px-1` → `px-0.5`
   - Avatar fallback: `text-sm` → `text-[8px]`
   - Gap mellem elementer: `gap-2` → `gap-1.5`

2. **Reducer header**: Card header padding `pb-2 pt-3` → `pb-1 pt-2`, titel `text-base` → `text-sm`, ikon `h-4 w-4` → `h-3 w-3`

3. **Reducer top-header**: `text-2xl` → `text-lg`, `mb-3` → `mb-1`

4. **Reducer grid gap**: `gap-4` → `gap-2`

5. **Reducer container padding**: `p-4` → `p-2`

Dette burde give plads til ca. 18-20 entries per kolonne.

