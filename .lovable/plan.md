# Hvorfor Oliver Lyng Christensen ikke kan logge ind

## Årsag (bekræftet i data)

Oliver findes som medarbejder i Stork (start 15/9, aktiv, arbejdsmail `olic@copenhagensales.dk`), men han har **ingen brugerkonto** endnu:

- `invitation_status = pending`
- ingen kobling til en loginkonto (`auth_user_id` er tom)
- der findes **ingen loginkonto** på `olic@copenhagensales.dk` eller hans private mail

Da login med Microsoft kun lukker folk ind, hvis kontoen allerede findes i Stork, bliver han afvist. Der ligger ingen fejlede loginforsøg på hans mail, så han er sandsynligvis slet ikke nået til at forsøge — eller er blevet afvist inden logning.

## Hvad vi gør

1. Åbn Oliver under Kommende Opstarter og brug knappen **Opret bruger** (den funktion vi lige har bygget).
2. Bekræft arbejdsmail `olic@copenhagensales.dk` og startdato 15/9 i dialogen.
3. Systemet opretter hans brugerkonto, kobler den til hans profil, sætter ham aktiv og sender velkomstmail til hans private mail.
4. Bekræft bagefter, at hans profil har en loginkonto, og at status ikke længere er "afventer".

## Forudsætning

Hans Microsoft-konto `olic@copenhagensales.dk` skal være oprettet i Microsoft 365 først. Er den ikke det, kan han stadig ikke logge ind, selv om Stork-brugeren findes.

## Afgrænsning

Ingen ændringer i løn, provision, pricing, rettigheder, RLS eller historiske data. Kun oprettelse af Olivers brugerkonto.
