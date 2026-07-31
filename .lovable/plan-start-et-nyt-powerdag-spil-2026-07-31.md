# Start et nyt Powerdag-spil

## Hvorfor tavlen er låst nu

Der findes kun ét Powerdag-event i systemet: "Powerdag 2026" med datoen 26. juni 2026, som stadig er markeret aktivt og ikke afsløret. Tavlen låser automatisk point kl. 15.00 på eventets dato og viser "Pointene er låst" indtil vinderen afsløres. Da eventdatoen for længst er passeret, står tavlen permanent i låst tilstand.

Eventet har 10 pointregler og 10 registrerede scorer.

## Hvad jeg bygger

En "Start nyt spil"-funktion på Powerdag Admin, så du selv kan starte forfra uden hjælp:

1. **Knap: "Start nyt spil"**
   - Du vælger navn og dato (dato foreslås som i dag).
   - Systemet opretter et nyt event, aktiverer det, og deaktiverer det gamle.
   - Point-reglerne (hold, sub-klient, point pr. salg) kopieres automatisk over fra det nuværende event, så du ikke skal opsætte dem igen.
   - Det nye event starter med 0 salg på alle regler og ulåst tavle.

2. **Knap: "Nulstil point"** på det aktive event
   - Sætter alle salgstal til 0 uden at røre reglerne.
   - Bekræftelsesdialog, så det ikke sker ved et uheld.

3. **Knap: "Lås op igen"**
   - Sætter eventet tilbage til ikke-afsløret, hvis I vil køre suspense-fasen igen.

4. **Historik bevares**
   - Gamle events, regler og scorer slettes ikke. De deaktiveres blot, så tavlen viser det nye spil.

## Efter implementering

Du går til Powerdag Admin, trykker "Start nyt spil", og tavlen viser med det samme det nye spil med 0 point og uden lås.

## Teknisk

- Berører `src/components/powerdag/PowerdagSettings.tsx`, `src/pages/dashboards/PowerdagAdmin.tsx` og `src/hooks/usePowerdagData.ts`.
- Nye mutationer: opret event med kopierede regler, nulstil scorer for event, sæt `is_revealed` tilbage til false.
- Ingen ændringer i låselogikken på selve tavlen (`PowerdagBoard.tsx`) — den fungerer korrekt for et event med korrekt dato.
- Ingen databaseændringer nødvendige; eksisterende tabeller `powerdag_events`, `powerdag_point_rules`, `powerdag_scores` dækker behovet.
- Grøn/gul zone: Powerdag-tabeller, ingen løn-, pricing- eller persondatapåvirkning.