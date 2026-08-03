# Hvorfor kun "5G Internet" vises på Eesy marked — og hvordan satsen faktisk findes

## Sådan finder Stork satsen (verificeret)

FM-salg gemmer kun produktets **navn** i `raw_payload.fm_product_name`. Triggeren `create_fm_sale_items()` gør så tre ting:

```text
1. Find produkt:   WHERE lower(trim(name)) = lower(trim(fm_product_name)) AND is_active = true
                   (ingen filtrering på kampagne)
2. Find prisregel: product_pricing_rules for det produkt-id, hvor salgets kampagne-mapping
                   findes i campaign_mapping_ids   -> kampagnespecifik sats
3. Fallback:       universel regel uden kampagne, ellers produktets basispris
```

Satsforskellen mellem gaden og marked ligger altså i **prisregler på gaden-produkterne**, ikke i to sæt produkter. Hver af de aktive Eesy gaden-rækker har præcis to regler:

```text
Eesy uden første måned (IKKE Nuuday)   regel -> Eesy gaden mapping   450 / 1000
                                       regel -> Eesy marked mapping  385 / 1000
Eesy med første måned (IKKE Nuuday)    regel -> gaden 430 / marked 355
Eesy med første måned (Nuuday)         regel -> gaden 335 / marked 280
Eesy uden første måned (Nuuday)        regel -> gaden 360 / marked 295
5G Internet                            regel -> gaden 300 / marked 300
```

De 8 produkter på kampagnen **Eesy marked** har **ingen prisregler overhovedet**, og deres basispriser er identiske med gaden-satserne (430/335/450/360). Derfor:

- Da marked-rækkerne var aktive, kunne triggeren ramme dem via navneopslaget. Uden regler faldt den tilbage på basisprisen = gadesatsen. Det er præcis Vorbasse-fejlen ("COOP provi i stedet for markedsprovi").
- Den 11. marts 2026 blev de fire marked-rækker sat inaktive. Det var ikke tilfældigt — det var fixet: det tvinger navneopslaget over på gaden-rækken, som har den kampagnestyrede markedssats.

Opsætningen var altså bevidst. Problemet er at `is_active` derved bærer to betydninger, og produktlisten til sælgerne er hårdt bundet til bookingens kampagne (`SalesRegistration.tsx:252-273`: `client_campaign_id = booking.campaign.id` + `is_active = true`). Resultatet er at en marked-booking kun har én aktiv række tilbage: 5G Internet.

## Afstemning mod din liste — 3 satser stemmer ikke

Ændringen flytter kun hvilke produkter sælgeren kan vælge; den ændrer ingen satser. Reglerne i dag giver:

```text
Produkt                                  COOP/gaden          Marked
                                         DB    liste         DB    liste
Ikke nuuday uden første måned            450   450  ok       385   385  ok
Ikke nuuday med første måned             430   430  ok       355   365  AFVIGER -10
Nuuday uden første måned                 360   360  ok       295   295  ok
Nuuday med første måned                  335   340  AFVIGER  280   275  AFVIGER +5
                                                     -5
5G Internet                              300   300  ok       300   300  ok
Fri 20 - 89 (KUN IKKE NUUDAY)            300   300  ok       må ikke sælges
```

Tre afvigelser skal rettes i prisreglerne, uafhængigt af denne ændring:

- "Eesy med første måned (IKKE Nuuday)", marked-regel: 355 -> 365
- "Eesy med første måned (Nuuday)", gaden-regel: 335 -> 340
- "Eesy med første måned (Nuuday)", marked-regel: 280 -> 275

Satsrettelserne tages som ét separat trin: nye regler med `effective_from`, de gamle lukkes med `effective_to`, så historikken bevares.

"Fri 20 - 89 (KUN IKKE NUUDAY)" hører kun til gaden. Den har ingen prisregler (kun basispris 300) og ligger på gaden-kampagnen, så den bliver med den nye løsning **ikke** vist på en marked-booking — ingen ekstra ændring nødvendig.



## Løsning: gør produktlisten regel-bevidst i stedet for kampagne-bundet

De inaktive marked-dubletter bliver **ikke** genaktiveret — det ville genindføre Vorbasse-fejlen. Sælgerne skal i stedet se de aktive gaden-rækker, når de står på en marked-booking, fordi det er dem der bærer markedssatsen.

1. **Ny RPC (SECURITY DEFINER), `get_fm_registration_products(p_campaign_id uuid)`**
   Returnerer `id, name` for produkter der er relevante for bookingens kampagne:
   - aktive produkter hvor `client_campaign_id = p_campaign_id`, **plus**
   - aktive produkter der har en aktiv prisregel hvis `campaign_mapping_ids` indeholder kampagnens mapping-id (`adversus_campaign_mappings.client_campaign_id = p_campaign_id`)
   - dedupliker på `lower(trim(name))` og foretræk rækken der har en regel for kampagnen. Én række pr. navn — sælgeren ser aldrig dubletter.
   - `GRANT EXECUTE` til `authenticated`.

2. **`SalesRegistration.tsx`** — erstat den direkte `products`-query med et kald til RPC'en via en ny hook `useFmRegistrationProducts(campaignId)`. Samme returform (`{id, name}[]`), så resten af siden er uændret. Gælder både normal registrering og callback-mode, da de deler listen.

3. **Ingen ændring** af `products.is_active`, af prisregler, af triggeren eller af eksisterende `sale_items`.

Efter dette ser en sælger på Eesy marked de 5 relevante produkter (5G Internet + de fire Eesy-varianter, uden dubletter), salget gemmes med navnet, og triggeren giver markedssatsen via kampagnereglen. "Eesy 99"-varianterne forbliver skjulte, fordi gaden-rækkerne for dem også er inaktive.

## Kontrol efter implementering

- Sammenlign listen for Eesy marked og Eesy gaden: begge skal vise 5 hhv. 6 produkter, ingen navnedubletter.
- Test-salg på en marked-booking skal give 385/1000 på "Eesy uden første måned (IKKE Nuuday)", ikke 450/1000.

## Påvirkning af historiske salg

Ingen. Ændringen rører kun hvilke produkter sælgeren kan vælge i registreringen. Der ændres ikke i `sale_items`, i prisregler, i `products.is_active` eller i triggeren, og intet genberegnes bagudrettet — alle historiske salg beholder deres gemte `mapped_commission`/`mapped_revenue`, så dagsrapporter, lønperioder og ledelsesrapporter for tidligere perioder står præcis som i dag. Kun salg registreret efter ændringen påvirkes.


## Zone

Rød: ny funktion i pricing-/FM-kæden. Trigger og prisregler røres ikke — kun produktudvælgelsen til sælgerens UI. Kræver din godkendelse.
