

## Gør booking flow-trin redigerbare (tilføj/slet)

### Problem
Flow-trinene er hardkodet 3 steder: frontend (`BookingFlow.tsx`), `auto-segment-candidate` og `process-booking-flow`. Man kan ikke tilføje eller fjerne trin uden at ændre kode.

### Løsning
Flyt flow-definitionen til en databasetabel (`booking_flow_steps`) og lad frontend CRUD'e derfra. Edge functions læser trinene dynamisk fra DB i stedet for hardkodede arrays.

### Database

Ny tabel `booking_flow_steps`:

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| day | integer | Dag i flowet (0, 1, 3, 6...) |
| channel | text | "email" eller "sms" |
| template_key | text | Reference til skabelon |
| offset_hours | numeric | Tidspunkt på dagen |
| sort_order | integer | Rækkefølge |
| is_active | boolean | Slå til/fra |
| phase | text | "active" eller "reengagement" |

Seed med de nuværende 9 trin. RLS: kun autentificerede med `is_teamleder_or_above`.

### Frontend-ændringer

**`FlowTemplatesTab.tsx`**:
- Hent trin fra `booking_flow_steps` i stedet for hardkodet `FLOW_TEMPLATES`
- Tilføj "Tilføj trin" knap per fase-gruppe (åbner dialog med dag, kanal, emne, indhold)
- Tilføj slet-knap (med bekræftelse) på hvert trin
- Behold redigering af skabelonindhold som i dag

**`BookingFlow.tsx`**:
- Hent `FLOW_DEFINITIONS` dynamisk fra `booking_flow_steps` tabel i stedet for hardkodet objekt
- Brug dynamiske trin ved oprettelse af touchpoints (approve-mutation)

### Edge Functions

**`auto-segment-candidate`**: Erstat hardkodet `FLOW_A` array med query til `booking_flow_steps` tabel.

**`process-booking-flow`**: Allerede template-agnostisk (læser fra touchpoints), men opdater `FLOW_TEMPLATES` fallback til også at checke DB.

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| **Migration** | Opret `booking_flow_steps` tabel + seed data |
| `src/components/recruitment/FlowTemplatesTab.tsx` | Dynamisk hentning, tilføj/slet UI |
| `src/pages/recruitment/BookingFlow.tsx` | Dynamisk flow-definitioner fra DB |
| `supabase/functions/auto-segment-candidate/index.ts` | Læs trin fra DB |
| `supabase/functions/process-booking-flow/index.ts` | Brug DB-templates som primær kilde |

