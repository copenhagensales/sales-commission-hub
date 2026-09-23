# Lederne: bulk-upload har dublet-registreret salg som API'en allerede havde hentet

## Hvad jeg fandt (verificeret i databasen)

Ja — mistanken holder. Der ligger **314 dobbelt-registrerede Lederne-salg**, hvor det samme emne både er hentet automatisk af den nye API-synkronisering og indlæst igen manuelt via bulk-uploaden.

- Samlet på Lederne-produktet: 3.501 manuelle salg og 383 API-salg (API startede 17/9).
- Overlap på emne-id (Adversus lead-id): 314 emner findes i begge veje → 628 rækker i alt.
- Dobbelt provision: **27.420 kr.** og 62.800 kr. omsætning, fordelt på fire sælgere:
  - chgo@: 81 salg / 7.050 kr.
  - flk@: 76 salg / 6.600 kr.
  - jeph@: 78 salg / 6.780 kr.
  - noto@: 79 salg / 6.990 kr.
- Salgsdatoerne ligger 18/9–23/9: **alle 314 ligger efter 14/9**, altså i den igangværende lønperiode (15/9–14/10). Ingen af dem ligger i perioden 15/8–14/9 eller tidligere, så der er ikke udbetalt dobbelt provision. Ingen af dubletterne er brugt i provisionsposteringer eller annulleringskøen, så de kan fjernes uden at røre historik.
- Dagens upload (191 manuelle rækker) er **100 % dubletter**.

## Hvorfor dublettjekket ikke fangede det

Bulk-importens dublettjek slår kun op i salg med kilde `manual_entry` og sammenligner på telefonnummer og `subject_id`. API-salgene har kilden `adversus_lederne`, **intet telefonnummer** (renset af GDPR-filteret) og gemmer emne-id'et som `lead_id` i stedet for `subject_id`. Derfor er de to veje usynlige for hinanden — tjekket kan aldrig finde et match, uanset hvor mange gange filen uploades.

## Fejlrettelse

### 1. Ryd op i de 314 dubletter
Slet de manuelle dubletter (API-rækken er den nyeste sandhed og fortsætter fremad). API-rækkerne bevares uændret. Sletningen dækker `sale_items` + `sales` for netop de 314 salg — udvalgt på emne-id-overlap, ikke på dato — og verificeres før og efter med optælling af provision pr. sælger.

### 2. Luk hullet i bulk-importen
Dublettjekket udvides til at kigge på **alle** salg på Lederne-kampagnen, uanset kilde, og til at matche emne-id mod både `raw_payload.subject_id` og `raw_payload.lead_id`. Telefon-tjekket bevares uændret som i dag (virker kun mod manuelle salg, da API-salg ikke har nummer). Fejlteksten bliver "Dublet: emnet er allerede hentet automatisk", så det er tydeligt hvorfor rækken afvises.

### 3. Vejledning på fanen
Kort note på Bulk Salg-fanen: salg fra 17/9 og frem hentes automatisk — bulk-upload bruges kun til perioder før det, eller til rækker API'en ikke fangede.

## Teknisk

- `supabase/functions/manual-sales/index.ts` (`bulk_import`): fjern `.eq("source", "manual_entry")` i dedupe-hentningen; opsaml emne-nøgler fra både `subject_id` og `lead_id` i samme `existingSubjects`-sæt; behold paginering, telefonnormalisering, navneopslag, pricing og insert-logik uændret.
- `src/pages/TastSelvSalg.tsx`: ny linje i vejledningen. Ingen ændring i validerings- eller importflow.
- Oprydningen kører som en engangs-SQL (ingen migration, ingen skemaændring). Ingen ændringer i `pricingRuleMatching.ts`, `rematch-pricing-rules`, `_shared/pricing-service.ts`, RLS eller lønberegning.
- Risiko efter oprettelse: ingen — lønnen for perioden er ikke lukket, og de slettede rækker havde ingen provisionsposteringer.

## Verifikation

- Optælling af Lederne-salg pr. kilde og provision pr. sælger før/efter sletning (forventet: 3.187 manuelle, 383 API, 27.420 kr. mindre i provision).
- Ny tør-kørsel af samme fil efter kodeændringen: forventet 0 klar og alle rækker markeret som dublet.
- Typekontrol.
