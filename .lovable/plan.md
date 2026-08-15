# Adgang til "TDC Erhverv - ret salg" for Johannes og Rasmus

## Status i dag (verificeret)

- **Menuadgang virker.** `role_page_permissions` giver `menu_reports_tdc_edit_sales` med view + edit til rollerne `ejer`, `teamleder` og `assisterendetm`. Rasmus Emil Hansen er Teamleder, Johannes Hedebrink er Assisterende Teamleder TM.
- **Indholdet blokeres.** `useIsTdcErhvervLeader` (`src/hooks/useTdcErhvervSales.ts:321-355`) kræver enten ejer-rolle eller medlemskab af TDC Erhverv-teamet `ee967dfd-04c8-465e-bda7-f1c47094bae0`. Begge står udelukkende på teamet **Stab**, og ingen af dem har en række i `user_roles`.

Konklusion: de kan åbne siden, men ser "ingen adgang" i stedet for salgene.

## Valgt løsning

Adgangen udvides med en eksplicit, dokumenteret allowlist — samme mønster som `src/config/bulkSalesAccess.ts`. Det holder siden lukket for alle andre teamledere (rettighedsnøglen alene ville åbne den for hele `teamleder`-rollen), og det undgår at flytte de to væk fra teamet Stab, hvilket ville påvirke rapporter og løn.

## Ændringer

1. **Ny fil `src/config/tdcErhvervEditAccess.ts`**
   - Eksporterer en liste af arbejds-e-mails med adgang: `joh@copenhagensales.dk`, `rh@copenhagensales.dk`.
   - Hjælpefunktion `hasTdcErhvervEditAccess(email)` med lowercase-normalisering.
   - Kommentar der forklarer at listen er den manuelle undtagelse ved siden af team-medlemskab.

2. **`src/hooks/useTdcErhvervSales.ts`**
   - I `useIsTdcErhvervLeader`: efter ejer-tjekket returneres `true`, hvis brugerens e-mail står på allowlisten — ellers uændret team-tjek.
   - Ingen ændring af data-hentning, sletning eller opdatering.

## Uden for scope

- Ingen ændring af teams, `team_members` eller `role_page_permissions`.
- Ingen ændring af pricing, provision eller løn.

## Teknisk note

Gaten er kun UI-niveau; de underliggende RLS-politikker på `sales`/`sale_items` er uændrede, så ændringen udvider ikke databaserettigheder ud over hvad de to roller allerede har.
