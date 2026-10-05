# Krav om 8 cifre i telefonnumre

## Regler
- **Telefonnummer (øverst):** Skal være præcis 8 cifre og må ikke indeholde bogstaver. Mellemrum fjernes, inden reglen tjekkes, så "22 22 22 22" er gyldigt.
- **Hovednummer (Omstilling):** Samme regel. Feltet er altid et nummer.
- **Linjer under "Numre i løsningen":**
  - Hvis feltet kun indeholder tal, skal der være præcis 8 cifre. "123123" afvises.
  - Hvis feltet indeholder bogstaver, er det et navn og godkendes uanset længde. Fx "Torben", "Butiksmobil" eller "Butiksmobil 1".

## Hvad sælgeren ser
- Et ugyldigt felt får rød kant og den korte tekst "Skal være 8 cifre".
- Det røde felt over mailen nævner, hvad der mangler, fx "telefonnummer (8 cifre)" eller "8 cifre på alle numre i løsningen". Mailen kan ikke kopieres, før fejlene er rettet.

## Lille rettelse undervejs
- Ved "Ingen specifikke produkter" står der i dag "4.000 kr.." med to punktummer. Det rettes til ét.

## Tekniske detaljer
- Kun `TdcIdriftsaettelseForm.tsx` ændres. Der tilføjes en hjælper, `isValidDkNumber(v)`: fjern mellemrum, og tjek `/^\d{8}$/`. Linjereglen er: `/\p{L}/u.test(v) || isValidDkNumber(v)`.
- Reglerne føjes til den eksisterende `missing`-liste. Den styrer allerede både det røde felt og knappen "Kopiér mail".
