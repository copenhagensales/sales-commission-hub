

## Analyse: Hvorfor finder annullerings-matchingen ikke FM-salg?

### Problemet

Matchingen i `UploadCancellationsTab` er bygget til TM-salg (Adversus) og har to passes:

1. **Pass 1 (product-phone mapping)**: Tjekker `raw_payload.data.Telefon Abo1/2/3` — disse felter findes **kun** i Adversus/TM-salg. FM-salg gemmer telefon direkte i `customer_phone`, ikke inde i `raw_payload.data`.

2. **Pass 2 (seller+date+product fallback)**: Matcher på `agent_email` + dato + `sale_items.adversus_product_title`. FM-salg har `agent_email` (sat af trigger), men produkttitlerne i FM `sale_items` kan hedde noget andet end TM-titlerne.

3. **MatchErrorsSubTab re-match**: Bruger også kun `agent_email` + dato + `client_campaign_id` — dette burde virke for FM-salg **hvis** de har korrekt `client_campaign_id`. Men den leder kun på `work_email`, ikke via `employee_agent_mapping`.

### Årsag til de 43 fejl

FM-salg med telefonnumre matches via Pass 1's `payloadPhoneField` (f.eks. `Telefon Abo1`), som ikke eksisterer i FM-salgets `raw_payload`. Standard phone-matching (phoneSet) bruges kun i "no product-phone mappings"-grenen — men Eesy TM **har** product-phone mappings konfigureret, så den gren springes helt over.

**Kort sagt**: Når kunden har `product_phone_mappings` konfigureret (som Eesy TM), bruges KUN Pass 1 + Pass 2. FM-salg falder igennem begge, fordi Pass 1 leder efter TM-specifikke payload-felter.

### Plan

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

1. Tilføj en **FM-aware Pass 1b** efter Pass 1:
   - For rækker der ikke matchede i Pass 1, tjek om Excel-telefonen matcher `customer_phone` direkte på FM-salg (`source = 'fieldmarketing'`)
   - Brug normalizePhone til sammenligning
   - Inkluder FM-salg i `candidateSales` (de er allerede der via `client_campaign_id`)

2. Alternativt (simplere): Udvid Pass 1 til også at tjekke `customer_phone` feltet direkte, ikke kun `raw_payload.data.*` felter

**Fil: `src/components/cancellations/MatchErrorsSubTab.tsx`**

3. Udvid re-match logikken til også at søge via `agent_name` (ikke kun `agent_email`), da FM-salg konsekvent har `agent_name` sat

### Teknisk implementering

I `UploadCancellationsTab.tsx`, efter Pass 1 (linje ~900), tilføj en ekstra check for umatchede rækker:

```text
For each unmatched row with a phone:
  1. Normalize Excel phone
  2. Find candidate sales where normalizePhone(customer_phone) === excelPhone
  3. If match found → add to productMatched with first sale_item's data
```

I `MatchErrorsSubTab.tsx` (linje ~191):
- Tilføj OR-betingelse der også matcher på `agent_name` (case-insensitive) som fallback

### Berørte filer
- `src/components/cancellations/UploadCancellationsTab.tsx` — tilføj FM phone-matching
- `src/components/cancellations/MatchErrorsSubTab.tsx` — udvid re-match med agent_name fallback

