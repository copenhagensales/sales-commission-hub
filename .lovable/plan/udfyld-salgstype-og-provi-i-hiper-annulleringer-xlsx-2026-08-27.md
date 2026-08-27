# Udfyld Salgstype og Provi i Hiper_annulleringer.xlsx

Arket har 37 linjer med `order_date`, `user_name`, `customer_id`, `phone_no`, `product_status`, `cancel_date` og de tomme kolonner `Salgstype` og `Provi`.

## Bekræftet i data

- Hiper-salg ligger under klienten Hiper, og Hipers `customer_id` er gemt i `sales.customer_phone` (fx `418367`, `410068`) — ikke i telefonfeltet trods navnet.
- Salgstypen står som produkt: `Hiper Lukning` (200 kr provision) eller `Hiper Viderestilling` (400 kr provision), hentet fra `sale_items.mapped_commission`.
- Et `customer_id` har typisk to salg: én lukning og én viderestilling, med forskellige sælgere (fx 410068: Silas = lukning, Mosawer = viderestilling). Samme sælger kan også have begge (fx 412137).

## Regler for udfyldning

- Match udelukkende på `customer_id` mod Hiper-salg. Alle andre klienter ignoreres.
- `Salgstype` = "Hiper lukning" eller "Hiper viderestilling" ud fra produktet på det salg der tilhører sælgeren i `user_name`.
- `Provi` = den provision (`mapped_commission` × antal) sælgeren i `user_name` faktisk har fået på det `customer_id`.
- Findes der to sælgere på samme `customer_id`, tilføjes en ny linje umiddelbart under: alle øvrige felter genbruges uændret, og `user_name` sættes til den anden sælger med dennes salgstype og provision.
- Har samme sælger både lukning og viderestilling på samme `customer_id`, oprettes ligeledes én linje pr. salgstype.
- Navne matches via Stork's identitetsopslag (agent-mapping → medarbejdernavn), så forkortede navne i arket (fx "Sebastian Petersen" = "Sebastian Viktor Bangsbo Petersen") rammer rigtigt.
- Rækkefølgen af de oprindelige linjer bevares. Linjer uden match markeres "Ikke fundet" i Salgstype og tom Provi — de listes eksplicit i svaret.

## Levering

Nyt ark `Hiper_annulleringer_udfyldt.xlsx` med de udfyldte og tilføjede linjer. Ingen ændringer i kodebasen eller databasen — kun læsning og generering af regnearket.
