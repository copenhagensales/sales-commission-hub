# Indeksindikator på TDC Månedsmål

Claudes forslag giver god mening. Indeks er en bedre TV-metrik end det rå dagsgab: ét tal, én farve, samme skala for fælles mål og sælgere. To bemærkninger inden vi bygger:

1. Beregningen i `src/lib/boardProgress.ts:56-83` gør allerede præcis det Claude beskriver (i dag tæller med, helligdage filtreres, `gab = forventet - faktisk`). Ændringen er derfor: tilføj `indeks`, skift status-tærskler fra dagspace til indeksprocent, og flyt farve i UI.
2. Kontroleksemplerne passer med nuværende hverdagstælling (september 2026 = 22 hverdage, 1/9 = 1 gået → forventet 38,6, indeks 71).

## Beregning (`src/lib/boardProgress.ts`)

- Nye konstanter: `INDEKS_FORAN = 110`, `INDEKS_ON_TRACK = 95`, `INDEKS_EFTER = 85`.
- `BoardProgress` udvides med `indeks: number | null`; `status` bliver `"foran" | "on-track" | "efter" | "bagud" | "ukendt"`.
- `indeks = forventet > 0 ? (faktisk / forventet) * 100 : null`; status udelukkende ud fra indeks.
- `dagspace`, `ON_TRACK_DAGE`, `EFTER_DAGE` fjernes fra statuslogikken (dagspace beholdes som felt kun hvis det stadig bruges).
- Farvehjælpere: `foran`/`on-track` → grøn, `efter` → amber, `bagud` → rød, `ukendt` → neutral.
- Ny testfil `src/lib/boardProgress.test.ts` med Claudes tre kontroleksempler.

## Fælles mål-boksen (`TdcMonthlyGoalBoard.tsx`)

- Venstre (gab): tal uden fortegn, altid neutral lys tekst. Label: `bagud på target` / `foran target` / `på target`.
- Midt (nyt): `71%` med label `indeks · 100 = på target`. Afrundet heltal; ved `null` vises `—` uden label. Dette er det eneste tal der farves efter status.
- Højre (`27,5 / 850` + metadatalinje), bar, ghost-fyld, markør og dagsstrip: uændret.

## Individuelle mål

Barfarve følger indeks-status: grøn (foran/on-track), amber (efter), rød (bagud). Ingen nye tal eller labels. Sælgere med mål 0 har fortsat ingen bar. Bemærk som forventet effekt: 0 salg = rød fra dag 1.

## Filer
- `src/lib/boardProgress.ts` (grøn zone, kun boards)
- `src/lib/boardProgress.test.ts` (ny)
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` (præsentation)

Ingen ændringer i hooks, data eller lønlogik.
