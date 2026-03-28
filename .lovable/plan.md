

## Plan: Vælg modtagere for AI-instruktionsmail

Lige nu sender "Send AI-instruktion"-knappen til ALLE aktive medarbejdere. Det ændres så admin kan vælge specifikke modtagere.

### Ændringer

**1. `AiGovernance.tsx` — Instruktionslog-fanen**

Erstatter den enkelte "Send til alle"-knap med:
- En medarbejder-liste med checkboxes (hentes fra `employee_master_data` hvor `is_active = true` og `work_email` ikke er null)
- "Vælg alle" / "Fravælg alle" toggle
- Viser hvem der allerede har modtaget instruktion (badge ved navn)
- "Send til valgte (X)" knap der kun er aktiv når mindst én er valgt

**2. `send-ai-instruction-email` edge function**

Tilføjer støtte for `employee_ids: string[]` i request body. Hvis medtaget, sendes kun til de valgte. Fjerner `send_to_all` fallback til at sende til alle.

**3. Ingen database-ændringer** — `ai_instruction_log` har allerede `employee_id` til at tracke individuelle modtagere.

### Filer
| Fil | Handling |
|-----|---------|
| `src/pages/compliance/AiGovernance.tsx` | Tilføj medarbejder-vælger med checkboxes i instruktions-fanen |
| `supabase/functions/send-ai-instruction-email/index.ts` | Accept `employee_ids` array, filtrer modtagere |

