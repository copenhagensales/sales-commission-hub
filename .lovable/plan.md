
Mest sandsynlige forklaring er ikke “data findes ikke”, men “vi henter dem på den forkerte måde”.

## Hvad jeg fandt
- Der er lige nu **267** Lovablecph TDC Erhverv-salg fra **2026** uden OPP i databasen.
- De ligger kun i **januar-februar**. **Marts har 0 manglende**.
- **262/267** ligger på kampagne **99496**.
- Den nuværende `tdc-opp-backfill` bruger stadig **`/v1/leads/{leadId}`** pr. salg.
- Repoet har allerede en diagnostics-funktion, som direkte siger at den rigtige vej til OPP er bulk-listning via **`/v1/leads?filters=...`**, fordi den returnerer `resultData`.
- Logs fra den tidligere test af **`/v1/sales/{id}`** viser, at den response **ikke** indeholder `resultData` for de problematiske salg.

## Plan
### 1. Skift strategi i backfill
Opdatér `supabase/functions/tdc-opp-backfill/index.ts`, så den **ikke** prøver at hente OPP via enkelt-lead endpointet.

I stedet:
- hent alle manglende Lovablecph TDC Erhverv-salg fra **2026**
- gruppér dem i mindre dato-vinduer (fx uge for uge)
- hent leads fra Adversus via **bulk `/v1/leads` med filters** pr. kampagne + dato-vindue
- byg et map `leadId -> { resultData, resultFields, opp }`
- match tilbage på eksisterende `sales.raw_payload.leadId`

### 2. Gem OPP normaliseret og robust
Når et match findes:
- opdatér `raw_payload.leadResultData`
- opdatér `raw_payload.leadResultFields`
- sæt evt. også et normaliseret felt i payloaden, fx `legacy_opp_number`, så rapporter og UI ikke er afhængige af én bestemt struktur
- sæt `enrichment_status = 'healed'`
- nulstil `enrichment_error`

### 3. Lad umatchede blive tydelige i stedet for “falsk døde”
For salg der stadig ikke matches:
- behold dem ikke som generisk `failed`
- skriv en mere præcis fejl, fx `bulk_lead_lookup_no_match`
- log antal pr. kampagne og uge, så vi kan se præcis hvor der evt. stadig mangler noget

### 4. Begræns scope til “salg fra i år”
Backfillen skal kun arbejde på:
- `source = 'Lovablecph'`
- TDC Erhverv client campaign
- `sale_datetime >= '2026-01-01'`

Det matcher det du bad om og holder API-load nede.

### 5. Kør og valider resultatet
Efter implementering:
- kør backfillen i batches
- verificér at tallet **267** falder markant eller til 0
- verificér at rådata-rapporten nu viser OPP for januar-februar
- verificér at marts forbliver uændret

## Tekniske detaljer
```text
Nuværende flow:
sales -> raw_payload.leadId -> /v1/leads/{leadId} -> ofte tomt/404

Nyt flow:
missing sales (2026)
  -> group by week + campaign
  -> /v1/leads?filters=campaign/date-window
  -> resultData/resultFields
  -> match by leadId
  -> update sales.raw_payload + enrichment_status
```

## Berørte filer
- `supabase/functions/tdc-opp-backfill/index.ts`
- evt. en ny migration kun hvis vi vil gemme et ekstra normaliseret OPP-felt permanent i databasen; ellers kan vi nøjes med `raw_payload`

## Forventet effekt
Ja — baseret på koden i repoet er næste rigtige forsøg **ikke** manuel CSV først, men en målrettet bulk-backfill via `/v1/leads`-listing. Det er den mest sandsynlige måde at hente de manglende OPP-numre for årets Lovablecph TDC Erhverv-salg.
