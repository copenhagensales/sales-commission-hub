

## Fix Alka-attribution + verificér payload-komplethed før fuld backfill

### Scope
**KUN Alka-integrationen** (`48d8bd23-df14-41fe-b000-abb8a4d6cd1d`). Alle andre Enreach-integrationer (Tryg, Eesy, ASE) rører jeg ikke.

### Diagnose
- Alka-leads har `lastModifiedByUser.orgCode` pegende på Tryg (de overtager efter CPH har solgt)
- Den oprindelige CPH-sælger ligger i `firstProcessedByUser.orgCode`
- Whitelist-filteret kører på rå felter før orgCode→email mapping → 0 CPH-salg matcher

### Plan

**Step 1 — Alka-specifik attribution-fix i EnreachAdapter**  
Tilføj en config-flag `prioritizeFirstProcessedUser: true` på Alka-integrationens `config` JSONB. I `EnreachAdapter.ts`: hvis flaget er sat, ændres attribution-rækkefølgen til:
1. `firstProcessedByUser.orgCode` → orgCode→email map → hvis CPH-domæne, brug den
2. `lastModifiedByUser.orgCode` → samme opslag
3. Eksisterende email-fallbacks

Andre integrationer kører uændret videre da flaget er false/undefined.

**Step 2 — Flyt whitelist-filter til efter attribution (kun Alka)**  
For Alka: fjern `dataFilters.allowedDomains` på adapter-niveau, og lad core-laget filtrere på den *resolverede* `agentEmail` efter step 1. Andre integrationer beholder deres nuværende filter-opførsel.

**Step 3 — Probe: hent 1 dag (i går) for Alka**  
Kør `safe-backfill` for kun gårsdagen, log per lead: rå orgCodes + resolveret `agentEmail` + om den passerer whitelist. Forventning: > 0 salg attribueret til `@copenhagensales.dk`.

**Step 4 — Inspicér 5 emne-payloads (NYT)**  
Når probe returnerer salg: hent rå JSON-payload for 5 vilkårlige Alka-salg (fra `sales.raw_payload` eller direkte fra adapter-debug-log). Vis dig:
- Kunde-info (navn, telefon, adresse)
- Produkter + priser
- Kampagne-ID + mapping
- Agent-attribution (rå orgCode + resolveret email)
- Timestamps
- Eventuelle felter der ser tomme eller forkerte ud

Du verificérer at ALT relevant data er med før vi kører fuld backfill.

**Step 5 — Fuld 45-dages backfill (kun efter din OK på step 4)**  
Når du har bekræftet at de 5 sample-salg ser korrekte ud:
- Pause Alka (`is_active=false`)
- Kør `safe-backfill` i 5-dages chunks fra dag-45 → i dag (9 chunks)
- `datasets=["sales"]`, `uncapped=true`, `background=true` per chunk
- Vent på hver chunk's `integration_logs`-entry før næste startes (undgår timeout)
- Genaktivér Alka når alle chunks er færdige

### Hvad jeg IKKE rører
- Tryg, Eesy, ASE, Adversus integrationer
- `EnreachAdapter`'s default attribution-logik (kun bag flag)
- DB schema, RLS, core ingestion-pipeline
- Whitelist-konfig for andre integrationer

### Næste skridt efter approval
1. Tilføj `prioritizeFirstProcessedUser: true` til Alka's `config`
2. Implementér flag-styret attribution-prioritet i `EnreachAdapter.ts`
3. Kør 1-dags probe → vis antal CPH-salg
4. Hent 5 sample-payloads → vis dig fuld JSON
5. **Vent på din OK**
6. Kør 45-dages chunked backfill + genaktivér

