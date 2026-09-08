# Opsætning af skabelonen "Salgskonsulent TM - deltid"

## Svar: nej, den er ikke sat pænt op

Bekræftet ved at læse skabelonens indhold i databasen:

- Skabelonen indeholder **ingen rigtige overskrifter** (0 forekomster af h1-h4). Alle afsnitstitler som "1. Tiltrædelsestidspunkt og arbejdssted" er blot fed tekst i et almindeligt afsnit. Underskriftssiden har pæn styling til overskrifter (afstand over/under, adskillende linje), men den bruges slet ikke her — derfor står titler og tekst næsten klistret sammen.
- **1.144 &nbsp;-mellemrum** bruges som indrykning af punktnumre (fx "1.1" efterfulgt af 14 hårde mellemrum). Det giver skæve linjeskift og forskellig indrykning fra punkt til punkt, især på mobil og i PDF.
- Der er **ingen rigtige lister** (0 ol/ul), så nummereringen holdes ikke på plads af sig selv.
- Der er **234 afsnit**, hvoraf en del er tomme "luft-afsnit" (`&nbsp;`), som giver ujævn afstand nogle steder og ingen andre steder.
- Der er én tabel, som får korrekt styling.

## Hvad jeg gør

1. Rydder op i skabelonens indhold (kun denne skabelon):
   - Afsnitstitlerne bliver rigtige overskrifter, så de automatisk får luft over sig og en fin adskillende linje.
   - "ANSÆTTELSESKONTRAKT" / "Deltidsansættelse – timebegrænset" bliver dokumenttitel og undertitel.
   - Punkterne (1.1, 1.2, …) bliver rigtige nummererede punkter med ens indrykning i stedet for hårde mellemrum.
   - Tomme luft-afsnit fjernes, da afstanden nu kommer fra opsætningen.
   - Ordlyden i kontrakten ændres ikke — hverken tekst, tal, pladsholdere eller tabellen.
2. Kontrollerer resultatet i forhåndsvisningen og på underskriftssiden, så de ser ens ud.

## Teknisk

- Kun `contract_templates.content` for "Salgskonsulent TM - deltid" opdateres (én UPDATE, `version` uændret). Ingen ændring i skema, RLS, løn, pricing eller allerede sendte/underskrevne kontrakter — de har deres eget gemte indhold.
- Ingen kodeændringer forventet: `src/utils/contractProseStyles.ts` (CONTRACT_PROSE_SIGN_CLASSES) og `src/utils/contractPdfGenerator.ts` dækker allerede h1/h2/h3, ol/ul og tabeller.
- Alle pladsholdere bevares ordret (`${UserFullname}`, `{{startdato}}` m.fl.), så fletning ved afsendelse er uændret.
