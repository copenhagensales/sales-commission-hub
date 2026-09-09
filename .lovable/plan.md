# Hvorfor Oscar ikke kan slettes — og hvad vi gør

## Hvad fejlen skyldes (bekræftet i databasen)

Fejlen er ikke en rettighedsfejl, men en dataspærring:

```text
update or delete on table "employee_master_data" violates foreign key constraint
"contract_signatures_signer_employee_id_fkey" on table "contract_signatures"
```

Bekræftet ved forespørgsel:

- Oscar Priegel (oprettet 1/9-2026, arbejdsmail `ospr@copenhagensales.dk`) har 1 kontrakt oprettet 9/9-2026 kl. 09:36 med status **pending_employee** — altså sendt til underskrift, men ikke underskrevet.
- Den kontrakt har 1 række i underskriftstabellen, hvor Oscar selv står som underskriver. Underskriftshistorik er beskyttet mod sletning, og derfor blokerer den sletningen af medarbejderen.
- Der ligger desuden **4 ekstra Oscar Priegel-rækker** oprettet 8/9 og 9/9 (uden arbejdsmail, uden kontrakt og uden underskrift). De er dubletter fra gentagne oprettelsesforsøg. Det er formentlig dem, du forsøger at rydde op i.

## Forslag

### 1. Ryd dubletterne op (sikkert)

De 3-4 Oscar Priegel-rækker uden arbejdsmail, uden kontrakt og uden underskrift kan slettes uden at røre historik. Den rigtige række (den med arbejdsmail og kontrakt) beholdes.

### 2. Beslut hvad der skal ske med den rigtige række

To muligheder — du vælger:

- **A: Behold medarbejderen, annullér kontrakten.** Kontrakten sættes til annulleret, medarbejderen deaktiveres i stedet for at slettes. Historikken bevares. Det er standardvejen i et lønsystem.
- **B: Slet medarbejderen helt.** Kræver at den uunderskrevne kontrakt og dens underskriftsrække fjernes først. Da kontrakten aldrig er underskrevet, er der ingen juridisk historik at miste — men det er en destruktiv handling, som jeg først udfører på din eksplicitte godkendelse.

### 3. Gør fejlen forståelig i UI'et (fremadrettet)

I dag får du den rå databasefejl. I stedet skal sletteknappen vise en dansk besked, der forklarer årsagen: "Medarbejderen kan ikke slettes, fordi der ligger en kontrakt til underskrift. Annullér kontrakten først, eller deaktivér medarbejderen." Ingen ændring af selve slettelogikken.

## Teknisk resume

- Årsag: `contract_signatures.signer_employee_id` → `employee_master_data.id` (FK uden cascade). Underskriftstabellen er i rød zone som immutabel historik.
- Trin 1 og 2 udføres som afgrænsede databaseændringer på navngivne id'er — ingen bulk-sletning, ingen ændring i løn, provision, salg eller rettigheder.
- Trin 3 rører kun fejlhåndtering i medarbejderoversigtens sletteflow (frontend).
- Ingen ændringer i RLS, kontraktskabeloner eller underskriftsflowet.
