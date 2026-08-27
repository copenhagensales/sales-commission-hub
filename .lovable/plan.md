# Plan: Udfyld Medarbejder og Provision på Tryg-modregninger

## Mål
Udfyld kolonnerne "Medarbejder" og "Provision" i `trygmodregninger.xlsx` (48 telefonnumre) ved at matche nummeret mod Tryg-salg i Stork. Rækkefølgen af rækker bevares 1:1.

## Matchning
- Telefonnumre normaliseres på begge sider: alt ikke-numerisk fjernes, og der sammenlignes på de sidste 8 cifre. Det håndterer `+45`, `0045`, `00 45`, mellemrum og bindestreger foran nummeret.
- Der søges i `sales.customer_phone`, med fallback til nummeret i `raw_payload` for salg hvor kundetelefonen ikke er udfyldt.
- Kun salg på Tryg-klienten tælles med. Har et nummer flere Tryg-salg, bruges det nyeste.

## Provision
- Provision = sum af `sale_items.mapped_commission` for det valgte salg.
- Salg med `validation_status = 'rejected'` udelades.

## Medarbejder
- Sælgernavn findes via salgets `agent_email` / `agent_external_id` → `agents` → `employee_agent_mapping` → `employee_master_data`, med `work_email`-fallback (samme kæde som øvrige rapporter).

## Ingen match
- Numre uden Tryg-salg får "Ikke fundet" i Medarbejder og tom Provision, så manglende match ikke forveksles med 0 kr.
- Findes nummeret som salg på en anden klient end Tryg, noteres det i Medarbejder-feltet (fx "Ikke fundet (salg på anden klient)"), så det er tydeligt hvorfor feltet er tomt.

## Leverance
- `trygmodregninger_udfyldt.xlsx` i dokumentmappen — samme kolonner og rækkefølge som din fil, med Medarbejder og Provision udfyldt.
- Kort opsummering: antal matchede numre, antal uden match, samlet provision.

## Bemærkning
Ingen data i Stork ændres — dette er et rent læse-udtræk.
