

## Konsolider til ét flow (Flow A) for alle tiers

### Hvad ændrer sig

I dag har systemet 3 separate flows med forskellige beskeder (A: 8 trin, B: 3 trin, C: 2 trin). Det ændres til **ét flow** (de nuværende 8 Flow A-trin) som bruges til alle tiers. Forskellen mellem tiers er kun:

- **Tier A** → flowet starter automatisk
- **Tier B** → flowet starter efter manuel godkendelse
- **Tier C** → flowet starter efter manuel godkendelse (lavere prioritet)

### Ændringer

**1. `supabase/functions/auto-segment-candidate/index.ts`**
- Når B/C-kandidater godkendes manuelt, oprettes de **samme 8 touchpoints** som Tier A (flow_a_dag0_email, flow_a_dag0_sms, osv.)
- Fjern tier-specifik flow-logik — alle bruger FLOW_A-sekvensen

**2. `supabase/functions/process-booking-flow/index.ts`**
- Fjern `flow_b_*` og `flow_c_*` templates fra `FLOW_TEMPLATES`
- Behold kun `flow_a_*` templates (som nu er "det ene flow")

**3. `src/components/recruitment/FlowTemplatesTab.tsx`**
- Fjern Tier B og Tier C sektioner fra `TIER_GROUPS`
- Vis kun én sektion: **"Booking Flow — 8 trin"** med alle `flow_a_*` templates
- Fjern tier-gruppering, vis bare trinnene kronologisk

**4. Frontend labels**
- Omdøb fra "Tier A — Høj prioritet" til bare "Booking Flow" i skabelon-fanen
- Tier-badges i dashboardet forbliver (de viser stadig om kandidaten er A/B/C for at indikere auto vs. manuel)

### Filer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/auto-segment-candidate/index.ts` | B/C bruger samme FLOW_A touchpoints ved godkendelse |
| `supabase/functions/process-booking-flow/index.ts` | Fjern flow_b/flow_c templates |
| `src/components/recruitment/FlowTemplatesTab.tsx` | Vis kun ét flow uden tier-gruppering |

