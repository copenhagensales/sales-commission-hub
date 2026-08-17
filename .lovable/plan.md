# Oliver får "Ingen internetforbindelse" ved login

## Hvad jeg har verificeret

- Olivers opsætning i databasen er korrekt og kan ikke være årsagen:
  - `employee_master_data`: én række (`80aac0dd…`), aktiv, `auth_user_id = 0f456e6c…`, work `olar@copenhagensales.dk`, privat `oliver@telekomplet.dk`. Ingen dubletter.
  - Auth-brugeren findes (`oliver@telekomplet.dk`), ikke spærret, sidste login i dag 05:49 UTC.
  - Ny stilling "Salgskonsulent (TDC ret salg)" → rollen `salgskonsulent_tdc_support` med 233 rettigheder (mod 232 på `medarbejder`).
  - `system_roles` for ham er sat til `medarbejder` — trigger `sync_system_role_from_job_title` har en ELSE-gren, så den ukendte rollenøgle giver ingen fejl. Ingen enum-fejl.
- Beskeden kommer fra to steder i koden, og **begge** afhænger udelukkende af browserens `navigator.onLine`:
  - `src/pages/Auth.tsx:398-406` — afbryder login og viser toast "Ingen internetforbindelse" før der overhovedet forsøges kontakt til serveren.
  - `src/components/RoleProtectedRoute.tsx:147, 188-200` — viser fuldskærms-blokering "Ingen internetforbindelse".

## Rod-årsag

Rollen er ikke problemet. `navigator.onLine === false` er den eneste betingelse for beskeden, og det flag er kendt upålideligt: VPN-klienter, virtuelle netværkskort, firmanetværk og visse browsere sætter det til `false` selvom maskinen har fuld adgang. Det forklarer også, at fejlen følger Oliver på tvæers af to browsere på samme maskine, mens alle andre brugere kommer ind.

Dette er en generel svaghed, ikke en enkeltsag: enhver bruger med samme netværksopsætning bliver låst ude af en frontend-antagelse frem for en reel fejl.

## Løsningen

`navigator.onLine` nedgraderes fra afgørelse til signal. Vi blokerer først, når et rigtigt netværkskald også fejler.

1. **Ny fil `src/lib/connectivity.ts`** med:
   - `browserReportsOffline()` — læser flaget.
   - `canReachBackend()` — kalder `/auth/v1/health` med 5s timeout.
   - `isReallyOffline()` — kun `true` hvis flaget siger offline **og** health-kaldet fejler.
2. **`src/pages/Auth.tsx`** — det tidlige `if (!navigator.onLine) return` erstattes af `await isReallyOffline()`. Hvis backend kan nås, fortsætter login som normalt (den eksisterende health-check og retry-logik er uændret).
3. **`src/components/RoleProtectedRoute.tsx`** — `isOffline` bliver en state, der sættes via `isReallyOffline()` i en effect. Startværdi `false`, så en falsk positiv aldrig blokerer siden. Auto-retry-logikken bruger samme værdi som i dag.

Ingen ændring af rettigheder, roller, RLS eller Olivers opsætning.

## Verifikation

1. Almindeligt login virker uændret (Playwright mod preview).
2. Med simuleret `navigator.onLine = false` og fungerende netværk: login gennemføres, ingen blokering.
3. Med reelt afbrudt netværk: beskeden vises stadig, med "Prøv igen".

## Zone

Rød zone (auth) — derfor plan først. Berører kun frontend-fejlhåndtering, ingen forretningslogik.
