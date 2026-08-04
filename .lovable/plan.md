# Svar: er det kun aktive produkter der vises og registreres nu?

Ja. Verificeret i både kode og database.

## Visning (Eesy FM: marked, coop/gaden og callbacks)

Salgsregistreringen henter listen via RPC'en `get_fm_registration_products(p_campaign_id)`, som kun returnerer produkter med `is_active = true`, og dedupliker på navn. Callback-mode bruger samme liste som normal registrering — der er ikke to kodestier. Så en inaktiv række kan ikke vælges af en sælger nogen steder.

## Registrering (satsen på salget)

Triggeren `create_fm_sale_items()` slår produktet op med:

```text
WHERE lower(trim(name)) = lower(trim(fm_product_name)) AND is_active = true
```

Filteret `is_active = true` betyder at en inaktiv række heller ikke kan rammes af navneopslaget — heller ikke ved navnesammenfald. Prisreglerne læses derefter kun på den aktive række, der blev fundet.

## Har de inaktive produkter en funktion nu?

Nej, ud over historik:

- De er stadig `product_id` på eksisterende `sale_items`. Dagsrapporter, lønperioder og ledelsesrapporter for tidligere perioder læser dem. Derfor må de aldrig slettes.
- De kan ikke vælges af sælgere.
- De kan ikke rammes af trigger-matchingen på nye salg.
- Deres eventuelle prisregler er dermed uden effekt fremadrettet (reglerne ligger stadig på rækken, men rækken bliver ikke matchet).

Den tidligere funktion — at deaktivering blev brugt som tie-breaker, så navneopslaget ramte den "rigtige" række — er nu erstattet af at listen og matchingen begge er `is_active`-bevidste. `is_active` betyder derfor kun én ting igen: "må ikke sælges mere".

## Eneste undtagelse i data i dag

"5G Internet" findes stadig aktiv på både Eesy gaden og Eesy marked. Begge har basispris 300/650, og gaden-rækkens regler giver også 300/650 for begge kampagner, så satsen er identisk uanset hvilken række der rammes. Ingen fejlpriser — men det er den ene dublet der stadig er aktiv to steder. Du har valgt kun analyse på den, så der er ikke ændret noget.
