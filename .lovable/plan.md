# Plan: Udfyld Medarbejder og Provision på nyt Tryg-modregningsark

## Mål
Udfyld kolonnerne "Medarbejder" og "Provision" i `trygmodregningerflere.xlsx` (95 telefonnumre) ved at matche nummeret mod Tryg-salg i Stork. Rækkefølgen bevares 1:1.

## Matchning
- Telefonnumre normaliseres på begge sider: alt ikke-numerisk fjernes, og der sammenlignes på de sidste 8 cifre (håndterer `+45`, `0045`, mellemrum, bindestreger).
- Der søges i `sales.customer_phone` med fallback til nummeret i `raw_payload`.
- Kun salg på Tryg-klienten tælles. Har et nummer flere Tryg-salg, bruges det nyeste.

## Provision
- Provision = sum af `sale_items.mapped_commission` for det valgte salg.
- Salg med `validation_status = 'rejected'` udelades.

## Medarbejder
- Sælgernavn via salgets `agent_email` / `agent_external_id` → `agents` → `employee_agent_mapping` → `employee_master_data`, med `work_email`-fallback.

## Ingen match
- Numre uden Tryg-salg får "Ikke fundet" og tom Provision.
- Findes nummeret som salg på anden klient, noteres "Ikke fundet (salg på anden klient)".

## Leverance
- `trygmodregningerflere_udfyldt.xlsx` i dokumentmappen — samme kolonner og rækkefølge.
- Kort opsummering: antal matchede, antal uden match, samlet provision.

## Bemærkning
Rent læse-udtræk. Ingen data i Stork ændres.
