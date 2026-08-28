# Lukas Nielsen – to manglende TDC Erhverv-salg (OPP-1095472 & OPP-1095401)

## Hvad jeg har bekræftet i data (før plan)

- Lukas Nielsen (`luni@copenhagensales.dk`, `employee_master_data.b01688c0…`) står på team **Eesy TM** (`0cb1b854-e7b5-4f49-8fdf-30e54e7d2f95`).
- Han findes som agent i Adversus (`agents.external_adversus_id = 329270`, aktiv).
- Alle hans salg i Stork ligger på Eesy TM-klienten (160 salg, 6/7–**24/8 2026**) + 1 enkelt på en anden klient 18/8. **Nul salg nogensinde på TDC Erhverv-klienten.**
- Han har **ingen salg efter 24/8** overhovedet.
- TDC Erhverv-pipelinen kører fint: 163 salg i august via integrationen `Lovablecph` (kampagne 99496), senest i dag 11:45. Nabo-OPP-numre er hentet ind (OPP-1095410, OPP-1095457, OPP-1095464 m.fl.).
- De to nævnte OPP-numre findes ikke i `sales` (hverken i `raw_payload` eller andre felter).

## Om mistanken (team-tilknytning)

Ikke bekræftet som årsag. Importlogikken (`supabase/functions/integration-engine/core/sales.ts` + `adapters/adversus.ts`) ser **ikke** på medarbejderens team i Stork. Den filtrerer kun på:
1. gyldigt e-maildomæne (`@copenhagensales.dk` er gyldigt),
2. kampagne-mapping (`adversus_campaign_mappings`),
3. et **Eesy TM-specifikt filter**: salg hvis Adversus-kampagne mapper til Eesy TM-klienten bliver **droppet helt**, hvis `state != 'success'` (`adapters/adversus.ts`, `filterEesyTmStateSuccess`).

Den mest sandsynlige – men endnu **ubekræftede** – forklaring er derfor en variant af mistanken: fordi Lukas sad på Eesy TM i Adversus, er salgene registreret på en **Eesy TM-kampagne** i Adversus (ikke TDC-kampagnen). Så bliver de antingen droppet af Eesy TM-state-filteret eller havnet under Eesy TM-klienten. Det kan kun afgøres ved at slå de to salg op i Adversus.

## Plan

### Trin 1 – Diagnose i Adversus (læs, ingen ændringer)
Brug den eksisterende read-only funktion `adversus-sales-diagnostic` (og `adversus-lead-check` hvis nødvendigt) til at finde de to salg via OPP-numrene/telefonnumre og få: `saleId`, `leadId`, `campaignId`, `state`, `ownedBy`, `closedTime` og produktlinjer.

Resultatet afgør årsagen entydigt:
- **A:** kampagne = Eesy TM-kampagne → dokumentér at Eesy TM-state-filteret/mappingen er årsagen.
- **B:** kampagne = TDC-kampagne, men `state != success`/senere lukket → dokumentér tidsvinduet (importen kigger kun 7 dage tilbage på `lastModifiedTime`).
- **C:** noget tredje → rapportér før der ændres noget.

Jeg rapporterer fundet til dig, inkl. hvilken klient/kampagne salgene korrekt hører under, **før** trin 2 udføres.

### Trin 2 – Hent kun de to salg
En engangs-edge-funktion `adversus-import-single-sale` der:
- tager en eksplicit liste af Adversus `sale_id` (max de to) + valgfrit `client_campaign_id`-override som input,
- henter netop de sale/lead-poster fra Adversus API,
- kører dem gennem den **eksisterende** `processSales` fra `integration-engine/core/sales.ts`, så pricing, `sale_items`, provision og omsætning bliver dannet præcis som ved normal sync,
- har en hård guard: skriver kun rækker hvis `adversus_external_id` er i den medsendte liste; ingen sletning, ingen opdatering af øvrige salg, ingen rematch af andre rækker,
- returnerer en rapport (hvad blev indsat, hvilken klient, hvilken provision).

### Trin 3 – Verifikation
- `select` på de to salg + deres `sale_items` (produkt, `mapped_commission`, `mapped_revenue`).
- Kontrol af at antal TDC Erhverv-salg i perioden kun er steget med 2, og at ingen andre rækkers `updated_at` er ændret.

### Ikke i scope (kræver din beslutning)
- Rettelse af Lukas' team/klient-tilknytning i Stork.
- Ændring af Eesy TM-state-filteret eller de 7 dages lookback i importen.

## Teknisk note om zoner
Trin 1 er ren læsning. Trin 2 rører pricing/provision-området (rød zone) via en ny, isoleret funktion – uden ændringer i `pricing-service.ts`, `sales.ts` eller andre delte filer. Jeg beder om din godkendelse af årsagsforklaringen efter trin 1, før der skrives data.
