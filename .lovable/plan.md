

# Tilføj "Medlemsnummer" som matchningskolonne

## Problem
Ase's annulleringsfil bruger **Medlemsnummer** til at identificere salg, men upload/match-systemet understøtter kun telefon, virksomhed og OPP-nummer. Medlemsnummeret findes allerede i salgsdata (`raw_payload.data.Medlemsnummer` og `normalized_data.member_number`), men der er ingen UI eller matchningslogik til at bruge det.

## Løsning

| Ændring | Hvad |
|---------|------|
| **Database migration** | Tilføj kolonne `member_number_column TEXT` til `cancellation_upload_configs` |
| `src/components/cancellations/UploadCancellationsTab.tsx` | Tilføj state `memberNumberColumn`, vis dropdown i kolonnemapping-UI, inkluder i match-logik (slå op i `normalized_data->>'member_number'`), gem/læs fra config |

## Matchningslogik
Når `memberNumberColumn` er sat:
1. Udtræk alle medlemsnumre fra Excel-filen
2. For hver kandidat-sale: tjek `normalized_data->>'member_number'` mod det uploadede sæt
3. Tilføj også lookup-map `uploadedRowByMemberNumber` så den matchede Excel-række kan associeres

## UI-ændring
Tilføj en ny dropdown **"Medlemsnr.-kolonne (valgfri)"** ved siden af de eksisterende kolonnevælgere (telefon, virksomhed, OPP, produkt, omsætning, provision).

## Filer
- `supabase/migrations/` — ny migration
- `src/components/cancellations/UploadCancellationsTab.tsx` — state, UI, match-logik, config save/load

