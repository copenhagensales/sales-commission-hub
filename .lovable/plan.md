# Afgræns "TDC Erhverv - ret salg" til navngivne personer

Målet: kun ejere, Rasmus Emil Hansen, Johannes Hedebrink og Oliver Gonsalves må se og rette på fanen — både i menuen og i databasen.

## Nuværende tilstand (verificeret)

Rettigheden `menu_reports_tdc_edit_sales` er slået til for 4 roller: `ejer`, `teamleder`, `assisterendetm`, `salgskonsulent_tdc_support`. Det giver i dag 13 aktive brugere adgang — bl.a. Filip, Jonas, Karl (teamleder) og Sejer, Sebastian (assisterende TM), som ikke skal have adgang.

Der findes ingen aktiv per-bruger rettighedsmekanisme i den nuværende permission-motor (`user_menu_permissions` bruges ikke længere af `usePositionPermissions`), så personadgang skal etableres eksplicit.

## Løsning

1. **Fjern rolle-adgangen** for `teamleder` og `assisterendetm`. Tilbage står `ejer` (alle ejere) og `salgskonsulent_tdc_support` (Oliver).
2. **Ny allowlist-tabel** `tdc_sales_edit_access` med én række pr. person (auth-bruger + note om hvem der tilføjede). Rasmus og Johannes lægges ind her.
3. **Opdatér adgangsfunktionen** `can_edit_tdc_erhverv_sales(_user_id)` så den giver `true` ved: ejer, rolle med rettigheden, ELLER aktiv række i allowlisten. Kravet om aktiv medarbejder bevares. RLS-politikkerne på `sales`/`sale_items` ændres ikke — de kalder fortsat samme funktion og er stadig afgrænset til klienten TDC Erhverv.
4. **Frontend**: menupunkt, route-guard og siden selv skal respektere allowlisten, så Rasmus og Johannes ser fanen. Ny hook, der spørger databasen om adgang, OR'es sammen med den nuværende rettighedstjek i `useTdcErhvervSales`, `AppSidebar` og route-konfigurationen.
5. **Verifikation**: kør adgangstjekket for alle fire navngivne personer (forventet `true`) og for Filip, Jonas, Karl, Sejer, Sebastian (forventet `false`).

## Teknisk

- Migration: `CREATE TABLE public.tdc_sales_edit_access` (user_id → auth.users, unique, created_at/created_by) + GRANT til `authenticated`/`service_role` + RLS: kun ejere kan læse/redigere; alle authenticated kan læse egen række. Derefter `CREATE OR REPLACE FUNCTION public.can_edit_tdc_erhverv_sales` med allowlist-tjek (fortsat SECURITY DEFINER, `search_path = public`).
- Data: `DELETE` af de to rækker i `role_page_permissions` for `teamleder` og `assisterendetm`; `INSERT` af Rasmus (rh@) og Johannes (joh@) i allowlisten.
- Kode: ny `src/hooks/useTdcSalesEditAccess.ts`; opdatering af `src/hooks/useTdcErhvervSales.ts`, `src/components/layout/AppSidebar.tsx` (linje ~468 og ~1366) og `src/routes/config.tsx` (linje 424, adgang skal kunne opfyldes af allowlisten).
- Zone: rød (auth/RLS + rettigheder) — udføres kun efter godkendelse af denne plan. Ingen ændringer i pricing eller løn.

## Bemærkning

Fremover skal nye personer tilføjes/fjernes i allowlist-tabellen. Hvis du hellere vil styre det fra UI'et, kan jeg tilføje en lille administrationsboks under Ledelse → Rettigheder — sig til, så lægger jeg det ind i planen.
