# Plan: Få salg fra "Tjenestetorvet - Premium" (Adversus-kampagne 114001) ind i systemet

## Rod-årsag (kort)

Salgene findes i Adversus på campaign id `114001` ("Tjenestetorvet - Premium"). De kommer ikke ind i Stork fordi der ikke findes nogen række i `adversus_campaign_mappings` med `adversus_campaign_id = '114001'`. Integration-engine henter selve salget fra Adversus, men uden mapping får sale'n ingen `client_campaign_id` → ingen klient-attribution, ingen pricing, ingen provision.

Vi løser det uden at hardkode `114001` nogen steder. Vi bruger den eksisterende oprettelses-UI i MgTest, og bagefter triggerer vi en backfill via den eksisterende safe-backfill UI.

## Hvad vi gør

1. **Opret mapping via eksisterende UI (ingen kodeændring).**
   I MgTest → fanen "Kampagner" → "Opret kampagne":
   - Navn: `Tjenestetorvet - Premium`
   - Klient: Eesy TM (samme klient som de øvrige Tjenestetorvet-kampagner kører under)
   - Externt ID: `114001`
   Dette inserter både en `client_campaigns`-række og en `adversus_campaign_mappings`-række med `adversus_campaign_id = '114001'`. Ingen ny kode, ingen konstant.

2. **Verificér pricing-dækning.**
   Tjek at de produkter der sælges på kampagnen er dækket af eksisterende `product_pricing_rules`. Hvis en regel har `campaign_mapping_ids` sat (include-mode) og 114001 ikke er med, skal mappingen tilføjes på reglen via MgTest → produkt → "Pricing-regler". Universelle regler (ingen `campaign_mapping_ids`) matcher automatisk.

3. **Backward sync via eksisterende UI.**
   Settings → Dialer Integrations → Adversus/Eesy TM-integrationen → "Sync date range" → kør safe-backfill fra første kendte salgsdato på kampagnen (Christoffer Forman havde et salg 22.05.2026 kl. 10:41) → i dag. Dette puller historiske salg fra Adversus, mapper dem mod den nye `client_campaign_id`, og kører pricing-match.

4. **Rematch pricing (hvis trin 3 ikke gør det automatisk).**
   Hvis salgene kommer ind uden mapped provision/revenue: kør "Rematch pricing rules" fra MgTest på de berørte produkter.

5. **Verificér i Sales Overview / dagsrapport for 22.05.2026** at Christoffer Formans manglende salg på `1006478073` nu fremgår.

## Hvad vi IKKE gør

- Vi tilføjer ikke `114001` som konstant i nogen `.ts`-fil.
- Vi rører ikke `EesyTmAdapter`, `pricing-service.ts`, `permissionKeys.ts` eller andre rød zone-filer.
- Vi laver ingen migrations.
- Vi opretter ingen ny UI — alt findes allerede (MgTest "Opret kampagne" + Settings "Sync date range").

## Risiko

Grøn. Ren data-indtastning + brug af eksisterende safe-backfill (budget-aware). Ingen kodeændring.

## Åbent spørgsmål før vi går videre

Er Eesy TM den rigtige klient til "Tjenestetorvet - Premium", eller skal den ligge under en anden klient (fx ny "Tjenestetorvet Premium"-klient eller eksisterende Tjenestetorvet-klient hvis sådan en findes)? Dette afgør valg af klient i trin 1 og kan ikke gættes — se Bibel §7.
