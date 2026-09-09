# Anonymisér i stedet for at slette — bevar statistik

Målet: personoplysninger forsvinder efter udløb, men de tal vi bruger til statistik (antal ansøgere, kilder, stillinger, tidspunkter) bliver bevaret.

## Hvad jeg har bekræftet i dag

- Alle syv rækker i `data_retention_policies` står i dag på "Slet alt" (`cleanup_mode = 'delete_all'`), og alle er aktive.
- Rensningsjobbet `gdpr-data-cleanup` understøtter kun anonymisering for jobansøgere. Alle andre datatyper sletter rækker permanent.
- Rensningstypen kan ikke vælges for "Øvrige datatyper" i skærmen — den viser blot et fast mærke "Slet alt" (`RetentionPolicies.tsx` linje 450-454).
- Der findes ingen tidsplan (cron) der kalder `gdpr-data-cleanup`. Jobbet kører derfor kun hvis det startes manuelt — intet er slettet automatisk endnu.

## Det bygger jeg

### 1. Jobansøgere anonymiseres i stedet for at slettes
Sæt politikken for Jobansøgninger til "Anonymisér". Så nulstilles navn, e-mail, telefon, noter og CV-link, mens ansøgningsdato, status, kilde, "kender os fra" og stilling bevares — nok til at tælle ansøgere pr. måned og pr. kilde bagefter, uden at man kan se hvem.

### 2. Rensningstype kan vælges pr. datatype
I "Øvrige datatyper" bliver mærket "Slet alt" erstattet af en vælger med to valg: "Anonymisér (behold statistik)" og "Slet alt". Datatyper hvor anonymisering ikke er mulig (fx password-tokens) viser fortsat kun "Slet alt".

### 3. Anonymisering understøttes for de datatyper hvor det giver mening
Jobbet udvides, så "Anonymisér" virker for:

| Datatype | Anonymisering fjerner | Bevares til statistik |
|---|---|---|
| Jobansøgninger | navn, e-mail, telefon, noter, CV | dato, status, kilde, stilling |
| Kundehenvendelser | navn, e-mail, telefon, fritekst | dato, type/emne, antal |
| Rekrutteringskommunikation | modtager, beskedindhold | dato, kanal, retning, status |
| Login-historik | e-mail, IP, browserinfo | dato, medarbejder-id, resultat |
| Deaktiverede medarbejdere | personoplysninger (samme felter som ved GDPR-sletning i dag) | ansættelsesperiode, stilling, team-historik |

Integrationslogfiler og password-tokens har ingen statistikværdi og fortsætter som "Slet alt".

Vigtigt: "Deaktiverede medarbejdere" står i dag på "Slet alt" efter 5 år, hvilket ville slette hele stamkortet og dermed ødelægge historisk medarbejderstatistik. Den sættes til "Anonymisér".

### 4. Sikkerhed omkring kørsel
Anonymiseringen skrives så den kan køres igen uden skade (allerede anonymiserede rækker springes over), og hver kørsel logges i sletningshistorikken med hvilken type og hvor mange rækker. Der oprettes ingen automatisk tidsplan i denne opgave — jobbet startes fortsat manuelt, så I kan se resultatet af den første kørsel før noget automatiseres.

## Teknisk

- `data_retention_policies`: datarettelse af `cleanup_mode` til `anonymize` for candidates, customer_inquiries, communication_logs, login_events, inactive_employees. Ingen skemaændring nødvendig (kolonnen findes).
- `supabase/functions/gdpr-data-cleanup/index.ts`: hver `case` i Part 3 udvides med en `anonymize`-gren; select-filtrene får en "ikke allerede anonymiseret"-betingelse for idempotens. Nuværende `delete_all`-adfærd bevares uændret.
- Anonymisering af medarbejdere genbruger feltlisten fra `gdpr-process-deletion/index.ts` for at undgå to definitioner.
- `src/pages/compliance/RetentionPolicies.tsx`: `Select` for rensningstype pr. datatype via den eksisterende `dataUpsertMutation`, opdaterede tooltips, og infoboksen præciseres til hvad der bevares.
- Rører ikke: løn, provision, salg, `campaign_retention_policies`, RLS eller `gdpr-process-deletion`.

## Verifikation

- Tælle-forespørgsel før/efter en manuel kørsel: antal ansøgere pr. måned skal være uændret, mens antal rækker med e-mail/telefon falder til 0 for udløbne.
- Anden kørsel må ikke ændre yderligere rækker (idempotens).
- Typecheck.
