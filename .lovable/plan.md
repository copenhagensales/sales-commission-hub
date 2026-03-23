

# Ny fane: "Ingen match" — vis umatchede salg

## Overblik
Tilføj en ny fane der viser to lister:
1. **Upload-rækker uden match** — rækker fra Excel-filen der ikke matchede noget salg i systemet
2. **System-salg uden match** — salg i systemet (for den valgte kunde/periode) der ikke er i den uploadede fil

## Database

### Tilføj `unmatched_rows` JSONB kolonne til `cancellation_imports`
Gemmer de uploadede rækker der ikke matchede ved import-tidspunktet, så "Ingen match"-fanen kan vise dem uden at brugeren skal uploade igen.

## Kodeændringer

### 1. `UploadCancellationsTab.tsx` — Gem umatchede rækker
Efter matching: identificer hvilke `parsedData`-rækker der **ikke** matchede (ingen tilsvarende sale fundet). Gem dem som `unmatched_rows` JSONB-array på `cancellation_imports` ved insert.

### 2. Ny komponent: `UnmatchedTab.tsx`
- Vælg en import fra dropdown (hent fra `cancellation_imports`)
- **Sektion 1: "I upload men ikke i system"**
  - Hent `unmatched_rows` fra den valgte `cancellation_imports`-række
  - Vis i tabel med de originale Excel-kolonner (OPP, telefon, virksomhed osv.)
- **Sektion 2: "I system men ikke i upload"**
  - Hent alle salg for kunden i perioden (via `client_campaign_id`)
  - Hent alle `sale_id`'er fra `cancellation_queue` for den valgte import
  - Vis salg der IKKE er i `cancellation_queue` — altså system-salg uden match
  - Vis: Salgsdato, Sælger, OPP, Telefon, Virksomhed, Status

### 3. `Cancellations.tsx` — Tilføj fanen
- Ny fane "Ingen match" med permission `tab_cancellations_unmatched`
- Render `UnmatchedTab`

| Fil | Ændring |
|-----|---------|
| Migration | Tilføj `unmatched_rows JSONB` til `cancellation_imports` |
| `UploadCancellationsTab.tsx` | Beregn og gem umatchede rækker ved import |
| `UnmatchedTab.tsx` | Ny komponent med to sektioner |
| `Cancellations.tsx` | Tilføj "Ingen match" fane |

