# Split af Fieldmarketing i Eesy FM og YouSee FM

## Kort svar

Ja, det er muligt. Teams "Eesy FM" og "YouSee FM" findes allerede i databasen (begge med 0 medlemmer), og salgsdata kan klassificere de fleste FM-medarbejdere entydigt.

Verificeret nu:
- Team "Fieldmarketing" har 34 medlemmer og ejer begge klienter: `Eesy FM` og `Yousee` (via `team_clients`).
- Team "Eesy FM" (`b5b6b0df…`) og "YouSee FM" (`05ac38be…`) findes, men har 0 medlemmer og ejer ingen klienter.
- Salg de sidste 90 dage giver entydig klientfordeling for de fleste sælgere: 20 aktive sælger kun Eesy FM, 2 aktive sælger kun Yousee (Lucas Sjøgreen, Samuel Odegaard), 1 sælger reelt TM-produkter (Silke Agergaard Jakobsen — Eesy TM/Hiper), og 4 aktive har ingen salg endnu (Adina Besjakov, Felix Kjeldsen Jensen, Nicklas Troensegaard, Theo Dicarlo).
- `employee_client_assignments` kan IKKE bruges til at afgøre det: alle 34 har begge klienter tilknyttet, så feltet er ikke differentierende i dag.

Konklusion: data kan foreslå fordelingen, men de sidste 5-9 personer kræver din manuelle beslutning. Derfor bygges splittet som et forslag du godkender, ikke som en blind automatik.

## Beslutning i denne plan

Fuldt split: både medarbejdere og klientejerskab flyttes.
- Klient `Eesy FM` → team Eesy FM
- Klient `Yousee` → team YouSee FM
- Team Fieldmarketing tømmes for medlemmer og klienter, men slettes ikke (historik bevares).

Bemærk konsekvensen: salgsejerskab følger klientens team, så rapporter pr. team ændres også bagud i tid — al historisk Eesy FM-omsætning vises fremover under team "Eesy FM" i stedet for "Fieldmarketing". Det er den tekniske sandhed i modellen, og det giver et konsistent billede fremadrettet. Vil du i stedet bevare de historiske tal under "Fieldmarketing", siger du til, så laves splittet uden at flytte klienterne (kun bemanding).

## Sådan gøres det

### 1. Migrations-værktøj i UI (Ledelse → Medarbejdere → Teams)
Ny dialog "Del Fieldmarketing" der:
- viser alle 34 medlemmer med en foreslået destination (Eesy FM / YouSee FM / bliv i Fieldmarketing)
- viser evidensen pr. person: antal salg pr. klient de sidste 90 dage, så valget kan efterprøves
- lader dig ændre destination pr. person med et dropdown
- kræver at alle uden forslag får et aktivt valg, før knappen "Gennemfør split" aktiveres
- viser en opsummering før udførsel (X til Eesy FM, Y til YouSee FM, Z bliver)

### 2. Udførsel
- Flyt `team_members`-rækker til det valgte team (én-team-reglen respekteres: gammel række slettes, ny oprettes)
- Opdatér medarbejderens team-felt på stamkortet, så profil og liste er enige
- Flyt `team_clients`: Eesy FM-klient til team Eesy FM, Yousee til YouSee FM
- Sæt teamleder på hvert af de to teams (vælges i dialogen)

### 3. Efterfølgende tjek der skal bekræftes
- FM vagtplan/booking-scope skal fortsat dække begge nye teams (i dag aggregeres Fieldmarketing, Eesy FM og YouSee FM — bekræftes efter split)
- Rettigheder: FM-roller er ikke bundet til team-navnet, men adgang til FM-sider verificeres for én bruger fra hvert nyt team
- Rapporter: kontrol af at total FM-omsætning for en valgt måned er identisk før/efter split, blot fordelt på to teams
- Opstartshold: fremtidige hold med team "Fieldmarketing" skal have valgt nyt team, ellers ender nye startere i det tomme gamle team

## Teknisk

- Ny komponent `src/components/employees/SplitFieldmarketingDialog.tsx`, åbnet fra `TeamsTab.tsx`
- Ny hook `src/hooks/useFieldmarketingSplitSuggestions.ts` som henter forslag fra en ny `SECURITY DEFINER` RPC `suggest_fm_team_split()` (aggregerer salg pr. `agent_email` × klient over 90 dage)
- Udførsel via ny RPC `apply_fm_team_split(assignments jsonb, move_clients boolean, eesy_leader uuid, yousee_leader uuid)` i én transaktion, så vi ikke ender halvvejs
- Team-medlemskab går gennem den eksisterende `ensureTeamMembership`-logik, så cohort-sync og det daglige selvhelende job ikke modarbejder splittet
- Ændringer i `team_clients` logges, så flytningen kan spores bagefter

## Zoner

Rød: `team_clients` (ejerskab → salgsattribution og løn pr. team). Gul: team-management UI og rapportvisning. Ingen ændring i pricing- eller lønberegning; kun hvilket team salget grupperes under.
