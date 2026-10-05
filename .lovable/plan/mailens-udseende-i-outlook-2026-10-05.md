# Mailens udseende i Outlook

## 1. Numre i løsningen i punktform (ønsket)
- Hvert nummer eller abonnement får sit eget punkt. Eksempel: "• 12345678 – Hovednummer".
- Linjen opdeles med tankestreg i stedet for komma, så den er lettere at læse: "• Peter – Professionel mobil (100GB) – Simkort: 894520202020". Mangler simkortnummer, står der "[Simkortsnummer]" som i dag.

## 2. Forslag til andre forbedringer
- **Punktform alle steder med lister:** Både tilskudsprodukterne (fx "iphone 17 pro") og funktionerne får punkter, så de ligner resten af mailen.
- **Mobilt bredbånd samlet:** Teksten om datadelingskort og router er i dag løse afsnit. De samles under løsningen som punkter.
- **Fremhævede tal:** Tilskudsbeløbet og hovednummeret bliver fede, så kunden hurtigt finder dem.
- **Pænere beløb:** "10000 kr." vises som "10.000 kr.".
- **Mere ens afstand:** Afstanden mellem overskrift og tekst bliver den samme overalt, så der ikke er store, ujævne huller.

Den faste tekst ændres ikke. Kun opsætningen ændres.

## Tekniske detaljer
- Kun `buildMail()` i `src/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm.tsx` ændres.
- I HTML bruges `<ul><li>` med inline margin, så Outlook bevarer opsætningen. I den rene tekstversion bruges "• ".
- Beløbet formateres med `toLocaleString("da-DK")`, men kun når det er et tal. Ellers vises det præcis, som sælgeren har skrevet det.
