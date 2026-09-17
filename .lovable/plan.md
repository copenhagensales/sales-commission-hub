# Lederne-integration (Adversus, success-leads)

## Hvad jeg fandt før planen (evidens)

- Den nuværende Adversus-sync kører **ikke** via `adversus-sync-v2`/`sync-adversus` (de er ældre værktøjer). Den aktive vej er `integration-engine` + en række i `dialer_integrations` + pg_cron. Der findes allerede tre Adversus-konti som separate rækker: `Lovablecph`, `Relatel_CPHSALES`, `Eesy TM` (cron jobid 100/101/117 m.fl., hver 15. minut).
- Sælger-kobling: `agents` (`external_adversus_id`, `name`, `is_active`, placeholder-mail `agent-<id>@adversus.local`) + `employee_agent_mapping` → `employee_master_data`. Ukendte sælgere ligger som umappede agents (kan skjules via `hidden_unmapped_agents`). Det er præcis den "koblingstabel + ukendt sælger-kø", kravet beskriver — jeg opretter ingen ny tabel til det.
- Kampagner: `adversus_campaign_mappings` (adversus_campaign_id → `client_campaign_id`). Ase FM blev oprettet efter samme mønster (kunde → kampagne → mapping → produkter).
- Retention: `campaign_retention_policies` pr. kampagne. Ase står på `retention_days = 90`, `cleanup_mode = anonymize_customer` — det er hooket vi genbruger. Ingen ny GDPR-kode.
- Idempotens: `sales.adversus_external_id` er UNIQUE — den bruges som nøgle pr. lead.
- **Risikoændring:** "Lederne" findes allerede i Stork i dag, men som **produkt under kunden Tryg** (kampagne `Tryg Products`, produkt `Lederne`, 75/200 + prisregler på Mødetype 30/90). De 266+ salg er lagt ind manuelt via bulk-upload (`source = manual_entry`). Se beslutning 1 nedenfor.

## Beslutninger jeg har brug for

**1. Hvor skal API-salgene ligge?**
- **A (som du har bedt om):** ny kunde `Lederne` med egne kampagner. Ren og rigtig fremadrettet, men historikken splittes: bulk-salgene ligger fortsat under Tryg/produkt "Lederne", og dine eksisterende 30/90-regler gælder ikke de nye salg — du skal sætte satser op igen på den nye kunde.
- **B:** synken peger på den eksisterende Tryg → "Lederne"-opsætning. Så virker satserne fra dag ét og alt ligger samlet, men Lederne bliver ikke en selvstændig kunde.

Jeg bygger **A** som bestilt, medmindre du siger andet — men det er værd at vide, at rapporter så viser Lederne to steder.

**2. Sælgermail på salget.** Attribution i rapporter og leaderboards kører på `sales.agent_email`. Jeg foreslår at udfylde den med **vores egen medarbejders arbejdsmail fra Stork** efter navnematch — altså data vi allerede har, ikke noget hentet fra Adversus. Adversus-brugerens mail og telefon gemmes aldrig. Siger du nej, står `agent_email` tom, og salgene kan kun tælles via agent-koblingen.

## Datamodel (migration)

1. Kunde `Lederne` i `clients`.
2. Kampagner i `client_campaigns`: én pr. Adversus-kampagne, navngivet med kampagne-id (`118971`, `118972`) — kan omdøbes i UI.
3. `adversus_campaign_mappings`-rækker der binder id → kampagne.
4. Ét produkt pr. kampagne (`Mødebooking`) med `counts_as_sale = true` og 0 i sats, så du selv sætter provision/omsætning og Mødetype-regler bagefter. Ingen provisionslogik bygges.
5. `campaign_retention_policies` pr. Lederne-kampagne: `retention_days = 90`, `cleanup_mode = anonymize_customer` (som Ase).
6. Ny tabel `lederne_campaign_review`: nye kampagne-id'er der dukker op med vores brugere, flagges til gennemsyn (id, kampagne-id, set første gang, gennemset af/hvornår). RLS + grants; kun stab/superadmin læser.
7. Række i `dialer_integrations`: navn `Lederne`, provider `adversus_lederne`, egen `sync_frequency_minutes`. Den nye provider-værdi rammes **ikke** af de eksisterende provider-cronjobs, så den nuværende integration er urørt.
8. Watermark i `dialer_sync_state` (`dataset = 'lederne_leads'`), sat til nu ved oprettelse — ingen backfill.

## Edge function `lederne-sync`

- Bruger `ADVERSUS_LEDERNE_API_USERNAME`/`PASSWORD` mod `https://api.adversus.io/v1`. Aldrig i svar eller log.
- `GET /users` → behold kun mails der slutter på `@copenhagensales.dk`; gem **kun** Adversus-id, navn og aktiv-status i `agents`. Mail/telefon kasseres i hukommelsen før noget skrives.
- `GET /leads` med `lastModifiedTime > watermark`; behold kun `status = success` og kun leads hvis `lastContactedBy` er én af vores brugere. Alt andet ignoreres helt.
- Positivliste før skrivning (hårdkodet whitelist, alt andet droppes): lead-id, `campaignId`, `status`, `lastContactedBy`, `updated`, Mødetype (132892, råværdi, tomt = tomt), Dybderesultat - Ukvalificeret (67596), Emne, Kildekampagne, Medlemsnummer (67209). Navn, Stilling, Mobil, Email, adresse og Note filtreres væk i funktionen — de findes ikke i det objekt der sendes til databasen.
- Skriver til `sales`: `adversus_external_id = 'lederne-<leadId>'` (idempotent upsert), `sale_datetime = lead.updated`, `dialer_campaign_id`, `client_campaign_id`, `agent_name`/`agent_external_id`, `source = 'adversus_lederne'`. `customer_phone`/`customer_company` sættes ikke. Medlemsnummer og Mødetype lægges i `raw_payload` i samme format som de øvrige Adversus-salg, så dine prisregler på Mødetype kan matche.
- Én `sale_items`-linje pr. salg på kampagnens produkt, så satser og rematch virker som på øvrige kampagner.
- Tilbagetrækning: leads der tidligere var success og ikke længere er det, sættes til `validation_status = 'cancelled'` — samme håndtering som annulleringer. Ingen sletning.
- Ukendt sælger: leads på vores domæne uden navnematch i `employee_master_data` lander som umappet agent i den eksisterende kø.
- Kører med `verify_jwt = false` som de øvrige sync-funktioner, kun kaldbar fra cron; logger antal, ikke indhold.

## Cron

Nyt pg_cron-job hver 15. minut i samme rytme som den eksisterende Adversus-sales-sync, med watermark og idempotent upsert. De eksisterende jobs røres ikke.

## Oprydning

`adversus-discover` beholdes som superadmin-værktøj, men de midlertidige fejlsøgningsdele (sales-variantprober, lead-krydstjek, success-lead-analyse) fjernes. Den forbliver read-only og skriver fortsat intet.

## Test og rapport

Jeg kører én sync efter opsætning. Forventet 0 eller få salg, fordi watermark er sat til nu. Til slut rapporterer jeg tabeller/kolonner, edge function, cron, hvordan Lederne ser ud i kunde-/kampagneopsætningen, og bekræfter udtrykkeligt at intet er hentet bagudrettet, og at ingen blokerede felter kan nå databasen.
