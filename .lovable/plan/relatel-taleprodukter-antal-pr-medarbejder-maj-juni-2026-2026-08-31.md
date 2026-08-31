# Relatel taleprodukter — antal pr. medarbejder (maj + juni 2026)

Excel-udtræk med antal solgte taleprodukter på Relatel, opgjort pr. medarbejder og pr. måned. Ingen provision eller omsætning i filen.

## Hvad der tælles

Bekræftet i databasen: Relatel-produkter i maj/juni har navne der matcher din liste 1:1 (fx `Fri Tale - 60 GB BTL #3`, `5 GB - 1 Time ATL`). "Fri Fri" = `Fri Tale - 2000 GB`.

Med i optællingen — alle produkter på Relatel hvis navn starter med `Fri Tale -` (10/30/60/1000/2000 GB, ATL/BTL og alle #-varianter) plus `5 GB - 1 Time ATL/BTL`.

Ude: MBB (mobilbredbånd), Switch, Omstillingsbruger, Datadeling, Mobilfeatures, M2M, Smartwatch e-sim, Contact Center, Bruger +/uden MV.

Faktisk solgt i perioden (samlet antal, alle sælgere): 60 GB BTL #3 = 223, 60 GB BTL #5 = 126, 1000 GB ATL = 87, 1000 GB BTL #2 = 87, 60 GB ATL = 83, 10 GB BTL = 77, 30 GB BTL #2 = 73, 10 GB ATL = 58, 30 GB BTL #3 = 34, 1000 GB BTL #4 = 20, 5 GB-1 Time ATL = 14, 30 GB ATL = 13, 5 GB-1 Time BTL = 10, 10 GB BTL #2 = 9, 2000 GB ATL = 4, 2000 GB BTL = 1. Varianter fra din liste uden salg i perioden (fx Fri Fri BTL #2/#4/#5/#6) vises som 0.

## Metode

- Periode: kalendermåneder maj (1.–31.) og juni (1.–30.) 2026 på `sale_datetime`.
- Kilde: `sales` + `sale_items` for Relatel-klienten, afviste salg (`validation_status = 'rejected'`) ekskluderet.
- Antal = `sum(sale_items.quantity)`.
- Medarbejder findes via `sales.agent_email` → `employee_agent_mapping`/`employee_master_data`; sælgere uden match vises med rå agent-e-mail, så intet salg forsvinder.

## Filens indhold

1. `Maj 2026` — én række pr. medarbejder, én kolonne pr. produkt, total-kolonne.
2. `Juni 2026` — samme opbygning.
3. `Samlet` — maj + juni pr. medarbejder pr. produkt.
4. `Kontrol` — totaler pr. produkt pr. måned til afstemning.

Ren læsning af data. Ingen ændringer i kode, database eller løndata.
