
## Diagnose
Jeg har verificeret 3 ting i det nuværende setup:

1. `commission-league` er allerede korrekt registreret i kodebasen:
- `TvBoardDirect.tsx`
- `TvBoardView.tsx`
- `src/config/dashboards.ts`
- `src/routes/config.tsx`

2. Adgangskoden `XKVP` findes stadig i backend, men den er **deaktiveret** (`is_active = false`).

3. Preview, published URL og custom domain returnerer nu ikke “Dashboard ikke fundet”, men **“Adgang nægtet / Ugyldig eller inaktiv adgangskode”**. Det peger på, at problemet nu er **link-status**, ikke manglende dashboard-mapning.

## Plan for opdatering

### 1. Få linket til at virke igen
- Hvis I vil beholde samme URL, reaktiverer vi `XKVP`.
- Hvis linket bevidst skulle lukkes, opretter vi et nyt aktivt TV-link til `commission-league`.
- Efter det tester vi samme `/t/XKVP`-flow i både preview og public/custom domain.

### 2. Fjerne den misvisende fejl fremadrettet
- Flyt TV-link validering over i en backend-funktion, så vi kan skelne tydeligt mellem:
  - ugyldig kode
  - deaktiveret link
  - udløbet link
  - gyldigt link
- Opdater `useTvBoardConfig` og TV-login-flowet til at vise præcis fejltekst i stedet for en generisk fallback.

### 3. Forbedre TV-link administration
- Udvid TV-link settings/admin så man kan se både **aktive og deaktiverede** links.
- Tilføj en **“Reaktiver”** handling på deaktiverede links.
- Vis tydelig status-badge på hvert link, så det er nemt at se hvorfor et link ikke virker.

### 4. Beskytte mod gamle cached TV-visninger
- Tilføj tydeligere recovery-flow, så gamle TV-faner ikke hænger fast i en gammel tilstand.
- Ved fejl kan siden vise en mere handlingsorienteret besked, fx at linket er deaktiveret og at man skal bruge et nyt/aktivt link.

## Tekniske noter
- Den nuværende backend-politik for `tv_board_access` skjuler deaktiverede links for offentlige opslag. Derfor kan klienten ikke sikkert kende forskel på “ugyldig” og “deaktiveret” uden en backend-funktion.
- Selve dashboard-komponenten for `commission-league` er allerede wired korrekt ind. Derfor er næste rigtige opdatering ikke route-mapning, men **link-validering og reaktivering/admin-flow**.

## Resultat efter implementering
- `/t/XKVP` virker igen, hvis linket reaktiveres.
- Brugerne får korrekt fejlbesked, hvis et TV-link er deaktiveret eller udløbet.
- I kan selv genaktivere links i dashboard-miljøet uden at skulle oprette alt på ny.
