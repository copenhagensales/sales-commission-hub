

## Fjern "Opkald" fra booking flow — behold kun SMS og Email

### Ændringer

| Fil | Hvad |
|-----|------|
| `src/pages/recruitment/BookingFlow.tsx` | Fjern alle `call_reminder`-touchpoints fra tier A, B og C flow-definitionerne |
| `src/components/recruitment/FlowTemplatesTab.tsx` | Fjern `flow_a_dag1_call` og `flow_a_dag2_call` fra default templates, fjern `call_reminder` case i ikon-funktionen |
| `src/components/recruitment/BookingFlowTimeline.tsx` | Fjern `call_reminder` fra `channelConfig`, fjern `Phone` import |
| `supabase/functions/process-booking-flow/index.ts` | Fjern `flow_a_dag1_call` og `flow_a_dag2_call` fra `FLOW_TEMPLATES`, fjern `call_reminder` handling i processing-logikken |
| `supabase/functions/auto-segment-candidate/index.ts` | Fjern `call_reminder`-touchpoints fra flow-definitionen |

### Resultat
Alle tre tiers vil kun indeholde SMS og email-touchpoints. Eksisterende call_reminder-touchpoints i databasen vil stadig kunne vises i timeline (med fallback), men nye flows opretter dem ikke.

