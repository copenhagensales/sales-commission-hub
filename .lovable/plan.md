
## Undersøg afvigelse i Eesy FM omsætning mellem Lønarter og FM Økonomi

### Observation
- **Lønarter → DB per Klient (April 2026, MTD)**: Eesy FM omsætning = **561.935 kr**
- **Fieldmarketing → Booking → Økonomi (Uge 16, 2026)**: Eesy FM omsætning = **350.250 kr** (én uge alene)

Hvis Uge 16 alene viser 350k og April MTD kun viser 562k, så er resten af april (uge 14+15+17 frem til i dag) kun ~211k — det er mistænkeligt lavt og tyder på en reel afvigelse, ikke kun forskellige perioder.

### Hypoteser om årsagen
De to views bruger forskellige datakilder/filtre:

1. **`LocationProfitabilityContent` (FM Økonomi)**  
   Tæller `sale_items.mapped_revenue` for salg hvor `raw_payload.fm_location_id` matcher en booket lokation i ugen — attribueret via `bookedDays` på placement. Klient bestemmes af lokationens placering, ikke af `sales.client_id`.

2. **`ClientDBTab` (Lønarter → DB per Klient)**  
   Bruger `useSalesAggregatesExtended` med `clientId = Eesy FM` → går gennem `get_sales_aggregates_v2` RPC, som filtrerer på `sales.client_campaign_id` → `adversus_campaign_mappings` → `team_clients` (sales ownership).

### Sandsynlige årsager til at Lønarter viser lavere
- **Sales ownership-mismatch**: Eesy FM-salg kan have `client_campaign_id` der ikke mapper til Eesy FM-klienten i `team_clients`, så de tælles under en anden klient (eller slet ikke) i DB-rapporten. Eesy FM bruger trigger-baseret enrichment (`enrich_fm_sale`) — salg uden korrekt `client_campaign_id` lander forkert.
- **Pricing-rematch ikke kørt**: `mapped_revenue` på `sale_items` kan være 0/forældet hvis `rematch-pricing-rules` ikke har kørt på nyere FM-salg. FM Økonomi-tabben læser samme felt, så det forklarer kun afvigelsen hvis aggregat-RPC'en filtrerer rækker uden gyldig pricing væk.
- **Client-mapping på `sales.client_id` vs `raw_payload.fm_client_id`**: FM Økonomi attribuerer via lokation+booking, mens DB-rapporten attribuerer via klient-FK. Hvis nogle Eesy FM-salg er gemt med forkert `client_id` (fx YouSee eller NULL), vises de i ugeoversigten men ikke i DB-rapporten.

### Plan for fejlfinding
Når planen godkendes skifter jeg til default mode og udfører:

1. **Sammenlign tal pr. uge** — kør SELECT mod Supabase:  
   - Sum af `mapped_revenue` for FM-salg i april 2026 grupperet pr. uge — dels via `raw_payload.fm_client_id = Eesy FM`, dels via `client_campaign_id → team_clients`-stien som RPC'en bruger. Identificér hvilke salg der falder ud af DB-rapporten.

2. **Tjek `client_campaign_id` integritet** — find Eesy FM-salg i april hvor `client_campaign_id` er NULL eller peger på en mapping uden `team_clients`-binding til Eesy FM.

3. **Tjek pricing-rematch status** — find Eesy FM `sale_items` i april med `mapped_revenue = 0` eller `mapped_revenue IS NULL` mens `products.revenue_dkk > 0`.

4. **Verificér i `get_sales_aggregates_v2`** — kald RPC'en direkte for `clientId = Eesy FM`, periode 1.–21. apr og sammenlign med DB-tabben + sum fra `sales` tabellen direkte.

5. **Rapportér tilbage**: Skriv en kort konklusion i chatten med:
   - Faktisk afvigelse i kr.
   - Hvilken sti der er korrekt (FM Økonomi vs Lønarter)
   - Hvilke salg der mangler attribuering, og hvilken kolonne der skal fixes (typisk `client_campaign_id` eller manuelt `client_id`)
   - Anbefalet fix (rematch-kørsel, manuel correction-record, eller kode-ændring i RPC/aggregat-hook)

### Ingen kode ændres uden videre godkendelse
Trin 1–4 er kun læsninger. Hvis der findes en bug der kræver kodeændring eller en migration, præsenterer jeg en separat plan før jeg ændrer noget.

### Filer der potentielt berøres (kun ved bekræftet bug)
- Ingen i første omgang — trin 1–4 er ren analyse via `supabase--read_query`.
