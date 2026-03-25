
Målet er at stoppe “Lokaliser salg” fra at vise salg for andre sælgere end den tildelte medarbejder.

1. Find og luk den primære filterfejl i `LocateSaleDialog.tsx`
- Den nuværende salgs-query kan køre før medarbejderdata er klar, så dialogen først henter en bred liste uden sælgerfilter.
- Jeg vil gøre queryen afhængig af, at filterdata er klar, når “Kun tildelt sælger” er slået til.
- Query key/enabled-logik bliver opdateret, så dialogen refetcher, når de reelle filterværdier er loaded.

2. Skift fra bred navne-søgning til præcis agent-filtering
- I stedet for primært at bruge `work_email` + `agent_name ilike *fuldt navn*`, vil jeg bygge filteret ud fra de faktiske agent-tilknytninger:
  - `employee_agent_mapping`
  - `agents.email`
  - `agents.name`
- Derefter filtreres salgene kun på de agent-identiteter, som faktisk hører til den valgte medarbejder.
- `work_email` bliver kun fallback, hvis der ikke findes agent-mapping.
- Det fjerner falske matches fra brede `ilike`-navnesøgninger.

3. Gør filtreringen robust mod flere aliaser pr. medarbejder
- Hvis en medarbejder har flere agentprofiler, samles alle gyldige emails/navne for den medarbejder.
- Resultatet merges og deduplikeres, så dialogen stadig viser alle relevante salg for samme medarbejder, men ikke andre sælgere.

4. Hærd state i `MatchErrorsSubTab.tsx`
- Den lokale række-state bruger i dag `idx`, som kan blive ustabilt ved filtrering/opdateringer.
- Jeg vil skifte til en stabil row-nøgle per række, så valgt medarbejder, ignore-state og dialog altid følger den rigtige række.
- Det reducerer risikoen for, at dialogen får sendt forkert `assignedEmployeeId`.

5. UI-sikringer i dialogen
- Hvis der ikke findes agent-mapping for medarbejderen, viser dialogen en tydelig note om, at filteret er fallback/bredere.
- Hvis filter er aktivt, vises kun resultater for den konkrete medarbejder eller en tom liste.

Berørte filer
- `src/components/cancellations/LocateSaleDialog.tsx`
- `src/components/cancellations/MatchErrorsSubTab.tsx`

Forventet resultat
- “Kun [medarbejder]” viser kun salg, der matcher den medarbejders agent-mapping.
- Ingen brede lister med andre sælgere ved første åbning.
- Rækkevalg bliver stabilt, også når listen ændrer sig.
