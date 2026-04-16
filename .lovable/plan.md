
# Plan: Gennemgå og rette hele booking flow, så redigeringer faktisk slår igennem

## Hvad jeg fandt
Der er flere reelle fejl i flowet lige nu:

1. **Flow-skabeloner er ikke eneste kilde**
   - `process-booking-flow` læser først fra `booking_flow_steps`, men **overstyrer med `email_templates`** hvis samme `template_key` findes.
   - I databasen findes der aktuelt en gammel `email_templates`-række med `template_key = flow_a_dag0_sms`.
   - Derfor kan du redigere teksten i **Flow-skabeloner**, men stadig få sendt en **anden/gammel SMS**.

2. **Booking flow bruger 3 forskellige tekst-paths**
   - `auto-segment-candidate` sender dag-0 SMS direkte fra `booking_flow_steps`
   - `process-booking-flow` sender planlagte touchpoints fra `booking_flow_steps` + `email_templates` override
   - `public-book-candidate` sender bekræftelses-SMS fra `booking_flow_steps`
   - Det giver inkonsistent adfærd.

3. **Public booking-siden kan falde tilbage til hardcoded tekster**
   - `PublicCandidateBooking.tsx` henter `booking_page_content` og `booking_page_config` direkte fra klienten
   - men nuværende RLS tillader kun læsning for `authenticated`
   - så en rigtig kandidat på et offentligt link kan ende med fallback-tekster i stedet for dine redigerede tekster

4. **Merge tags er ikke ens understøttet**
   - Flow-editoren viser bl.a. `{{dato}}` og `{{tidspunkt}}`
   - men `process-booking-flow` erstatter dem ikke
   - så nogle tags kan stå råt i beskeder afhængigt af hvilken funktion der sender dem

5. **Live flow-data er blevet inkonsistent**
   - Jeg kan se mindst én række hvor `template_key` og kanal ikke matcher (`flow_a_dag120_email` står som `sms`)
   - og flow-tabellen indeholder ikke længere et komplet, konsistent sæt trin
   - det øger risikoen for forkerte beskeder og forvirrende redigering

## Løsning
Jeg vil samle booking flowet om **én autoritativ kilde pr. type indhold** og rydde op i de gamle konflikter.

### 1. Gør `booking_flow_steps` til eneste source of truth for booking-flow beskeder
- Fjerne `email_templates`-override fra `supabase/functions/process-booking-flow/index.ts`
- Lade flow-SMS og flow-emails kun bruge `booking_flow_steps`
- Beholde `email_templates` kun til manuelle emails/dialoger, ikke automation

### 2. Ensrette tekst-rendering i alle booking-funktioner
- Uddrage fælles merge-tag logik til delt helper
- Bruge samme rendering i:
  - `process-booking-flow`
  - `auto-segment-candidate`
  - `public-book-candidate`
- Understøtte alle tags der vises i editoren, eller fjerne tags der ikke reelt virker

### 3. Rette public booking page så kandidater ser de redigerede tekster
- Opdatere backend-adgang for `booking_page_content` og `booking_page_config`, så public booking-siden kan læse dem korrekt
- enten via public read policies eller via en public backend-funktion
- sikre at den offentlige kandidatside bruger samme data som preview/admin

### 4. Rydde op i live template-data
- Fjerne eller omdøbe konfliktende legacy-rækker i `email_templates` (fx `flow_a_dag0_sms`)
- rette mismatches i `booking_flow_steps` mellem `template_key`, `channel`, `phase` og faktisk formål
- genskabe et konsistent sæt flow-trin, hvis nogle er blevet slettet eller fejlkonfigureret

### 5. Tilføje guardrails i editoren
- gøre det tydeligt i `FlowTemplatesTab`, at denne fane styrer de automatiske booking-beskeder
- forhindre eller begrænse redigering af felter, der skaber inkonsistens, fx kanal-skift på eksisterende step
- evt. vise template key tydeligere, så man kan spotte konflikter

## Filer der skal ændres
- `supabase/functions/process-booking-flow/index.ts`
- `supabase/functions/auto-segment-candidate/index.ts`
- `supabase/functions/public-book-candidate/index.ts`
- `src/components/recruitment/FlowTemplatesTab.tsx`
- `src/pages/recruitment/PublicCandidateBooking.tsx`
- ny delt helper under `supabase/functions/_shared/...`
- en eller flere database-migrations til:
  - policy-fix for public booking-indhold
  - data cleanup i template-tabellerne

## Tekniske noter
- Den konkrete fejl bag din viste SMS er, at `flow_a_dag0_sms` findes både i `booking_flow_steps` og i `email_templates`, og `process-booking-flow` vælger den gamle override.
- Den SMS du modtog matcher den gamle legacy-tekst, ikke den nyeste tekst i `booking_flow_steps`.
- `booking_page_content` og `booking_page_config` er i dag ikke korrekt eksponeret til public booking-siden.
- `booking_flow_steps` indeholder lige nu inkonsistent live-data, så en ren kode-fix alene er ikke nok; der skal også laves data-oprydning.

## QA efter implementering
Jeg vil verificere hele kæden i 4 flows:
1. Ny kandidat → auto-enrollment → godkend → dag-0 SMS matcher Flow-skabeloner
2. Auto-segmenteret kandidat → øjeblikkelig SMS matcher Flow-skabeloner
3. Kandidat booker tid → bekræftelses-SMS matcher confirmation-skabelonen
4. Offentligt booking-link som ikke-logget bruger → side og success-tekster matcher admin-redigeringer
