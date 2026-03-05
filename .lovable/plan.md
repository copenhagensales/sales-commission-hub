

## Send kontraktkopi ved underskrift

### Problem
Edge-funktionen `send-contract-signed-confirmation` eksisterer allerede og sender en email med kontraktkopi, men den bliver aldrig kaldt fra underskriftsflowet i `ContractSign.tsx`.

### Løsning
Tilføj et kald til edge-funktionen i `signMutation.onSuccess` i `ContractSign.tsx`. Kaldet sker asynkront (fire-and-forget) så det ikke blokerer brugerens flow.

### Ændring
**Fil**: `src/pages/ContractSign.tsx` — i `signMutation`'s `onSuccess` callback (linje 232-236):

1. Efter `toast.success(...)`, kald edge-funktionen med `contractId`, `employeeName`, `employeeEmail`, `contractTitle`, `signedAt` og `ipAddress`.
2. Gem `signedAt` og `ipAddress` som variabler der kan tilgås i `onSuccess` (flyttes til mutation scope via closure eller mutateAsync return).
3. Kaldet wraps i try/catch så fejl i email-afsendelse ikke påvirker brugerens oplevelse.

Ingen database-ændringer. Ingen nye filer.

