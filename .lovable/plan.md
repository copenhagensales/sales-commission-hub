# Navneliste: freelance-konsulenter

## Formål
Jeppe skal bruge navnene på de medarbejdere, der står registreret som freelance-konsulenter.

## Hvad der leveres
- En Excel-fil `freelance_konsulenter_2026-10-28.xlsx` i Filer med kolonnerne: Navn, Status (aktiv/inaktiv), Team.
- 9 aktive øverst, derefter de 3 inaktive (historiske).
- Ingen CPR, e-mail, telefon, løn eller CVR i filen.
- Navnene skrives ikke i chatten, kun i filen.

## Afgrænsning
- Kun læsning. Ingen data i Stork ændres.
- Filen indeholder navne. Kaspers regel siger, at read-only-svar normalt kun viser antal; ved at godkende denne plan accepteres en navneliste til intern brug. Del den kun med rette modtagere.

## Teknisk
- Udtræk fra `employee_master_data` hvor `is_freelance_consultant = true` (fornavn, efternavn, `is_active`) samt nuværende team via `team_members`/`teams`.
- Fil genereres med Python/xlsxwriter i /tmp og kopieres til /mnt/documents.
