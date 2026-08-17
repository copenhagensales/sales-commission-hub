# Rolle-baseret adgang til "TDC Erhverv - ret salg" (allowlist fjernes)

## Hvad der er verificeret

- `role_page_permissions` har `menu_reports_tdc_edit_sales` med `can_view = true, can_edit = true` for `ejer`, `teamleder` og `assisterendetm`.
- Rasmus Emil Hansen resolver til rollen `teamleder`, Johannes Hedebrink til `assisterendetm` (via `job_positions.system_role_key`).
- Menupunktet i `AppSidebar.tsx:1361` er kun gated af `p.canViewReportsTdcEditSales`, så menuen burde vises for dem allerede.
- Indholdet gates i stedet af `useIsTdcErhvervLeader` (`src/hooks/useTdcErhvervSales.ts:318-361`), som kræver ejer, medlemskab af TDC Erhverv-teamet, eller at e-mailen står i `src/config/tdcErhvervEditAccess.ts`. Det er den hardkodede undtagelse vi nu fjerner.

## Ændringer

1. **`src/hooks/useTdcErhvervSales.ts`** — `useIsTdcErhvervLeader` erstattes af et rent rettighedstjek:
   - Adgang = rettigheden `menu_reports_tdc_edit_sales` (view/edit) fra rolle-systemet, plus ejer-bypass som i dag.
   - Team-tjek på TDC Erhverv-teamet og allowlist-tjek fjernes.
   - Hooket beholder sit navn og returværdi, så `TdcErhvervEditSales.tsx` ikke ændres, men bygger nu på `usePermissions()` i stedet for egne DB-opslag.
2. **`src/config/tdcErhvervEditAccess.ts`** — slettes (ingen andre brugssteder).

Ingen migration er nødvendig: rettigheden findes allerede for begge roller. Fremover styres adgangen udelukkende under Ledelse → Rettigheder.

## Konsekvens (bekræftet valg)

Alle brugere med rollen `teamleder` eller `assisterendetm` — ikke kun TDC Erhverv-ledelsen — kan herefter åbne og rette TDC Erhverv-salg. Skal det strammes senere, sker det ved at slå rettigheden fra for rollen i rettighedsmodulet.

## Uden for scope

Ingen ændring af RLS på `sales`/`sale_items`, pricing, provision eller løn. Rettelses-logikken i dialogen berøres ikke.
