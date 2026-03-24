

# Fix: Fejl i match viser ikke umatchede rækker

## To problemer fundet

### Problem 1: Unmatched-detection er skrøbelig
I `sendToQueueMutation` (linje 497-505) bruges `JSON.stringify` til at sammenligne uploadede rækker med matchede rækker. Hvis `findUploadedRow()` returnerer `{}` (fordi member number lookup fejler pga. formatforskelle), eller hvis rækkens nøglerækkefølge ændres, markeres rækker forkert som "matched". Derudover: hvis flere salg matcher samme medlemsnummer, deler de samme `uploadedRowData`, og den ene Excel-række tæller som "matched" — men de øvrige Excel-rækker der IKKE matchede nogen sale, burde stadig fanges.

**Fix:** Erstat JSON.stringify-sammenligningen med index-tracking. Hold styr på hvilke Excel-rækkeindekser der blev brugt i et match, og beregn unmatched ud fra det.

### Problem 2: MatchErrorsSubTab filtrerer for stramt
Linje 52-53: `query.in("config_id", configIds)` — Supabase's `.in()` matcher kun eksakte værdier og inkluderer IKKE `null`. Hvis importen blev gemt med `config_id = null` (fx hvis brugeren ikke valgte en config), vises den aldrig i fejl-tabben, selvom den har unmatched_rows.

**Fix:** Tilføj `or`-filter der inkluderer imports med null config_id.

## Ændringer

| Fil | Hvad |
|-----|------|
| `src/components/cancellations/UploadCancellationsTab.tsx` | Erstat JSON.stringify-baseret unmatched-detection med index-baseret tracking. I `handleMatch`: gem hvilke `parsedData`-indekser der blev brugt. I `sendToQueueMutation`: brug indekser til at finde umatchede rækker. |
| `src/components/cancellations/MatchErrorsSubTab.tsx` | Ret query til at inkludere imports med `config_id IS NULL` når en kunde er valgt: `.or(\`config_id.in.(${configIds.join(",")}),config_id.is.null\`)` |

