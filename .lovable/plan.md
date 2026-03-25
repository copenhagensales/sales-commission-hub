

# Ændringer i ApprovalQueueTab

## Ændringer
1. **Fjern "Afvis alle"** knappen fra begge tabs (cancellation + basket_difference)
2. **Flyt "Godkend alle"** ned under tabellen (efter `renderTable()`)
3. **Tilføj bekræftelsesdialog** (AlertDialog) der spørger "Er du sikker?" før godkendelse køres

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/ApprovalQueueTab.tsx` | Fjern "Afvis alle", flyt "Godkend alle" under tabel, tilføj AlertDialog bekræftelse |

## Detaljer
- Begge steder (linje 1148-1156 og 1162-1170) ændres: fjern div med knapper over tabellen, tilføj "Godkend alle" med AlertDialog wrapper under `renderTable()`
- AlertDialog bruger eksisterende `@/components/ui/alert-dialog` komponent
- Bekræftelsestekst: "Er du sikker på at du vil godkende alle ventende rækker?"

