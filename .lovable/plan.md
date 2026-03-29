

## Problem

"Lokaliser salg" gemmer ændringer direkte i databasen (`cancellation_queue` + fjerner fra `unmatched_rows`) med det samme. Ved rollback slettes import og kø-poster, men hvis noget går galt, efterlader det "spøgelsesdata". Brugeren ønsker at "Lokaliser salg" først persisterer ved godkendelse — ligesom sælger-mappings er fine at gemme med det samme.

## Løsning

Ændre "Lokaliser salg" til at gemme matches lokalt i UI-state frem for direkte i databasen. Først når brugeren klikker "Send til godkendelse" (eller tilsvarende bekræftelse), persisteres de manuelle matches til `cancellation_queue`.

### Ændringer

**1. `MatchErrorsSubTab.tsx`** — Tilføj lokal state for manuelle matches
- Tilføj `localManualMatches: Map<string, { saleId: string; row: FlatUnmatchedRow }>` state
- Når `LocateSaleDialog` returnerer et match, gem det i denne state i stedet for at kalde DB
- Vis matchede rækker visuelt som "afventer bekræftelse" (f.eks. grøn markering + salg-ID badge)
- Tilføj en "Bekræft manuelle matches" knap der batch-inserter alle lokale matches til `cancellation_queue` og fjerner dem fra `unmatched_rows`
- Rækker med lokalt match fjernes fra fejl-listen

**2. `LocateSaleDialog.tsx`** — Returnér match i stedet for at persistere
- Fjern den direkte `supabase.from("cancellation_queue").insert()` og `unmatched_rows`-opdatering fra `linkSaleMutation`
- I stedet kald en ny `onMatch(saleId, row)` callback prop der sender data op til parent
- Behold salg-søgning og UI uændret

**3. Ingen ændring af:**
- `upsertMapping` (sælger-mapping) — den gemmes stadig med det samme som ønsket
- Rollback-funktionen
- Godkendelseskø-logikken

### Teknisk detalje

```text
Nuværende flow:
  Lokaliser salg → INSERT cancellation_queue + UPDATE unmatched_rows → Godkendelse

Nyt flow:
  Lokaliser salg → lokal state i MatchErrorsSubTab → "Bekræft" knap → INSERT + UPDATE → Godkendelse
```

Filer: `LocateSaleDialog.tsx`, `MatchErrorsSubTab.tsx`

