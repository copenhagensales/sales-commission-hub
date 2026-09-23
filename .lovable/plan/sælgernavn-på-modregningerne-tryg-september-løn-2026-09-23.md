# Sælgernavn på modregningerne (Tryg, september-løn)

## Hvad du får

En ny udgave af regnearket med en ekstra kolonne **"Sælger"** indsat mellem kolonne D (Indtastet telefonnummer) og den nuværende kolonne E (Bookede møder). Alt andet i arket står uændret — samme rækker, samme rækkefølge, samme formatering.

For hver af de 181 rækker med et telefonnummer slås nummeret op blandt Uniteds salg i Stork, og sælgerens navn skrives ind. Rækkerne med "Total" står tomme.

Sådan matches nummeret:
- Kun salg på Uniteds kunder (8 kunder, 12 kampagner) tælles med.
- Nummeret sammenlignes på de sidste 8 cifre, så +45, 0045, mellemrum og bindestreger ikke gør nogen forskel.
- Sælgerens navn hentes fra medarbejderkartoteket ud fra salgets mail, med salgets eget sælgernavn som reserve.

Hvis et nummer ikke findes, står der **"Ikke fundet"**. Hvis samme nummer har salg hos flere sælgere, skrives begge navne i feltet med dato, så I selv kan afgøre hvilken der gælder.

Kontrol på 10 numre: 8 af 10 fandt et entydigt salg i august 2026 hos én sælger, 2 havde intet salg på Uniteds kunder.

## Vigtigt at være klar over

Opslaget bygger kun på telefonnummeret. Er nummeret indtastet forkert i dialeren, eller er salget registreret uden nummer, kan der ikke matches — de rækker står som "Ikke fundet". Filen er et regneark til jeres eget brug; der ændres intet i Stork, og intet trækkes fra i løn.

## Teknisk

Read-only. Ingen ændringer i appen, databasen eller løndata.

1. Læs de 181 telefonnumre fra arket (kolonne D, rækker hvor værdien ikke er "Total"/tom).
2. Ét read-only opslag mod databasen: Uniteds team → `team_clients` → `client_campaigns` → `sales` med `client_campaign_id` i kampagnelisten. Normalisér `customer_phone` med `right(regexp_replace(phone,'\D','','g'),8)` og match mod de sidste 8 cifre af arkets numre. Navn via `employee_master_data.work_email = sales.agent_email` (fallback `sales.agent_name`, derefter mailen).
3. Åbn arket med openpyxl, `insert_cols(5)`, overskrift "Sælger" i E1, og skriv navnene. Gem som ny fil i Files: `modregninger_tryg_september_løn_med_saelger.xlsx`.
