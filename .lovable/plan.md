

# Tilføj "Ignorer alle" knap til Fejl i match

## Ændringer

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/MatchErrorsSubTab.tsx` | Tilføj "Ignorer alle" knap med AlertDialog bekræftelse under tabellen |

## Detaljer
1. Tilføj imports for `AlertDialog` komponenter og `Trash2` ikon
2. Tilføj en `useMutation` der:
   - Grupperer alle synlige rækker per `importId`
   - For hver import: henter `unmatched_rows`, fjerner de matchende rækker, opdaterer med `null` hvis tom
3. Placer knappen under tabellen (same pattern som "Godkend alle" i ApprovalQueueTab) med `AlertDialog` bekræftelse: "Er du sikker på at du vil ignorere alle fejlede rækker? De vil blive fjernet permanent."
4. Invaliderer `match-errors` query efter success

