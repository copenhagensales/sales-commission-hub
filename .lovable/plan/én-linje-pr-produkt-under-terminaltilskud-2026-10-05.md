# Én linje pr. produkt under terminaltilskud

## Hvad sælgeren får
- Ved "Specifikke produkter" erstattes det store tekstfelt af produktlinjer, der er opbygget som "Numre i løsningen".
- Hver linje har et fritekstfelt, hvor sælgeren selv skriver produktet, og en skraldespand til at fjerne linjen.
- Knappen "Tilføj produkt" tilføjer en ny linje. Der er altid mindst én linje.
- Ved "Ingen specifikke produkter" er produktlinjerne skjult. Teksten i mailen er den samme som i dag.

## I mailen
- Produkterne vises under "…, vi har drøftet det umiddelbart skal bruges på:" med ét produkt pr. linje.

## Kopiér mail
- Ved "Specifikke produkter" skal alle linjer være udfyldt, før mailen kan kopieres. En tom linje skal udfyldes eller slettes, på samme måde som ved numrene.

## Tekniske detaljer
- Kun `src/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm.tsx` ændres. `subsidyProduct: string` erstattes af `subsidyProducts: string[]` med startværdien `[""]`. Hvert produkt får et eget Input og en Trash2-knap.
- Ingen data gemmes, og databasen ændres ikke.
