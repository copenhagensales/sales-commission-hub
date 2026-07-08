## Ændring
På "Ansøgninger pr. uge"-grafen tilføjes antallet af ansatte som lille tag over/ved siden af konverteringsprocenten på linjen.

## Visning
Format: `9.4% (3)` — procenten som nu, med antal ansatte i parentes lige efter, samme label-position over linje-prikkerne.

Eksempel: hvis uge 22 har 34 ansøgere og 5 ansatte, viser labelen `14.7% (5)`.

## Teknisk
**Fil:** `src/pages/recruitment/RecruitmentDashboard.tsx`

Kun én ændring: `<LabelList>` på `<Line dataKey="conversionRate">` (ca. linje 786). Skift `formatter` fra:
```
(value) => value == null ? "" : `${value}%`
```
til en formatter der bruger hele row-payloaden så både `conversionRate` og `hired` kan vises: `${value}% (${hired})`.

Recharts' `LabelList` giver adgang til hele datapunktet via `content`-prop eller custom render — bruger en simpel custom content-funktion så vi kan læse `payload.hired`.

Ingen data- eller layout-ændringer. Ren visning. Grøn zone.
