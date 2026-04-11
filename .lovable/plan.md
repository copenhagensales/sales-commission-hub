

## Flyt hardkodet Dag 0 SMS ind i flow-skabeloner

### Problem
Dag 0 SMS-beskeden er hardkodet i `auto-segment-candidate` (linje 372) og kan ikke redigeres via Skabeloner-fanen. Indholdet i databasen mangler helt — der findes kun `flow_a_dag0_email`, ikke en tilsvarende SMS-post.

### Løsning

**1. Tilføj Dag 0 SMS-skabelon i databasen**

Indsæt en ny `booking_flow_steps`-post med den nuværende hardkodede besked som indhold, med merge-tags:

```
Hej {{fornavn}}, tak for din ansøgning til {{rolle}}! Vi ringer dig {{ringetidspunkt}} fra {{telefonnummer}}. Passer det ikke? Book selv en tid: {{booking_link}} — Afmeld: {{afmeld_link}}
```

Template key: `flow_a_dag0_sms`, day: 0, channel: sms, offset_hours: 0, phase: active.

**2. Opdater `auto-segment-candidate` edge function**

Erstat den hardkodede SMS-tekst (linje 340-391) med et opslag i `booking_flow_steps` via `template_key = 'flow_a_dag0_sms'`. Brug den eksisterende merge-tag-erstatning (`{{fornavn}}`, `{{rolle}}`, `{{booking_link}}`, `{{afmeld_link}}`, `{{ringetidspunkt}}`, `{{telefonnummer}}`).

**3. Tilføj `{{telefonnummer}}` som dokumenteret merge-tag i UI**

Opdater `FlowTemplatesTab.tsx` så `{{telefonnummer}}` og `{{ringetidspunkt}}` vises i listen af tilgængelige merge-tags.

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| **Database insert** | Tilføj `flow_a_dag0_sms` post til `booking_flow_steps` |
| `supabase/functions/auto-segment-candidate/index.ts` | Læs dag 0 SMS fra DB, merge tags, send |
| `src/components/recruitment/FlowTemplatesTab.tsx` | Tilføj `{{ringetidspunkt}}` og `{{telefonnummer}}` til merge-tag dokumentation |

