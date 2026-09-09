# Fjern Oscar Priegel-dubletter + regel mod nye dubletter

## Hvorfor sletningen fejlede

```text
update or delete on table "employee_master_data" violates foreign key constraint
"contract_signatures_signer_employee_id_fkey" on table "contract_signatures"
```

Den række, du forsøgte at slette, er den **rigtige** Oscar Priegel (oprettet 1/9, arbejdsmail `oscp@copenhagensales.dk`). Han har en kontrakt sendt til underskrift med en tilhørende underskriftsrække, og underskriftshistorik er beskyttet mod sletning. Dubletterne er de rækker, der blev oprettet 8/9 og 9/9.

## Bekræftet i databasen — 4 Oscar Priegel-rækker

| Oprettet | Arbejdsmail | Aktiv | Kontrakt / underskrift / team / løn / login | Handling |
|---|---|---|---|---|
| 1/9 | oscp@copenhagensales.dk | ja | 1 / 1 / 1 / 0 / ja | **Behold** |
| 8/9 | ingen | nej | 0 / 0 / 0 / 0 / nej | Slet |
| 9/9 | ingen | nej | 0 / 0 / 0 / 0 / nej | Slet |
| 9/9 | ingen | ja | 0 / 0 / 0 / 0 / nej | Slet |

De tre slettekandidater er helt tomme — ingen kontrakt, underskrift, teammedlemskab, løndata eller login. Ingen historik mistes.

## Plan

### 1. Slet de tre Oscar Priegel-dubletter

Sletning på tre navngivne id'er. Ingen andre medarbejdere berøres — dubletter for andre personer, som også findes i systemet, lades urørt i denne omgang.

### 2. Regel mod nye dubletter

Der findes i dag ingen spærring: oprettelsesformularen indsætter uden at slå op, om personen findes. Der indføres:

- Unik regel på arbejdsmail (uafhængigt af store/små bogstaver), så samme arbejdsmail ikke kan bruges to gange.
- Unik regel på privat e-mail, samme princip.
- En kontrol ved oprettelse, der afviser en ny medarbejder, hvis der allerede findes en — også en **inaktiv** — med samme e-mail, med en dansk fejlbesked: "Denne medarbejder findes allerede (inaktiv) — genaktivér i stedet for at oprette ny."

Reglen gælder kun ved oprettelse. Eksisterende rækker og almindelig redigering påvirkes ikke.

Bemærk: der findes i dag flere dubletpar for andre personer (Yasmin, Nellie, Noah). De blokerer den unikke regel på privat e-mail, indtil de også er ryddet. Derfor indføres i første omgang kun reglen på **arbejdsmail** plus kontrollen ved oprettelse; reglen på privat e-mail afventer, at du siger god for at rydde de øvrige dubletter.

### 3. Genaktivering som vejen tilbage

Når man opretter en ny medarbejder og e-mailen matcher en eksisterende inaktiv person, vises "Genaktivér [navn]" i stedet for at oprette en ny række. Genaktivering sætter det samme stamkort aktivt igen, så løn, kontrakter, teamhistorik og login bevares. Den eksisterende genaktiveringslogik (`src/lib/employees/activateEmployee.ts`) genbruges.

### 4. Forståelig fejlbesked ved sletning

Sletteknappen viser i dag den rå databasefejl. Den erstattes med: "Medarbejderen kan ikke slettes, fordi der ligger en kontrakt til underskrift. Annullér kontrakten først, eller deaktivér medarbejderen." Selve slettelogikken ændres ikke.

## Teknisk resume

- Årsag: `contract_signatures.signer_employee_id` → `employee_master_data.id` (FK uden cascade). Underskriftstabellen er immutabel historik og bevares.
- Trin 1: `DELETE FROM employee_master_data WHERE id IN (…3 id'er…)` — verificeret uden afhængige rækker.
- Trin 2: migration med `CREATE UNIQUE INDEX ... ON employee_master_data (lower(work_email)) WHERE work_email IS NOT NULL` samt BEFORE INSERT-trigger med `search_path` sat, der rejser en dansk fejl ved e-mailmatch.
- Trin 3-4: frontend i `EmployeeFormDialog.tsx` / `EmployeeMasterData.tsx`.
- Ingen ændringer i løn, provision, salg, rapporter, RLS eller rettigheder.
