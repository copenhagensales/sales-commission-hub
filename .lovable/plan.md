# Analyse: den sidste aktive dublet "5G Internet" på Eesy FM

Ingen ændringer foretaget. Nedenstående er verificeret direkte i databasen.

## De to rækker

```text
Række                       Kampagne      is_active  basispris (provi/oms)  prisregler
1e2f6001…dcfb  5G Internet  Eesy gaden    true       300 / 650              2 (gaden 300/650, marked 300/650)
88cd756a…8a94  5G Internet  Eesy marked   true       300 / 650              0
```

Begge er aktive, har samme navn og samme basispris. Gaden-rækkens to regler giver også 300/650 for både gaden- og marked-mapping.

## Hvilken række rammer nye salg

Triggeren `create_fm_sale_items()` slår produktet op på navn med
`WHERE lower(trim(name)) = … AND is_active = true ORDER BY priority DESC NULLS LAST, created_at DESC, id DESC LIMIT 1`.

Begge rækker har `priority = 0`, så `created_at` afgør. Marked-rækken er nyere (2026-02-28 mod 2025-12-18), så **alle nye "5G Internet"-salg lander på marked-rækken** — også salg fra en gaden-booking.

Det bekræftes af data:

```text
Række (kampagne)   antal salg   første       seneste
Eesy gaden            288       2025-12-19   2026-03-30
Eesy marked           533       2026-03-26   2026-08-03
```

Skiftet 26.–30. marts 2026 er præcis hvor marked-rækken blev nyere/aktiv og overtog navneopslaget.

## Konsekvens i kroner: ingen

Marked-rækken har ingen prisregler, så triggeren falder tilbage på dens basispris 300/650. Gaden-rækkens regler giver også 300/650 for begge kampagner. Satsen er derfor **identisk uanset hvilken række der rammes** — hverken historiske eller nye salg er fejlpriset. Det er den ene dublet der ikke har givet et sats-problem, i modsætning til de øvrige Eesy-varianter.

## Reel risiko (fremadrettet, ikke aktuel)

1. Hvis satsen for 5G Internet på marked eller gaden skal differentieres, vil en regel lagt på gaden-rækken **ikke få effekt**, fordi navneopslaget vælger marked-rækken. Det er samme fælde som ved Vorbasse.
2. Rapportering pr. produkt-id splitter historikken i to rækker med samme navn (288 + 533). Aggregeres der på navn er det uproblematisk; aggregeres der på `product_id` ser det ud som to produkter.
3. `priority`/`created_at` som tie-breaker er ikke en forretningsregel — en redigering der rører `created_at` eller `priority` kan flytte matchet uden varsel.

## Mulig oprydning, hvis du vil (ikke udført)

Sæt marked-rækken `is_active = false` og læg de nødvendige regler på gaden-rækken (de findes allerede). Så:
- alle nye salg rammer gaden-rækken, som har kampagnestyrede regler,
- de 533 historiske `sale_items` beholder deres `product_id` og satser uændret,
- sælgerlisten er uændret, fordi RPC'en `get_fm_registration_products` dedupliker på navn.

Zone: rød (pricing-kæden). Kræver din eksplicitte godkendelse, og det er en migration på ét felt på én række.
