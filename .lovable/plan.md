

## Fjern dobbelt adgangstjek på Fieldmarketing Dashboard

### Hvad bliver ændret
En enkelt fil ændres: `src/pages/dashboards/FieldmarketingDashboardFull.tsx`

Det dobbelte adgangstjek fjernes, så kun team-adgangen (via `useRequireDashboardAccess`) bestemmer om en bruger kan se dashboardet. Når de har adgang, ser de alle tabs.

### Ændringer i detaljer

1. **Fjern `useUnifiedPermissions`** -- import og kald (linje 47 og 398) slettes, da `canView` ikke længere bruges til tab-filtrering
2. **Fjern `visibleTabs`** -- hele useMemo-blokken (linje 461-465) slettes
3. **Fjern "ingen adgang"-blokken** -- linje 500-508 slettes (den der viser "Du har ikke adgang" når visibleTabs er tom)
4. **Fjern `permissionsLoading`** fra loading-tjekket (linje 485) -- kun `accessLoading` beholdes
5. **Erstat alle `visibleTabs` med `allTabs`** i:
   - `defaultTab` (linje 467)
   - `gridColsClass` (linje 520)
   - TabsList-rendering (linje 554)
   - TabsContent-rendering (linje 561)

### Resultat
Enhver bruger med team-baseret adgang til "fieldmarketing"-dashboardet vil automatisk se begge tabs (Eesy FM og Yousee) uden yderligere rettighedstjek.
