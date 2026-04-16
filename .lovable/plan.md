

# Fix: Tilføj "Bekræftelse"-fasen til FlowTemplatesTab

## Problem
Databasen har 3 faser: `active`, `confirmation` og `reengagement`. Men `PHASE_GROUPS` i `FlowTemplatesTab.tsx` definerer kun `active` og `reengagement` — så bekræftelses-SMS'en (template_key: `booking_confirmation_sms`) vises aldrig i UI'et og kan ikke redigeres.

## Løsning
Tilføj `confirmation`-fasen til `PHASE_GROUPS`-arrayet.

## Teknisk ændring

### Fil: `src/components/recruitment/FlowTemplatesTab.tsx`
**Linje 29-32**: Tilføj confirmation-fasen:

```typescript
const PHASE_GROUPS = [
  { phase: "confirmation", label: "Bekræftelse — Ved booking", color: "text-foreground" },
  { phase: "active", label: "Aktiv booking — Dag 0–10", color: "text-foreground" },
  { phase: "reengagement", label: "Re-engagement — Dag 45+", color: "text-foreground" },
];
```

Én linje tilføjet, ingen andre filer ændres.

