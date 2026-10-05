# Tryg - Ret salg: kolonne for gældende regel + ret mødetype

## Hvad sælgeren/lederen ser
- Ny kolonne **"Regel"** efter "Produktnavn" på alle tre faner (United-salg, Kanvas-møder, Alle tryg & alka salg). Den viser navnet på den prisregel, der er brugt på salget, fx "Onlinemøde" eller "Tlfmøde". Har salget ingen regel, står der "—".
- I **Ret**-dialogen kommer et nyt felt **"Regel"**. Det vises kun, når produktet har regler for mødetype, i dag Lederne, Partnersalg FDM og Partnersalg Finansforbundet. Man vælger mellem produktets aktive mødetype-regler.
- Når man gemmer, genberegnes provision og omsætning med det samme, og de nye beløb vises i rapporter og løn.

## Sådan virker det i dag (tjekket)
- Hver salgslinje gemmer, hvilken regel der er brugt (`sale_items.matched_pricing_rule_id`). Uge-tal: Lederne 934 online/51 tlf., FDM 346/104, Finansforbundet 52/10.
- Reglen vælges af prismotoren (`rematch-pricing-rules`) ud fra mødetypen på salget:
  - Lederne: `raw_payload.data["Hvilket type møde"]`
  - Main-kontoen (FDM/Finansforbundet): `raw_payload.leadResultFields["Hvilken type møde"]`. Det felt vinder over `data`.
- Ret-funktionen (`useUpdateUnitedSale`) kører allerede genberegning, når produkt eller dato ændres.

## Ændring
1. **Hentning:** alle tre faner henter også regelnavnet med via salgslinjens regel. Hver fanes hook udvides med regelnavnet; der kommer ingen nye direkte kald fra komponenterne.
2. **Ret-dialog:** henter produktets aktive regler, der har en betingelse på mødetype. Man vælger en regel, og vi skriver reglens egen betingelsesværdi ind i salget under præcis den nøgle, reglen bruger.
   - Er feltet `leadResultFields` på salget, skrives værdien også dér, så det ikke overstyrer.
   - Den oprindelige dialer-værdi bevares i `raw_payload.manual_override` med tidspunkt og hvem der rettede den. Historikken går derfor ikke tabt.
3. **Genberegning:** den eksisterende kørsel af `rematch-pricing-rules` for den ene salgslinje udløses også, når reglen ændres. Bagefter tjekkes det, at linjen faktisk fik den valgte regel. Ellers får man en tydelig fejl, så salget ikke fejlagtigt ser rettet ud.
4. Ingen ændring i prismotoren, prisreglerne, databasen eller adgang. Rettigheden er den samme som i dag for Ret.

## Risici og åbne punkter
- **Fejl i prisregel (rettes ikke her):** Finansforbundets "Tlfmøde"-regel har betingelsen `Hvilken type møde = Telefonnummer`, ikke "Telefonmøde". Hvis man vælger den regel, skrives værdien "Telefonnummer" på salget. Det matcher reglen, men er en fejl i reglen, som bør rettes i MG Test for sig.
- **Dialeren kan overskrive rettelsen:** Lederne-hentningen opdaterer salg løbende. En senere hentning kan derfor skrive dialerens mødetype tilbage. Det tjekker jeg i hentningskoden før bygning. Gør den det, bliver rettelsen beskyttet, så den ikke overskrives.
- Provision ændres på enkeltsalg. Det er tilsigtet, men det rammer lønnen for den aktuelle periode.

## Test
- Ret et Lederne-salg fra Onlinemøde til Tlfmøde: provisionen skal gå fra 90 til 30 kr., og kolonnen skal vise "Tlfmøde".
- Ret et FDM-salg: provisionen skal gå fra 100 til 50 kr.
- Ret tilbage igen: de oprindelige beløb skal komme tilbage.
- Et produkt uden mødetype-regler må ikke vise feltet.
