# Adgang til "Bulk Salg (Leder)" for Filip Kirketerp Møller

## Nuværende tilstand (verificeret)

- UI-fanen er kun synlig for ejer: `src/pages/TastSelvSalg.tsx` linje 158-212 bruger `isOwner` (`role === 'ejer'`, `useUnifiedPermissions.ts:167`).
- Backend `bulk_import` i `supabase/functions/manual-sales/index.ts:207` kræver `isManager`, som via `is_manager_or_above` → `is_teamleder_or_above` gælder ALLE teamledere. Backend er altså i dag bredere end UI.
- Filip findes som én aktiv medarbejder (Teamleder), `work_email = fk@copenhagensales.dk`, `private_email = filipkirketerp@gmail.com`. Der findes kun én loginkonto, på gmail-adressen — copenhagensales-adressen har ingen auth-konto endnu.

## Hvad der bygges

1. Indfør en eksplicit allowlist for bulk-import med begge Filips adresser (`fk@copenhagensales.dk` og `filipkirketerp@gmail.com`), så adgang virker uanset hvilken af de to konti han logger ind med — også hvis der senere oprettes login på arbejdsmailen.
2. UI: vis "Bulk Salg (Leder)"-fanen når brugeren er ejer **eller** står på allowlisten (match på login-email samt `work_email`/`private_email` i lowercase).
3. Backend: stram `bulk_import` fra "alle teamledere" til "ejer eller allowlist", så backend ikke er bredere end UI. Allowlisten defineres ét sted, delt logik i edge function.

## Teknisk

- Ny konstant, fx `BULK_SALES_EMAILS`, i frontend (`src/config/`) og en tilsvarende i `supabase/functions/manual-sales/index.ts` (edge functions kan ikke importere fra `src/`).
- Frontend-check: `isOwner || allow(email)` hvor email hentes fra auth-session samt medarbejderens work/private email.
- Backend-check i `bulk_import`: ejer-rolle (`get_user_role`/`is_owner`) eller allowlist på `work_email`/`private_email`/token-email; ellers 403 med uændret fejltekst.
- Ingen ændring i selve import-, dublet- eller navnematch-logikken.

## Zone

`TastSelvSalg.tsx` (gul) + `manual-sales` edge function-adgangskontrol (rød: auth/adgang). Kræver din godkendelse før implementering.
