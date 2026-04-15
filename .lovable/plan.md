
# CS Top 20 fejler efter 10–20 min — sandsynlig årsag og fix

## Hvad der sandsynligvis sker
CS Top 20 i TV-mode bruger to forskellige datakilder:

1. `useCachedLeaderboards()` fra `kpi_leaderboard_cache`
2. fallback til edge-funktionen `tv-dashboard-data?action=cs-top-20-data`

De to kilder returnerer ikke samme shape:

```text
Cache:
employeeName, displayName, salesCount, commission, avatarUrl, teamName

Fallback:
name, sales, commission, avatarUrl, employeeId, goalTarget, teamName
```

UI’en i `CsTop20Dashboard.tsx` forventer cache-shape hele tiden og kalder bl.a.:

```text
const name = seller.employeeName
getInitials(name) -> name.split(" ")
```

Når cache-data midlertidigt bliver tomt/fejler, slår siden over på fallback-data. Der mangler `employeeName`, så render crasher. Det forklarer godt hvorfor:

- den virker i starten
- den bryder efter noget tid
- Superliga Live ikke har samme problem, fordi den bruger en dedikeret TV-datakilde med konsistent payload

## Plan
### 1. Gør TV-mode i CS Top 20 datakonsistent
Opdater `src/pages/CsTop20Dashboard.tsx` så TV-mode aldrig renderer rå fallback-data direkte.

- Lav en normalizer der mapper edge-function resultater til `LeaderboardEntry`
- Map fx:
  - `name -> employeeName`
  - `name -> displayName` (eller formatteret navn)
  - `sales -> salesCount`

### 2. Brug den robuste TV-kilde som primær kilde
For `/t/...` bør CS Top 20 hente TV-data på samme robuste måde som de dashboards der kører stabilt længe.

- Brug edge-function fetch som primær kilde i TV-mode
- Send publishable key/anon auth headers eksplicit, samme mønster som TV League
- Behold cache som sekundær fallback eller fjern dobbeltkilde helt i TV-mode

Det gør TV-boardet mindre afhængigt af browserens auth-/sessiontilstand over tid.

### 3. Hardening i UI så én dårlig række ikke kan vælte hele boardet
Opdater render-logikken i `CsTop20Dashboard.tsx`:

- brug sikker navne-fallback:
  - `seller.displayName || seller.employeeName || "Ukendt"`
- gør `getInitials` tolerant over for tomme/undefined navne
- undgå at avatar/navn-render kan kaste runtime errors

### 4. Brug TV refresh-profil i stedet for dashboard-profil
TV-mode skal bruge TV-refresh-konfiguration, ikke standard dashboard-refresh.

- skift TV-queries i CS Top 20 fra `REFRESH_PROFILES.dashboard` til `REFRESH_PROFILES.tv`

Det matcher resten af TV-arkitekturen bedre.

## Filer der skal opdateres
- `src/pages/CsTop20Dashboard.tsx`
- evt. `src/hooks/useCachedLeaderboard.ts` hvis vi vil dele normalisering/sikre typer
- evt. lille helper til safe initials, hvis det skal centraliseres

## Teknisk note
Den vigtigste konkrete fejl er kontrakt-brud mellem cache-data og fallback-data. Det er den slags fejl der ofte først viser sig efter noget tid, fordi fallback-path først bliver brugt ved cache-miss, transient fejl eller refresh-problemer.

```text
Cache virker -> board virker
Cache bliver tom/fejler kortvarigt -> fallback aktiveres
Fallback har forkert shape -> render crash
```

## QA efter implementering
- Test `/t/5G2T` direkte
- Lad boardet stå åbent i mindst 20–30 minutter
- Verificér at det overlever flere refresh-cyklusser
- Bekræft at både cache-path og fallback-path renderer korrekt
- Tjek at der ikke længere kommer console-fejl fra `employeeName`, `displayName` eller `split()`
