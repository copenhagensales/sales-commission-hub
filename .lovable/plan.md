# Plan: Eesy FM marked-pricing — quick-fix + permanent fix

## Baggrund (evidens)

- 104 salg på 14/5 (Lillebælt plads 1+2, Sindal Marked) fik gade-pris (360 kr) i stedet for marked-pris (295 kr).
- Rod-årsag: De 3 bookings havde `campaign_id = NULL`. Fallback i `SalesRegistration.tsx:250-327` matchede både "Eesy marked" og "Eesy gaden" produkter via `name ILIKE '%<brand>%'`, så sælgeren så blandet produktliste.
- På Dølle 30/4 var `booking.campaign_id = "Eesy marked"` korrekt sat → kun marked-produkter blev vist → korrekt pris.
- Dette er en **registrerings-/data-integritetsfejl**, ikke et pricing-engine problem.

---

## Del 1 — Quick-fix på 14/5 (rød zone: pricing-data)

Tre trin, godkendes som én pakke:

1. **Opdater 3 bookings** (`bookings`-tabellen) for 14/5:
   - Lillebælt plads 1, Lillebælt plads 2, Sindal Marked → sæt `campaign_id` til "Eesy marked"-kampagnen.
2. **Opdater 104 salgs `client_campaign_id`** fra "eesy FM Gaden Products" → "Eesy marked" på de berørte salg fra 14/5 på disse 3 lokationer.
3. **Kør `rematch-pricing-rules`** for de 104 salg → genberegner `mapped_commission` og `mapped_revenue` til marked-pris (295 kr).

**Forventet effekt:** ~−6.760 kr i provision (marked-pris er lavere end gade-pris). Ingen anden data berøres.

**Sikkerhed:** Quick-fix udføres via `supabase--insert` (UPDATE) med præcise WHERE-klausuler på dato + lokation + agent. Før vi kører noget: jeg viser dig SQL'en og det eksakte antal rækker der rammes, så du kan bekræfte.

---

## Del 2 — Permanent fix (gul zone: FM-booking UI + validering)

Mål: Det skal være **umuligt** at oprette en FM-booking uden `campaign_id`, og fallback-logikken skal stoppe i stedet for at gætte.

### 2A. Frontend — krav om kampagne ved oprettelse af FM-booking

- I FM booking-dialogen (vagtplan/booking flow): gør `campaign_id` til **påkrævet felt** med synlig validering.
- Hvis lokationen har `type = 'marked'` → forfilter dropdown til marked-kampagner for det valgte brand. Tilsvarende for gade.
- Disabler "Gem"-knap indtil kampagne er valgt.

### 2B. SalesRegistration fallback — fail-loud i stedet for fail-silent

I `SalesRegistration.tsx:250-327`:
- Hvis `booking.campaign_id` er NULL → vis fejl-besked til sælger ("Booking mangler kampagne — kontakt teamleder") i stedet for at vise blandet produktliste.
- Forhindrer at salget overhovedet kan oprettes på en defekt booking.

### 2C. DB-niveau backstop (foreslået, beder om bekræftelse)

To muligheder — vælg én i opfølgning:
- **(i)** NOT NULL constraint på `bookings.campaign_id` for FM-bookings (kræver oprydning af eksisterende NULL-rækker først).
- **(ii)** Kun trigger-validering: trigger der blokerer INSERT/UPDATE hvis FM-booking har NULL campaign.

Default-anbefaling: **(ii) trigger** — mindre risiko for at bryde historiske data.

---

## Rækkefølge & rapportering

1. Jeg leverer SQL til Del 1 (trin 1+2) som forhåndsvisning. Du godkender.
2. Jeg eksekverer UPDATE'erne via insert-tool og kører rematch.
3. Jeg implementerer 2A + 2B (kode-ændringer i FM-booking + SalesRegistration).
4. Jeg leverer migration til 2C-trigger separat til godkendelse (rød zone: DB-skema + pricing-relateret).

Hver del = én commit, færdig-rapport med hash, filer og linjeantal.

---

## Filer i scope

- **Del 1:** Ingen kodefiler — kun data-UPDATE + edge function-call (`rematch-pricing-rules`).
- **Del 2A:** FM booking-dialog komponent (jeg lokaliserer og bekræfter præcis fil før ændring).
- **Del 2B:** `src/pages/.../SalesRegistration.tsx` (linjer 250-327).
- **Del 2C:** Ny migration med validation-trigger på `bookings`.

## Åbne spørgsmål før start

1. Bekræft "Eesy marked" som korrekt target-kampagne for de 3 bookings.
2. Skal Del 2C implementeres som trigger (ii) eller NOT NULL (i)?
3. Skal fail-loud i 2B også gælde TM-bookings, eller kun FM?