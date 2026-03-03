

## Fix: Smartere dag-badges i email-rapport

### Problem
Når individuelle dage vises (f.eks. Man, Tir, Ons, Fre), flyder badges sammen med ugenummeret og ser rodet ud. "Man–Fre" fungerer fint fordi det er ét badge.

### Løsning
Omstrukturér `renderWeekdayBadges()` i `send-supplier-report/index.ts`:

1. **Ugenummer som egen linje/label** — giv den en tydelig styling med lidt mere spacing
2. **Dag-badges på ny linje under ugenummeret** — wrap badges i en flex-lignende container med `display:inline-block` og lille gap
3. **Kortere dag-labels** — brug enkeltbogstaver (M, Ti, O, To, F) i stedet for 3-bogstavs forkortelser for at spare plads
4. **Kompakt layout** — sæt badges tættere med mindre padding (2px 6px) og mindre font (10px) så de fylder mindre
5. **Visuel adskillelse** — tilføj en tynd border eller baggrund på ugenummer-labelen så den skiller sig ud fra dagene

### Konkret ændring

**Fil:** `supabase/functions/send-supplier-report/index.ts` — `renderWeekdayBadges()` (linje 10-31)

- Ugenummer: bold label med lille baggrund (`#e2e8f0`, padding, border-radius)
- Dag-badges: kompakte, 10px font, `padding:2px 6px`, `margin:1px` — placeret på linje under ugenummer
- Behold "Man–Fre" som samlet grøn badge (fungerer allerede godt)

