

# Fix: Filtrer "Fejl i match" på client_id direkte

## Problem
`MatchErrorsSubTab` filtrerer via `cancellation_upload_configs.config_id`, men inkluderer også alle imports med `config_id IS NULL` — hvilket viser data fra andre klienter. Tabellen `cancellation_imports` har allerede en `client_id` kolonne.

## Ændring

### `src/components/cancellations/MatchErrorsSubTab.tsx`

Erstat den nuværende config-baserede filtrering (linje 45-58) med direkte filtrering:

```typescript
if (clientId) {
  query = query.eq("client_id", clientId);
}
```

Dette fjerner den unødvendige config-lookup og sikrer at kun imports for den valgte klient vises.

