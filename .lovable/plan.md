## Rod-årsag

August P. og en anden sælger har fiber-salg men ingen "almindelige" salg i dag. De findes derfor ikke i `cachedSellersToday` (cached leaderboard filtrerer på `counts_as_sale`). `mergeFiber` i `ClientDashboard.tsx` tilføjer dem som "orphan"-rækker, men sætter `name` og `displayName` = employee_id UUID fordi hook'en kun returnerer id + tal.

August P. rammer sandsynligvis mapping (email → employee_id), mens den anden ikke har mapping → nøglen bliver rå email. UUID-rækken viser en mappet employee vi ikke har navn på.

## Fix

Berig `useFiberBoardStats` så den også returnerer sælgerens navn og avatar:

1. Efter aggregering: saml alle employee_id UUIDs fra resultatet.
2. Slå dem op i `employee_master_data` (`id, first_name, last_name, avatar_url`).
3. Udvid `FiberEmployeeStats` med `name?: string` og `avatarUrl?: string | null`.
4. For nøgler der er en email (ingen mapping): brug email-prefixet som fallback-navn (samme mønster som `useSalesAggregatesExtended`).

Opdatér `mergeFiber` i `ClientDashboard.tsx` til at bruge `f.name` / `f.avatarUrl` når orphan-række tilføjes, og også opdatere navn/avatar på eksisterende rækker hvis de mangler.

## Filer

- `src/hooks/useFiberBoardStats.ts` (udvid returtype + lookup)
- `src/components/dashboard/ClientDashboard.tsx` (brug navn/avatar i mergeFiber)

Ingen DB-ændring. Gul zone.
