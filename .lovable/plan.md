

# Implementering af Sync UI-forenkling

Diffet er korrekt og klar til implementering. Alle tekniske problemer er adresseret.

## Hvad skal implementeres

### 1. Ny fil: `src/components/settings/SyncDateRangeDialog.tsx`
- Controlled dialog med `open`/`onOpenChange` props
- Fra/til dato-vaelgere + dataset checkboxes (Salg, Calls)
- Kalder `safe-backfill` action via integration-engine
- Validering af datoer og mindst et valgt dataset

### 2. Ny fil: `src/components/settings/SyncSingleSaleDialog.tsx`
- Controlled dialog med `open`/`onOpenChange` props
- External ID input felt
- Kalder `enrichment-healer` med `saleExternalId`, `provider`, `integrationId` filtre
- Viser resultat inline (healed/failed/skipped)

### 3. Opdater: `src/components/settings/DialerIntegrations.tsx`
- Fjern `syncDays` og `callsDays` state
- Tilfoej `syncDateRangeDialogId` og `syncSingleSaleDialogId` state
- Erstat `syncMutation` med `triggerManualSync` async funktion
- Fjern inline sync-knapper (dage-input, Play, BatchMigrationDialog)
- Udvid dropdown-menu med sektioner: Sync, Calls, Webhooks, Administration
- Render `SyncDateRangeDialog` og `SyncSingleSaleDialog` udenfor dropdown via conditional rendering
- Opdater auto-sync status badge med sidste sync-tidspunkt
- Erstat `BatchMigrationDialog` import med de to nye dialogs

### 4. Opdater: `supabase/functions/enrichment-healer/index.ts`
- Tilfoej `saleExternalId`, `providerFilter`, `integrationIdFilter` parsing
- Betinget query-building: spring status/attempts-filtre over naar `saleExternalId` er angivet
- Tilfoej `integration_id` til select-kolonner

### Ingen sletninger endnu
- `BatchMigrationDialog.tsx` beholdes i kodebasen men importeres ikke laengere fra `DialerIntegrations`

## Tekniske noter
- Controlled dialog pattern undgaar Radix UI portal-konflikten mellem DropdownMenu og Dialog
- Conditional rendering (`{syncDateRangeDialogId && ...}`) sikrer at state nulstilles ved unmount/remount
- `triggerManualSync` bruger `async/await` i stedet for `useMutation` -- dette er korrekt da funktionen kun kaldes fra dropdown onClick

