
## Plan: Screenshots af frontend-skærme

### Realitet

Systemet har **179 sider** + dialoger og varianter. At tage screenshots af alt vil:
- Tage 30-60 minutter browser-tid
- Producere 200+ billeder
- Kræve at jeg er logget ind som en rolle der har adgang til alt (ejer)
- Mange sider kræver data (specifik klient, periode, medarbejder) for at vise noget meningsfuldt

### Forslag — vælg scope

**A. Hovedmenu-skærme (~15 stk, 5 min)**
Forsiden af hver topnavigations-sektion: Home, Dashboards-oversigt, Salg, Løn, Compliance, AMO, Indstillinger, Kunder, Teams, Vagtplan, Rekruttering, Field Marketing, MgTest, Rapporter, Onboarding.

**B. Alle dashboards (~20 stk, 10 min)**
Hvert dashboard under `/dashboards/*` (Relatel, TDC Erhverv, Eesy TM, FM, Tryg, Finansforbundet, ASE, AMO, Economic, osv.).

**C. Specifik sektion (du nævner hvilken)**
F.eks. "alle skærme under Løn" eller "alle Compliance-sider".

**D. Alt (179 sider, ~45 min)**
Inklusive admin-værktøjer, MgTest-faner, Onboarding-moduler, AMO-undersider. Mange vil være tomme/loading uden specifik kontekst.

### Output

PNG-filer i `/mnt/documents/screenshots/` med beskrivende navne (`01-home.png`, `02-dashboard-relatel.png`, …) + en `index.md` der lister alle med rute og kort beskrivelse. Leveret som `<lov-artifact>` så du kan downloade.

### Forudsætninger

- Du skal være **logget ind som ejer** i preview først (browseren deler din session)
- Viewport: 1920×1080 (desktop, fuld bredde)
- Jeg tager kun ét screenshot pr. side (ingen scroll/dialoger) medmindre du beder om det

### Mit forslag

**A + B = 35 skærme, ~15 min.** Dækker det visuelt vigtige uden at drukne i admin-undersider. Hvis du vil have specifikke ekstra (f.eks. "også alle MgTest-faner"), så tilføjer vi dem.

### Bekræft

Vælg A / B / C / D / A+B → jeg starter.
