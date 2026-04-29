# Slet Some-modulet komplet

"Some" (social media planning) bruges ikke længere. Fjernes fra UI, kode, ruter, permissions og database. **Ekstraarbejde bevares** (det er et selvstændigt menupunkt der i dag ligger under samme section).

## Hvad sker der i menuen

I dag ser sidebar-sektionen "Some" sådan ud:
```text
Some (section)
├── SOME          ← slettes
└── Ekstraarbejde ← bevares
```

Efter ændringen flyttes "Ekstraarbejde" op som selvstændig sektion (eller ind under en eksisterende sektion — se spørgsmål nederst). Hele "Some"-section forsvinder ellers.

## Database (migration)

Drop 2 tabeller — kun brugt af Some-siden:
- `some_weekly_metrics`
- `some_default_goals`

Slet 3 rækker fra `sidebar_menu_config`:
- `section_some` (sektion) → erstattes med ny placering for Ekstraarbejde
- `item_some` → slettes helt
- `item_extra_work` → re-parenter (ny placering, se spørgsmål)

## Kode-ændringer

**Slet filer:**
- `src/pages/Some.tsx`
- `src/hooks/useSomeContent.ts`
- `src/hooks/useSomeMetrics.ts`
- Hele mappen `src/components/some/` (12 filer)

**Rediger:**
- `src/routes/pages.ts` — fjern `Some` lazy export (linje 81)
- `src/routes/config.tsx` — fjern import (linje 65) og rute `/some` (linje 190)
- `src/config/permissionKeys.ts` — fjern `menu_some`, `tab_some_overview`, `tab_some_content`, `tab_some_goals` (linje 95, 100-102)
- `src/config/permissions.ts` — fjern `/some`-page (linje 948) og `tab_some_content` (linje 147)

## Permissions/RLS

Når permission-keys fjernes fra `permissionKeys.ts` håndterer det auto-healing system selv oprydning af forældede rækker i `role_page_permissions`. Ingen manuel SQL nødvendig der.

## Konsekvensanalyse

- Eventuel data i `some_weekly_metrics` / `some_default_goals` mistes permanent. Bekræftes af brugerens "bruges ikke mere".
- Ingen andre filer/RPC'er/edge functions refererer til Some — verificeret med ripgrep.
- `src/integrations/supabase/types.ts` regenereres automatisk efter migration.
- Ekstraarbejde-modulet (siden, hooks, komponenter) røres ikke.

## Spørgsmål før jeg går i gang

**Hvor skal "Ekstraarbejde" hen i sidebaren** når sektionen "Some" forsvinder?
1. Egen ny sektion "Ekstraarbejde" (top-level)
2. Ind under "Personale"
3. Ind under "Løn" / anden eksisterende sektion (sig hvilken)
4. Slet også Ekstraarbejde

Sig hvilken, så implementerer jeg.
