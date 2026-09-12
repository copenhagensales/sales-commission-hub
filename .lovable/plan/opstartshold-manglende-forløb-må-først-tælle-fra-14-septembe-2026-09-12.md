# Opstartshold: manglende forløb må først tælle fra 14. september

## Hvad du ser nu

Tallene i kasserne er teknisk korrekt optalte, men de tæller uger som ordningen ikke gælder for endnu. Derfor står der "Mangler forløb i uge 37 · 22 af 22" og "Lyt mangler — 4 uger i træk", selv om de ugentlige forløb først registreres fra 14. september 2026.

Databasen leverer allerede feltet der siger om ugen tæller (og forsiden viser startdatoen), men listen og kasserne bruger det ikke: de tæller enhver uge uden coaching/lyt, også uger før startdatoen.

## Rettelsen (kun visning og optælling)

1. Manglende forløb tælles kun for sælgere hvor ugen faktisk er krævet (ordningen er aktiv, og ugen har mindst 2 arbejdsdage). Før 14. september bliver tallet derfor 0.
2. "Lyt mangler X uger i træk" må kun tælle uger på eller efter startdatoen. Før startdatoen vises den advarsel ikke.
3. Når ordningen ikke er i kraft endnu, får kassen en neutral tekst i stedet for gul advarsel — fx "Starter 14. september 2026" — og filterpillen viser 0.
4. Sælgerkortene viser fortsat coaching-/lyt-knapperne, så en leder gerne må registrere et forløb før startdatoen; det tælles blot ikke som forsømt.
5. Prioriteringen af kortene ("hastende først") bruger kun de forløb der reelt mangler, så rækkefølgen ikke længere er drevet af uger før startdatoen.

## Teknisk

- Kun `src/pages/onboarding/RampTeam.tsx` ændres. Ingen ændringer i database, RPC'er, mail, adgange eller salgs-/provisionsdata.
- `missingList` filtreres på `member.week_required` foruden `has_absence`/`has_coaching`/`has_listen`.
- `missedListen` i `derive()` begrænses til uger hvis mandag ligger på eller efter `weekly_program_start_date`; er `weekly_program_active` falsk, sættes den til 0.
- `urgency` genberegnes af de samme værdier, så sorteringen følger med.
- Verifikation: typecheck plus browserkontrol af `/opstartshold` — kassen "Mangler forløb i uge 37" skal vise 0 før 14. september, og farezone-/"ser godt ud"-tallene (5 og 17) skal være uændrede.
