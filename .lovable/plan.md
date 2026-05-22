# Plan: Mappe Adversus-kampagne 114001 ("Tjenestetorvet - Premium") + bagudrettet sync

## Rod-årsag

Salgene findes i Adversus på campaign id `114001` ("Tjenestetorvet - Premium"). De kommer ikke ind i Stork fordi der ikke findes en række i `adversus_campaign_mappings` med `adversus_campaign_id = '114001'`. Uden mapping får sale'n ingen `client_campaign_id` → ingen klient-attribution, ingen pricing, ingen provision til sælger.

`114001` skal ikke hardkodes nogen steder i koden. Vi bruger den eksisterende "Opret kampagne"-UI i **MgTest → fanen Kampagner**, og den eksisterende safe-backfill UI i **Settings → Dialer Integrations**.

## Trin

1. **Opret mapping via MgTest UI** (ingen kodeændring):
   - Navn: `Tjenestetorvet - Premium`
   - Klient: Eesy TM (samme som de øvrige Tjenestetorvet-kampagner)
   - Externt ID: `114001`
   - Dette inserter en `client_campaigns`-række + en `adversus_campaign_mappings`-række.

2. **Verificér pricing-dækning** for de produkter der sælges på kampagnen.
   Hvis nogen `product_pricing_rules` har `campaign_mapping_ids` sat i include-mode uden 114001, tilføj mappingen på reglen via MgTest → produkt → "Pricing-regler". Universelle regler (ingen `campaign_mapping_ids`) matcher automatisk.

3. **Trig bagudrettet sync** via eksisterende UI:
   - Settings → Dialer Integrations → Adversus/Eesy TM → menu → "Sync date range"
   - Fra: 22.05.2026 (første kendte salg på kampagnen — Christoffer Forman kl. 10:41)
   - Til: i dag
   - Kører safe-backfill (budget-aware) via `integration-engine` action `safe-backfill`.

4. **Verificér** at Christoffer Formans salg på lead `1006478073` (telefon 42 41 55 80) nu fremgår i Sales Overview + dagsrapporten for 22.05.2026 med korrekt provision/revenue.

## Hvad jeg IKKE rører

- Ingen kodeændringer i denne omgang. UI'en findes allerede begge steder.
- `EesyTmAdapter`, `pricing-service.ts`, `permissionKeys.ts` og øvrige rød zone-filer røres ikke.
- Ingen migrations.
- Ingen konstant for `114001` i nogen `.ts`-fil.

## Min rolle vs. din rolle

Jeg kan ikke selv klikke i UI'en. Du udfører trin 1-3 (eller siger til hvis du vil have mig til at insert mapping direkte i DB via `supabase--insert` — det er stadig data, ikke kode). Jeg verificerer i trin 4 ved at læse fra databasen.

## Åbent spørgsmål

Skal jeg sætte mappingen op til Eesy TM-klienten, eller skal "Tjenestetorvet - Premium" ligge under en separat/ny klient? Eesy TM er default-antagelsen baseret på de øvrige Tjenestetorvet-kampagner — bekræft eller korrigér.
