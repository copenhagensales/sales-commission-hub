

## Opdel Fieldmarketing i Eesy FM og YouSee FM i pulsmålingen

### Hvad
I pulsmålingens team-vælger skal "Fieldmarketing" erstattes af to separate valgmuligheder: **Eesy FM** og **YouSee FM**, så FM-medarbejdere kan angive hvilken klient de arbejder på.

### Implementering

**1. Opret to nye teams i databasen**
- Tilføj "Eesy FM" og "YouSee FM" i `teams`-tabellen via migration

**2. Opdater `PulseSurvey.tsx` og `PublicPulseSurvey.tsx`**
- Filtrér "Fieldmarketing"-teamet væk fra team-dropdown (eller erstat med de to nye)
- Alternativt: behold alle teams og lad de nye FM-teams stå i listen naturligt

**3. Resultatvisning (`PulseSurveyResults.tsx`)**
- Sørg for at filtrering/gruppering på team inkluderer de nye teams — dette burde virke automatisk da det allerede bruger `submitted_team_id`

### Beslutning
Skal det eksisterende "Fieldmarketing"-team **skjules** fra pulsmålingen (men bibeholdes i systemet til andre formål), eller **helt erstattes** af de to nye teams overalt?

Da FM-teamet bruges bredt i systemet (vagtplaner, medarbejdertildeling osv.), vil jeg **kun skjule det fra pulse survey team-vælgeren** og tilføje de to nye teams specifikt til survey-brug. De nye teams oprettes i `teams`-tabellen så resultaterne kan filtreres korrekt.

