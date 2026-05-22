**Konklusion:** Nummeret/leadet findes ikke i `sales`, og det er ikke et almindeligt credential-problem for Eesy TM — syncen modtager andre Eesy TM-salg i dag.

**Evidens:**
- `sales`: 0 rækker på telefon `42415580`, lead `1006478073` eller raw payload-match.
- Christoffer Forman har kun 1 Eesy TM-salg i dag i databasen: lead `1006579167`, telefon `+4542535480`, kampagne `108547`, state `success`.
- Eesy TM-sync kører OK: seneste runs viser bl.a. `records_processed: 1` kl. 11:58 og safe-backfill med 30 salg tidligere.
- Lead-check mod `/v1/leads/1006478073` giver stadig `403`, men det beviser kun at direkte lead-endpointet ikke kan læse leadet — ikke at sales-endpointet ikke kan.
- Screenshot-leadet ligger på kampagne `Tjenestetorvet - Premium`, emne-id `1006478073`, telefon `42415580`.
- Mapping findes for kampagne `114001 -> Tjenestetorvet - Premium / Eesy TM`, men der findes 0 salg i dag og 0 historiske salg i `sales` på `dialer_campaign_id='114001'`.

**Mest sandsynlige forklaring:**
Kampagne `114001` er mappet i databasen, men Eesy TM-integrationen får ingen salg ind fra den kampagne via sales-sync. Derfor kommer leadet ikke ind, selvom andre Eesy TM-kampagner gør.

**Kode-evidens for mulig filterårsag:**
- `supabase/functions/integration-engine/adapters/adversus.ts:29-48` filtrerer Eesy TM til kun `state === 'success'`.
- `supabase/functions/integration-engine/adapters/adversus.ts:437-438` anvender filteret før ingestion.
- Hvis `114001`-salget har en anden state end exakt `success`, bliver det droppet før `sales`.
- Men fordi der slet ikke findes historiske `114001`-salg, kan årsagen også være at sales-endpointet ikke returnerer kampagnen til integrationen, eller at direkte `/leads/{id}`-permission er anderledes end sales-permission.

**Næste plan hvis du vil have fix/videre diagnose:**
1. Tilføj en read-only diagnostic action i `integration-engine`, som henter rå Adversus sales for Eesy TM uden Eesy-state-filter og filtrerer på `leadId`, telefon eller kampagne `114001`.
2. Kør diagnostic på `leadId=1006478073`, `phone=42415580`, `campaignId=114001`.
3. Hvis rå salget findes med non-`success` state: ændr Eesy TM-filteret til enten at tillade denne state eller logge/dumpe skipped Eesy TM-salg tydeligt.
4. Hvis rå salget ikke findes: problemet ligger i Adversus API-adgang/sales-endpointet for kampagne `114001`, ikke i vores database/mapping.

Ingen ændringer lavet.