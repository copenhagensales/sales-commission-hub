

# Tilfoej watermark-baseret incremental sync til calls

## Problem
Calls-sync henter **alle opkald fra de seneste 3 dage** ved hvert meta-job-kald (hvert 30. minut). Det giver ~12.000 records pr. kald -- dobbelt op, da data allerede er hentet.

Sessions-sync bruger allerede watermarks korrekt (linje 374-411 i `sync-integration.ts`), men calls (linje 336-354) goer det ikke.

## Loesning
Kopier praecis den samme watermark-strategi fra sessions til calls:

1. Laes `dialer_sync_state` for dataset `"calls"` 
2. Beregn vindue: `last_success_at - 5 min overlap` til `now() - 2 min buffer`
3. Brug `fetchCallsRange({ from, to })` med dette vindue
4. Gem ny watermark efter succesfuld sync

## Aendring

### Fil: `supabase/functions/integration-engine/actions/sync-integration.ts`

Erstat calls-blokken (linje 336-367) med watermark-logik identisk med sessions-blokken:

```text
Foer (linje 336-354):
  if (actionList.includes("calls") && ...) {
    if (fetchCallsRange && from && to) {
      // kun ved explicit from/to parameter
    } else if (adapter.fetchCalls) {
      calls = await adapter.fetchCalls(days);  // <-- ALTID 3 dages data
    }
  }

Efter:
  if (actionList.includes("calls") && ...) {
    try {
      const callsSyncState = await getSyncState(supabase, integration.id, "calls");
      const callsWindowStart = callsSyncState?.last_success_at
        ? new Date(new Date(callsSyncState.last_success_at).getTime() - 5 * 60 * 1000)
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const callsWindowEnd = new Date(Date.now() - 2 * 60 * 1000);

      // Explicit from/to fra request overskriver watermark
      if (from && to) {
        callsWindowStart = new Date(from);
        callsWindowEnd = new Date(to);
      }

      log("INFO", `Calls window: ${callsWindowStart.toISOString()} -> ${callsWindowEnd.toISOString()}`);

      if ((adapter as any).fetchCallsRange) {
        calls = await (adapter as any).fetchCallsRange({
          from: callsWindowStart.toISOString(),
          to: callsWindowEnd.toISOString(),
        });
      } else if (adapter.fetchCalls) {
        calls = await adapter.fetchCalls(days);  // fallback
      }

      if (calls.length > 0) {
        runResults["calls"] = await engine.processCalls(calls, integration.id);
        actionsExecuted.push("calls");
      } else {
        runResults["calls"] = { processed: 0, errors: 0, matched: 0, message: "No calls" };
      }

      await upsertSyncState(supabase, integration.id, "calls", callsWindowEnd);
    } catch (callsErr) {
      // error handling + recordSyncError
    }
  }
```

### Forventet effekt
- **Foerste kald**: Ingen watermark, falder tilbage til `days`-baseret hentning (3 dage).
- **Efterfoelgende kald**: Henter kun nye opkald siden sidste succesfulde sync (+5 min overlap).
- **Resultat**: Fra ~12.000 records pr. meta-kald til typisk 0-50 records, medmindre der er reelt nye data.

### Ingen andre filaendringer nødvendige
- `getSyncState`, `upsertSyncState`, `recordSyncError` er allerede importeret (linje 4).
- Begge Adversus og Enreach adaptere understotter allerede `fetchCallsRange`.
- Debug-log blokken (linje 356-367) bevares uaendret.

