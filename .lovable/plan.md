
# Tilføj "Data" kolonne til Sync Runs tabellen

## Hvad
En ny kolonne "Data" i tabellen "Seneste Sync Runs" på System Stability-siden, der viser hvor mange records hver sync-kørsel har hentet/behandlet.

## Hvordan
- Tilføj en ny `TableHead` og `TableCell` kolonne med label "Data" i tabellen
- Vis `records_processed` værdien fra hver sync run
- Fremhæv visuelt runs der henter mange records (fx fed skrift eller farve over en tærskel)
- Vis "0" i dæmpet farve når intet data blev hentet, så man hurtigt kan skelne aktive fra tomme syncs

## Fil der ændres
- `src/pages/SystemStability.tsx` — tilføj kolonne i Recent Runs tabellen (TableHeader + TableBody)

## Teknisk detalje
- Feltet `records_processed` eksisterer allerede i `integration_sync_runs` tabellen og hentes i queryen
- For fallback-data fra `integration_logs` sættes værdien til 0 (allerede i koden)
- Kolonnen placeres efter "Status" og før "Varighed"
