# Ret Samuels arbejdsmail og login

## Bekræftet
- Præcis ét aktivt medarbejderkort med én eksisterende, bekræftet login-konto.
- `saro@cph-relatel.dk` bruges ikke af et andet medarbejderkort eller en login-konto.
- Alle 253 salg på nuværende og korrekt mail er allerede koblet til Samuel via de eksisterende agentkoblinger; ingen af disse koblinger peger på andre medarbejdere.
- Samuels stillingskobling er udfyldt, så mailrettelsen kræver ikke en ny stilling eller rolle.

## Rettelsen
1. Ret kun `work_email` på Samuels eksisterende medarbejderkort til `saro@cph-relatel.dk` med kontrol af entydigt match og uændret login-id.
2. Brug den eksisterende ejerbeskyttede `migrate-auth-emails`, afgrænset med `only_emails: ["saro@cph-relatel.dk"]`, til at rette mailen på den samme login-konto. Opret aldrig en ny konto.
3. Kontroller, at medarbejder-id, login-id, team, rolle, agentkoblinger og de historiske salg er bevaret, og at begge mails nu matcher.

Ingen ændring af salg, provision, rettigheder, kode, databaseopbygning eller loginindstillinger. Ingen mails, SMS eller push sendes. Ingen publicering.

## Sikkerhedsstop
Den supplerende kontrol af løn og rapporter skal bekræfte, at de eksisterende agentkoblinger fortsat dækker historikken, før første ændring. Ved afvisning fra databasen eller manglende adgang til loginrettelsen stoppes arbejdet uden omgåelse. Hvis arbejdsmailen er rettet, men loginrettelsen fejler, rapporteres den delvise tilstand og den gamle arbejdsmail gendannes kun efter kontrol af, at ingen anden ændring er sket.

## Teknisk grundlag
- SQL-kontrol: 253/253 relevante salg dækket af `employee_agent_mapping`, 0 fremmede koblinger, 0 mailkonflikter.
- `supabase/functions/migrate-auth-emails/index.ts:50-67,90-113,127-140`: eksisterende auth-id bevares; målmail hentes fra medarbejderkortet.
- `src/hooks/useSellerSalariesCached.ts:353-369`: lønidentitet omfatter både arbejdsmail og agentkoblinger.
- Live-triggere på medarbejderkortet kontrolleret; eksisterende dubletværn og audit bevares.

Samuel skal efter rettelsen prøve Microsoft-login selv; en vellykket loginprøve kan ikke loves på forhånd.