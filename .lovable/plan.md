# Dubletter på medarbejdere: oprydning + forebyggelse

## Hvorfor Oscar ikke kunne slettes

Fejlen er en dataspærring, ikke en rettighedsfejl:

```text
update or delete on table "employee_master_data" violates foreign key constraint
"contract_signatures_signer_employee_id_fkey" on table "contract_signatures"
```

Den række, du forsøgte at slette, er den **rigtige** Oscar Priegel (oprettet 1/9, arbejdsmail `oscp@copenhagensales.dk`). Han har en kontrakt sendt til underskrift (status: afventer medarbejder) med en tilhørende underskriftsrække. Underskriftshistorik er beskyttet, og derfor blokeres sletningen. De rækker, der reelt skal væk, er dubletterne oprettet 8/9 og 9/9.

## Bekræftede dubletter (10 rækker, 4 personer)

| Person | Behold | Slet |
|---|---|---|
| Oscar Priegel | 1/9, arbejdsmail + kontrakt + team | 3 rækker (8/9, 9/9, 9/9) — ingen mail, kontrakt, team, løn eller login |
| Yasmin Isabel Jakobsen | 30/7, arbejdsmail + kontrakt + team | 2 rækker (18/8) — tomme |
| Nellie Voldby Rau | 18/8, arbejdsmail + kontrakt + team | 1 række (7/8) — tom, peger på samme login som den rigtige |
| Noah Røpke-Gleerup | 27/8, arbejdsmail + kontrakt + team | 1 række (31/8) — tom, men peger på et **andet** login (`nogl@`) |

Alle slettekandidater har 0 kontrakter, 0 underskrifter, 0 teammedlemskaber og 0 lønrækker. Ingen historik mistes.

## Plan

### 1. Slet de 7 dubletrækker

Sletning sker på navngivne id'er, én ad gangen, ikke som bulk-regel. Noahs ekstra login (`nogl@copenhagensales.dk`) røres ikke i denne omgang — det skal besluttes særskilt, om den konto skal deaktiveres.

### 2. Ryd Oscars blokering

Oscars uunderskrevne kontrakt sættes til annulleret, så han ikke står med en åben underskriftsopgave. Selve medarbejderen beholdes (det er den rigtige række). Hvis du i stedet vil have ham helt væk, siger du til — det kræver at kontrakten og dens underskriftsrække fjernes først, og det gør jeg kun på eksplicit ordre.

### 3. Regel mod nye dubletter (databaseniveau)

Der findes i dag ingen spærring — oprettelsesformularen indsætter uden opslag, og derfor kan samme person oprettes igen og igen. Der indføres:

- Unikt indeks på arbejdsmail (uafhængigt af store/små bogstaver), så samme arbejdsmail ikke kan bruges to gange.
- Unikt indeks på privat e-mail, samme princip.
- En kontrol ved oprettelse, der afviser en ny medarbejder, hvis der allerede findes en — også en **inaktiv** — med samme e-mail eller samme navn + fødselsdato, med en dansk fejlbesked: "Denne medarbejder findes allerede (inaktiv) — genaktivér i stedet for at oprette ny."

Kontrollen gælder kun ved oprettelse. Eksisterende rækker og redigering påvirkes ikke.

### 4. Genaktivering som den rette vej tilbage

I medarbejderoversigten får søgningen efter en ny medarbejder et match-tjek: findes personen som inaktiv, vises et felt med "Genaktivér [navn]" i stedet for at oprette en ny række. Genaktivering sætter medarbejderen aktiv igen på det samme stamkort, så løn, kontrakter, teamhistorik og login bevares. Selve genaktiveringslogikken findes allerede (`src/lib/employees/activateEmployee.ts`) og genbruges.

## Teknisk resume

- Årsag til slettefejl: `contract_signatures.signer_employee_id` → `employee_master_data.id` (FK uden cascade). Underskriftstabellen er immutabel historik og bevares.
- Trin 1-2: afgrænsede dataændringer på navngivne id'er via SQL. Ingen ændringer i løn, provision, salg, rapporter eller rettigheder.
- Trin 3: migration med `CREATE UNIQUE INDEX ... ON employee_master_data (lower(work_email)) WHERE work_email IS NOT NULL` (og tilsvarende for `private_email`), plus en BEFORE INSERT-trigger med `search_path` sat, der rejser en dansk fejl ved match på e-mail eller navn+fødselsdato. Skal køres efter trin 1, ellers fejler indekset på de nuværende dubletter.
- Trin 4: kun frontend i medarbejderoprettelsesflowet (`EmployeeFormDialog.tsx` / `EmployeeMasterData.tsx`) plus fejlbeskeden på sletteknappen, så den rå databasefejl erstattes af en forklarende dansk tekst.
- De øvrige oprettelsesveje (kandidat-til-medarbejder, Excel-import, invitationsflow, `create-employee-user`) beskyttes automatisk af databasereglen fra trin 3 og får en forståelig fejlbesked; deres logik ændres ikke.
