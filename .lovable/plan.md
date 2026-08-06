# Eesy FM afvigelser — adgang via rettighedssystemet i stedet for hardkodet liste

To ting løses: siden smider dig retur til Hjem, og adgangen skal styres som på alle andre sider.

## Hvorfor du bliver smidt tilbage

Siden tjekker adgangen, før login-oplysningerne er hentet. `useAuth()` giver `user = null` i det første øjeblik efter navigation, og siden tolker det som "ingen adgang" og redirecter straks til `/home`. Menupunktet vises, fordi sidemenuen på det tidspunkt allerede kender din mail.

Evidens: `src/hooks/useAuth.tsx:8` starter med `useState<User | null>(null)`; `src/config/eesyFmDeviationAccess.ts:18-21` bruger kun `user?.email` og ignorerer `loading`; `src/pages/vagt-flow/EesyFmDeviations.tsx:9` redirecter med det samme.

## Sådan gør de andre FM-sider det

Alle øvrige punkter under Fieldmarketing bruger en rettighedsnøgle, ikke mails. Fx "Ret salgsregistrering (Leder)":

- Nøgle registreret i `src/config/permissionKeys.ts:273` (`menu_fm_edit_sales`).
- Vises i Rettigheder-UI'et via `src/config/permissions.ts:329`.
- Ruten beskyttes i `src/routes/config.tsx:251` med `access: "role", positionPermission: "menu_fm_edit_sales"`.
- Menupunktet vises via `p.canViewFmEditSales` fra `src/hooks/usePositionPermissions.ts:611`.

Rettigheder er rolle-baserede (via stilling → systemrolle → `role_page_permissions`), så adgang gives pr. stilling i Rettigheder-siden — ikke pr. person.

## Løsningen

Ny rettighedsnøgle `menu_fm_eesy_deviations` ("Eesy FM afvigelser (Leder)") under Fieldmarketing, og den hardkodede mailliste fjernes helt.

Adgang efter ændringen:
- Ejer har adgang automatisk (ejer-bypass) — det dækker Jeppe.
- Stillingen "Fieldmarketing leder" (`fm_leder`) får nøglen slået til, så William Bornak har adgang. Der er kun 1 aktiv medarbejder på den stilling, så det giver ikke bredere adgang end i dag.
- Alle andre stillinger har den slået fra og kan hverken se menupunktet eller åbne URL'en.
- Fremover styres adgangen i Rettigheder-siden uden kodeændring.

Siden får desuden ikke længere sin egen redirect — rutens standard-guard håndterer det, så race-conditionen forsvinder.

## Teknisk

- `src/config/permissionKeys.ts`: tilføj `menu_fm_eesy_deviations` (section `fieldmarketing`, parent `menu_section_fieldmarketing`).
- `src/config/permissions.ts`: tilføj nøglen i Fieldmarketing-gruppen med `hasEditOption: false`.
- `src/components/employees/PermissionsTab.tsx`: tilføj nøglen til `menu_section_fieldmarketing`-listen + et ikon (`AlertTriangle`).
- `src/hooks/usePositionPermissions.ts`: eksponér `canViewFmEesyDeviations: canView("menu_fm_eesy_deviations")`.
- `src/routes/config.tsx`: ret ruten til `access: "role", positionPermission: "menu_fm_eesy_deviations"`.
- `src/components/layout/AppSidebar.tsx`: brug `p.canViewFmEesyDeviations` i stedet for mail-tjekket; fjern importen af den gamle hook.
- `src/pages/vagt-flow/EesyFmDeviations.tsx`: fjern `Navigate`-redirect og adgangshook (guarden på ruten dækker).
- Slet `src/config/eesyFmDeviationAccess.ts`.
- Migration: `INSERT` af `menu_fm_eesy_deviations` i `role_page_permissions` med `true` for `fm_leder` og `false` for øvrige roller (samme mønster som eksisterende FM-nøgler).

Ingen ændringer i pricing, løn eller RLS på salgsdata.
