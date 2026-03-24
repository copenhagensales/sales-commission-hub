

# Ny fane: "Tidligere uploads" med kundefiltrering

## Problem
Upload-historikken vises i dag inde i Upload/match-fanen. Brugeren vil have den som separat fane, filtreret på den valgte kunde.

## Ændringer

| Ændring | Detaljer |
|---------|----------|
| **DB migration** | `ALTER TABLE cancellation_imports ADD COLUMN client_id UUID REFERENCES clients(id);` — så uploads kan knyttes til en kunde |
| **UploadCancellationsTab.tsx** | Gem `clientId` i insert til `cancellation_imports` (linje ~617). Fjern `CancellationHistoryTable` fra denne komponent hvis den bruges her. |
| **CancellationHistoryTable.tsx** | Tilføj `clientId` prop. Filtrér query med `.eq("client_id", clientId)` når clientId er sat. |
| **Cancellations.tsx** | Tilføj ny fane `{ value: 'history', label: 'Tidligere uploads' }` i `visibleTabs`. Render `CancellationHistoryTable` med `clientId={selectedClientId}`. |

## Flow
1. Når en fil uploades, gemmes den valgte kundes `client_id` på `cancellation_imports`-rækken.
2. Fanen "Tidligere uploads" viser kun imports for den valgte kunde.
3. Ingen permission-gate for nu (følger owner/upload-permission).

## Tekniske detaljer
- Migration: simpel `ADD COLUMN` med nullable FK til `clients(id)`
- Insert i `UploadCancellationsTab`: tilføj `client_id: clientId` i insert-objektet
- `CancellationHistoryTable`: modtager `clientId: string` prop, tilføjer `.eq("client_id", clientId)` filter, og viser tom-state hvis ingen kunde er valgt

