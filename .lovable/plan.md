

# Tilføj "Type" kolonne til Sync Runs tabellen

## Hvad
En ny kolonne "Type" der viser om en sync-kørsel er et "Meta"-kald (campaigns, users) eller et "Sales"-kald, så man hurtigt kan se hvilken type arbejde der blev udført.

## Logik
Data eksisterer allerede i `actions`-arrayet (fx `["sales"]`, `["campaigns", "users", "sales", "sessions"]`). Kolonnen vil vise:

- **Meta** -- hvis actions indeholder "campaigns" eller "users" (typisk meta-syncs)
- **Sales** -- hvis actions kun indeholder "sales"
- **Calls** -- hvis actions kun indeholder "calls"
- **Fuld** -- hvis actions indeholder blanding af meta + data (fx `["campaigns", "users", "sales", "sessions"]`)

Visuelt bruges små farvede badges (fx blaa for Meta, groen for Sales, lilla for Fuld) saa man hurtigt kan skelne typerne.

## Fil der aendres
- `src/pages/SystemStability.tsx`
  - Tilfoej "Type" `TableHead` efter "Integration" kolonnen
  - Tilfoej `TableCell` med logik der laaser `run.actions` og viser passende badge
  - Opdater `colSpan` i tom-tilstand fra 7 til 8

## Teknisk detalje
Ingen database-aendringer -- `actions` arrayet hentes allerede i den eksisterende query. Aendringen er rent UI-baseret.

