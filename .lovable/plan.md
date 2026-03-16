

## Collapsible sæson-info sektion

Gør header-sektionen ("Sæson 1", "Runde 2 (i gang) • 55 spillere", "Landstræner: Oscar Belcher") til en collapsible sektion med Radix Collapsible.

### Ændring
**1 fil:** `src/pages/CommissionLeague.tsx`

1. Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` og `ChevronDown` icon.
2. Wrap header-området (linje ~218-255) i en `Collapsible` med en `CollapsibleTrigger` der viser:
   - **Sæson {n}** som klikbar titel
   - **Runde {x} (i gang) • {enrollmentCount} spillere** som undertekst
   - Chevron-ikon der roterer ved åbning
3. `CollapsibleContent` indeholder resten: "Landstræner: Oscar Belcher", opdater-knap, settings, countdown osv.
4. Default `open={true}` så sektionen starter åben.

Runde-info hentes fra `currentRound` (allerede tilgængelig), og spillerantal fra `enrollmentCount`.

