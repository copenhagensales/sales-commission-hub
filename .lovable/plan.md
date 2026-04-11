

## Intelligent auto-segmentering med NLP-baseret tier-tildeling

### Hvad ændrer sig
Den nuværende segmentering er manuel (5 toggles → tæl op → tier). Den erstattes med en **automatisk analyse** af kandidatens data og ansøgningstekst, som tildeler en tier baseret på de forretningsregler du beskriver.

### Ny segmenteringslogik

**Tier A — Auto-start flow + SMS:**
- Alder 18–25 (parsed fra `candidates.notes` eller `applications.notes`)
- 0–3 års erfaring
- Ansøgningstekst er dansk (< 40% engelske ord)
- Søger fuldtid (ikke deltid/fleksibel)
- Høj motivation (keywords: motiveret, udvikle mig, resultater, bedste, salg, konkurrence, energisk, målrettet)
- **Handling:** Send SMS straks via Twilio, start flow automatisk — ingen godkendelse krævet

**Tier B — Manuel godkendelse:**
- Alder 30+ og/eller 5+ års erfaring
- Tekst er dansk
- **Handling:** Vis notifikation til recruiter, flow starter først efter godkendelse

**Tier C — Manuel godkendelse, lav prioritet:**
- Ansøgningstekst > 40% engelske ord
- Nævner deltid/fleksibel/part-time
- **Handling:** Vis notifikation, visuelt nedprioriteret (grå), placeres sidst

**Fallback:** Kan ikke bestemme alder/erfaring med sikkerhed → Tier B + flag for review

### Edge function: `auto-segment-candidate`

Ny edge function der:
1. Modtager `candidate_id`
2. Henter kandidat + seneste application med notes
3. Kører NLP-analyse lokalt (ingen AI model — ren regex/heuristik):
   - **Sprogdetektion:** Tæl engelske ord vs. danske ord → procent
   - **Aldersudtræk:** Regex for "jeg er X år", "X-årig", "født i XXXX"
   - **Erfaringsudtræk:** Regex for "X års erfaring", "arbejdet i X år"
   - **Deltid-detektion:** Søg efter "deltid", "part-time", "fleksibel", "flexible"
   - **Motivations-score:** Tæl forekomster af keywords
4. Returnerer `{ tier, confidence, signals, requiresApproval }`
5. Hvis Tier A: opretter enrollment + touchpoints + sender SMS automatisk
6. Hvis Tier B/C: opretter enrollment med `status: "pending_approval"` og sender notifikation

### Database-ændringer

1. **Ny kolonne på `booking_flow_enrollments`:** `approval_status` (text: `auto_approved`, `pending_approval`, `approved`, `rejected`)
2. **Ny kolonne:** `segmentation_signals` (jsonb — gemmer parsed alder, erfaring, sprog%, motivation-score)
3. **Opdater `booking_flow_criteria`-data:** Erstat de 5 generiske kriterier med de nye forretningsspecifikke

### UI-ændringer

**SegmentationModal:** Fjern de manuelle toggles. Erstat med:
- Auto-analyse resultat: "Tier A — Ung profil, dansk, fuldtid, høj motivation"
- Parsed signals vist som badges (alder, erfaring, sprog, keywords fundet)
- Confidence-indikator
- For Tier A: "Start flow automatisk"-knap (ingen godkendelse)
- For Tier B/C: "Godkend og start flow" / "Afvis" knapper

**BookingFlow.tsx:** Tilføj nyt afsnit øverst:
- "Afventer godkendelse" sektion med Tier B/C kandidater der venter på recruiter-review
- Tier B vises med lilla badge, Tier C med grå badge og placeres sidst
- Godkend-knap starter flow, afvis-knap arkiverer

### SMS ved Tier A auto-start

Bruger den eksisterende `send-recruitment-sms` edge function:
```
"Hej {first_name}, tak for din ansøgning til {role}! 
Vi vil meget gerne tale med dig. Vi ringer dig op [dag] kl. [tid] 
— eller book selv en tid her: {booking_link}. 
Glæder os til at høre fra dig!"
```

### Filer der oprettes/ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/auto-segment-candidate/index.ts` | **Ny** — NLP-analyse + auto-tier |
| `src/components/recruitment/SegmentationModal.tsx` | Omskriv til auto-analyse UI |
| `src/pages/recruitment/BookingFlow.tsx` | Tilføj pending-approval sektion |
| `supabase/functions/process-booking-flow/index.ts` | Respekter `pending_approval` status |
| 1 migration | Tilføj kolonner til `booking_flow_enrollments` |

### Teknisk detalje: Sprogdetektion

En simpel ordliste-tilgang (top 200 engelske ord som stopord) sammenholdt med input-teksten. Ingen ekstern API — kører direkte i edge function.

