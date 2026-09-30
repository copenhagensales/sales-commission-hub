# Kurvnummer i stedet for telefonnummer på YouSee-fiberprodukter

## Hvad sælgerne får
På Fieldmarketing-salgsregistrering beder formularen om **"Kurvnummer \*"** i stedet for "Telefonnummer \*" når produktet er et af de tre nye YouSee-fiberprodukter (kampagne "Yousee gaden"):
- Fibernet Alm.
- Fibernet Lead
- Fibernet Lead luk

Alle andre produkter, kampagner og kunder beder fortsat om telefonnummer. Kurvnummeret er et fritekst-/tal-felt uden formatkrav (format ukendt), men skal være udfyldt.

## Hvor kurvnummeret gemmes
I sit eget felt på salget. Telefonfeltet står tomt for fibersalg, så kurvnumre ikke blandes ind i telefon-baseret annullerings- og dubletmatch.

## Teknisk
- Produkterne identificeres på deres faste produkt-id'er (ikke navnet "fiber"), så fiber på andre kunder/kampagner ikke rammes:
  `aff60b59-d602-4c2d-bcc5-3e3fb9ac5d72`, `7582017c-249b-415d-be91-dace0039c9e4`, `758af7d2-fee7-477c-bad7-2c8a40485c70`. Samlet i én konstant (`src/config/fmBasketNumberProducts.ts`).
- `src/pages/vagt-flow/SalesRegistration.tsx`: pr. valgt produkt vises label/placeholder "Kurvnummer" (type text) for disse id'er; valideringsbesked tilpasses ("Udfyld alle telefon-/kurvnumre"). Overskriften bliver "Telefon-/kurvnumre" når der er blandede produkter. Værdien sendes som `basket_number` i stedet for `phone_number`.
- `src/hooks/useFieldmarketingSales.ts` (`useCreateFieldmarketingSale`): nyt valgfrit `basket_number`; når sat gemmes det i `raw_payload.fm_basket_number` og `customer_phone` sættes til `null`. Ingen DB-migration (raw_payload er JSON).
- Ingen ændring af pricing, `enrich_fm_sale`, `create_fm_sale_items`, løn eller RLS. Provision/omsætning beregnes som i dag ud fra produktet.

## Ikke med i denne omgang
- Visning/redigering af kurvnummer i "Ret salgsregistreringer" og rapporter (kan tilføjes bagefter, hvis ønsket).
- Formatvalidering — når formatet kendes, kan det tilføjes.
