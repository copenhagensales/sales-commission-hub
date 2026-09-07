# Anciennitet i deaktiveringsmailen

Mailen får en ny linje, så modtageren kan se hvor længe medarbejderen har været ansat.

## Hvordan det ser ud

```text
Medarbejder: Oliver Hagelund
Team: United
Email: olha@copenhagensales.dk
Ansat: 25. august 2026 - 7. september 2026 (13 dage)
Dato: 7. september 2026
Deaktiveret af: Oscar Belcher
```

Formatering af varigheden:
- under 1 måned: "13 dage"
- 1-12 måneder: "4 måneder"
- over 1 år: "1 år og 3 måneder"
- mangler startdato (6 af 294 medarbejdere i dag): "Ansat: Ikke angivet"

Slutdato bruger medarbejderens registrerede ophørsdato hvis den findes, ellers deaktiveringsdagen.

Samme linje kommer med i opfølgningsmailen, så de to mails ser ens ud.

## Teknisk

1. `supabase/functions/send-deactivation-reminder/index.ts`
   - Hent `employment_start_date` og `employment_end_date` i det eksisterende `employee_master_data`-select.
   - Ny hjælpefunktion `formatTenure(start, end)` der returnerer den samlede tekst (dansk datoformat via `toLocaleDateString("da-DK")`).
   - Nye placeholders `{{employment_period}}` og `{{tenure}}` tilføjes i `.replace`-kæden.
   - `DEFAULT_SETTINGS.email_body` får linjen `Ansat: {{employment_period}}` under `Email:`.
2. `supabase/functions/send-deactivation-followups/index.ts`
   - Samme felter, samme hjælpefunktion (kopieret eller lagt i `_shared/`), samme placeholders, så en gemt skabelon virker ens i begge funktioner.
3. Skabelonen i `deactivation_notification_settings.email_body` er redigerbar i UI'et. Eksisterende gemt skabelon ændres ikke automatisk — de nye placeholders virker med det samme, og linjen tilføjes manuelt i indstillingerne (eller jeg kan opdatere den gemte tekst som del af opgaven, hvis I vil have det med).

Ingen migration, ingen ændring i modtagerlogik, adgangskontrol, løn eller salgsdata.
