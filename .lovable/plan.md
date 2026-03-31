

## Fix: Vis alle spillere i division (inkl. nr. 13-14)

Problemet er at rækkerne i divisions-visningen er for høje til at alle 14 spillere kan vises på skærmen uden scroll — og på et TV kan man ikke scrolle.

### Ændringer i `src/pages/tv-board/TvLeagueDashboard.tsx` — `SceneDivisions`

1. **Reducer row padding**: `py-1 2xl:py-1.5` → `py-0.5 2xl:py-1` på hver spiller-række
2. **Reducer spacing**: `space-y-0.5 2xl:space-y-1` → `space-y-px 2xl:space-y-0.5` mellem rækkerne
3. **Reducer header margin**: `mb-1 2xl:mb-2` → `mb-0.5 2xl:mb-1`
4. **Reducer legend margin**: `mt-1 2xl:mt-2` → `mt-0.5 2xl:mt-1`

Dette sparer ca. 50-70px i højden, nok til at alle 14 spillere passer på skærmen.

