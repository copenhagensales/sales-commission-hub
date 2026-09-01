# TDC Månedsmål: individuelle targets for september 2026

## Ændring
Indsæt de oplyste individuelle mål i `src/config/tdcMonthlyGoals.ts` under `2026-09.sellers`, mappet til de fulde navne som de vises på boardet:

| Sælger | Mål |
| --- | --- |
| Mathias Victor Andersen | 130 |
| Jacob Østergaard Hansen | 105 |
| Sune Novrman | 80 |
| Matias Heller Frederiksen | 55 |
| Andreas Walther Christensen | 50 |
| Niklas Krøyer-Strube | 40 |
| August Bach Pedersen | 80 |
| Thomas Wehage | 25 |
| Lukas nielsen | 45 |
| Zean Romeo Ayvaz | 30 |
| Julius Rødsø Langkilde | 45 |
| Storm Søegaard | 20 |
| Thorbjørn Hansen-Larsen | 80 |
| Jonathan Gabriely Givskov Hove | 10 |
| Nicholaj Michael Wester | 60 |
| Oliver Gonsalves Vatting Arentoft | 5 |

## Robust navne-match
Nogle navne i stamdata har dobbelt mellemrum ("August  Bach Pedersen", "Zean  Romeo Ayvaz"). `getTdcSellerGoal` laver i dag et eksakt opslag, så disse ville falde tilbage til default.
Derfor normaliseres opslaget: trim, kollaps gentagne mellemrum og sammenlign case-insensitivt mod nøglerne. Findes intet match, bruges `defaultSeller` som i dag.

`defaultSeller` sættes til 0, så en sælger uden eksplicit mål ikke får et opdigtet target (rækken vises da uden bar).

## Note
Summen af de individuelle mål er 860, mens det fælles teammål står til 850. Teammålet lades urørt — sig til hvis det skal rettes til 860.

## Filer
- `src/config/tdcMonthlyGoals.ts`
