# Relatel Månedsmål: rigtige targets for september 2026

Erstat de foreløbige (vilkårlige) targets på boardet "Relatel Månedsmål" med de oplyste tal, og sæt fælles målet til 650.

## Nye værdier (september 2026)

| Sælger | Nyt mål | Nuværende |
| --- | --- | --- |
| Anders Schjødt Kristensen | 70 | 90 |
| Benjamin Nickolaj Andersen | 75 | 90 |
| Emillio Pedersen | 55 | 80 |
| Frederik Bülow Donner | 70 | 80 |
| Gustav Fyrstenborg Diebel | 55 | 80 |
| Jacob Lykke Nielson | 65 | 80 |
| Noah Zylber | 55 | 75 |
| Rasmus Quiding Fricke | 65 | 75 |
| Samuel Juul | 30 | 70 |
| Simon Sejer Linddal Sørensen | 40 | 70 |
| Thorbjørn Mindedal Weichert | 70 | 60 |

Fælles mål: 850 → 650. (Summen af de individuelle mål er 650, så de matcher nu det fælles mål.)

## Teknisk

- Kun én fil ændres: `src/config/relatelMonthlyGoals.ts`, blokken `"2026-09"` (`team` og `sellers`).
- Navnene er matchet til de eksisterende nøgler i configen (navnematch er case-/mellemrums-insensitivt via `normalizeName`).
- Ingen ændringer i hooks, ekskluderede produkter, database eller andre boards. Procent og indeks-beregning følger automatisk de nye tal.
