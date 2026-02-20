

# Heartbeat: Daglig opdatering af `last_accessed_at` (nat)

## Tilgang
I stedet for en 5-minutters heartbeat, saet intervallet til 24 timer. Naar et TV-board henter config (hvert 30. sekund via `useTvBoardConfig`), tjekker vi om der er gaaet 24+ timer siden sidste heartbeat. Hvis ja, opdateres `last_accessed_at`.

Da TV-boards koerer 24/7, vil den foerste refresh efter midnat automatisk trigge opdateringen -- saa det sker naturligt om natten.

## Aendring

### Fil: `src/hooks/tv-board/useTvBoardConfig.ts`

Tilfoej i `refresh()` efter succesfuld datahentning:

```text
const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 timer
const lastHeartbeatRef = useRef(0);

// I refresh(), efter setTvData(data):
const now = Date.now();
if (now - lastHeartbeatRef.current > HEARTBEAT_INTERVAL) {
  lastHeartbeatRef.current = now;
  supabase
    .from("tv_board_access")
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: (data.access_count || 0) + 1,
    })
    .eq("id", data.id)
    .then(); // fire-and-forget
}
```

### Ingen andre aendringer
- Stale-indikatorer i `TvLinksSettingsTab.tsx` og `TvBoardAdmin.tsx` forbliver som de er
- Ingen database-aendringer

