## Bekræftet med dig

- YouSee har ingen marked-provision. Sælgerne skal bare kunne vælge "Yousee gaden"-produkter (440 kr base) når de står på en delt stand med Eesy.
- Eesy gade/marked-skellet skal IKKE røres — det gælder kun internt i Eesy.

## Evidens (verificeret)

- `client_campaigns` for YouSee: kun "Yousee gaden" og "Yousee Products" (TM). Ingen marked-kampagne.
- 16 YouSee gaden-produkter, alle base 440 kr provision, **0 aktive pricing rules** → ingen marked-pris findes overhovedet.
- `enrich_fm_sale`-trigger sætter `sales.client_campaign_id` ud fra **det valgte produkts** kampagne, ikke bookingens. → Et YouSee gaden-produkt valgt på en Eesy marked-booking afregnes som "Yousee gaden" 440 kr. Korrekt.

## Plan

Kun frontend, kun `src/pages/vagt-flow/SalesRegistration.tsx`. Ingen DB-, trigger- eller pricing-motor-ændring.

1. **Udvid produkt-query** (linje 253-274) så den henter to grupper:
   - **Primær:** `WHERE client_campaign_id = booking.campaign.id` (uændret).
   - **Cross-client:** `WHERE client_id IN (sælgerens tilknyttede klienter) AND client_id != booking.client_id`.

   Sælgerens klienter hentes via `employee_client_assignments` (samme kilde som `useEmployeeClientAssignments`).

2. **Sikkerhedsregel i query:** cross-client-listen tilføjer ALDRIG produkter hvor `client_id = booking.client_id`. Det beskytter Eesy gade/marked — en Eesy-sælger kan ikke pludselig vælge Eesy gaden-produkt på en Eesy marked-booking via fallback.

3. **UI:** to sektioner i produktvælgeren:
   - "Produkter" (primær)
   - "Andre klienter på standen" (cross-client) — kun synlig hvis listen ikke er tom.

4. **Verificér efter deploy:**
   - YouSee-sælger på Eesy marked-stand → ser Yousee gaden-produkter under "Andre klienter".
   - Vælger ét → tjek `sales.client_campaign_id = 743980b0…` (Yousee gaden) og `mapped_commission = 440`.
   - Eesy-sælger på Eesy marked-stand → ser KUN Eesy marked-produkter (uændret, ingen Eesy gaden via fallback).

## Zone

Gul. `SalesRegistration.tsx` er ikke i §4 rød zone. Pricing-motor og trigger røres ikke. Ramme-aftalen for "fix YouSee FM produktvalg" dækker filen.

Sig "kør" så implementerer jeg.
