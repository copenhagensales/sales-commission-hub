# Relatel Månedsmål — salg mangler på sælgerniveau

## Hvad der er fundet (bekræftet i data)

Relatel har 47 solgte produktlinjer i september. Boardet viser 43 på fælles mål (korrekt — de frasorterede produkter er trukket ud), men kun 20 er fordelt på sælgere. 24 linjer havner hos ingen.

Årsagen er attribution, ikke tælleregler. Månedsmål-boardet matcher salg til sælger ved at sammenligne salgets `agent_email` direkte med medarbejderens `work_email`. Flere Relatel-sælgere har en dialer-mail der ikke er deres work_email:

| Dialer-mail på salget | Sælger | Sælgers work_email | Linjer i sept. |
| --- | --- | --- | --- |
| raqu@cph-relatel.dk | Rasmus Quiding Fricke | (ingen) | 13 |
| saro@cph-relatel.dk | Samuel Juul | samj@copenhagensales.dk | 6 |
| fbdo@cph-relatel.dk | Frederik Bülow Donner | FBDO@copenhagensales.dk | 4 |
| jona@cph-relatel.dk | Emillio Pedersen | empe@copenhagensales.dk | 1 |

Alle fire er korrekt koblet i `employee_agent_mapping` (agent → medarbejder) — det er den kobling Relatels normale board bruger. Derfor stemmer de to boards ikke.

## Rettelse

Månedsmål-handleren skal bruge samme identitetsopslag som de øvrige boards:

1. `agent_email` → `agents.email` → `employee_agent_mapping.employee_id` (primær).
2. Fald tilbage til `work_email`-match (uændret adfærd for de sælgere det virker for i dag).

Rettelsen laves i `supabase/functions/tv-dashboard-data/index.ts` i `handleMonthlyGoal`, som både TDC- og Relatel-boardet kalder. Begge boards bliver dermed rettet ens.

## Teknisk

- `handleMonthlyGoal` returnerer i dag `items` med `agentEmail`; hookene (`useRelatelMonthlyGoal.ts`, `useTdcMonthlyGoal.ts`) matcher selv på lowercased `work_email`.
- Handleren udvides til også at slå agent-mapping op for teamets medarbejdere og returnere en liste af mails pr. medarbejder (`emails: string[]`), så hookene matcher på hele sættet i stedet for kun work_email.
- Ingen ændring i tælleregler, produktekskluderinger, mål eller lønlogik. Ingen databaseændringer.
- Verificeres efter deploy: Relatel-boardets sum af individuelle tal skal stemme med fælles-tallet (43), og Thorbjørn skal stå med 11 (13 minus 2 frasorterede linjer).
