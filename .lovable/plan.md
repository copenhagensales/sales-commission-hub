

## Tilføj telefon-søgning til Alka-lookup

### Hvad der mangler
`alka-reference-lookup` edge funktionen understøtter kun `sampleCampaign` mode (henter ét tilfældigt salg fra en kampagne). Den har ikke logik til at søge efter specifikke telefonnumre på tværs af ALLE Alka-kampagner — derfor får jeg "Pass {sampleCampaign}" tilbage.

### Hvad jeg bygger

**Udvid `alka-reference-lookup/index.ts` med en ny `phones` mode:**

Når request body indeholder `{phones: ["22799970", ...], days: 10}`:

1. **Normalisér numre** — strip `+45`, mellemrum, bindestreger → kerne 8-cifret
2. **Hent ALLE Alka-projekter** (ikke kun "Alka - Mødebooking"), da Permission/Police kan ligge under andre projekter
3. **Iterér dag for dag** (i dag → 10 dage tilbage) gennem `/simpleleads` for hvert projekt
4. **For hver lead** scan alle felter rekursivt (`data.*`, `cusTELEFONNR_MOBIL`, `cusTELEFONNR_FASTNET`, `phone`, `mobile`, m.fl.) — match både med og uden `+45` præfiks
5. **Når match findes**: hent også `/leads/{id}` for fuld payload, og returnér:
   - Lead-ID + projekt + kampagne-navn
   - Telefonnummer der matchede + hvilket felt
   - Status, closure, closureData
   - Kunde-info (navn, adresse, forbund)
   - `firstProcessedByUser` + `lastModifiedByUser` (rå orgCode + resolveret email/navn fra users-map)
   - Sale-tidsstempler
   - Hele rå payload

6. **Returnér struktureret resultat** pr. søgt nummer:
   ```json
   {
     "matches": {
       "22799970": { found: true, lead: {...} },
       "23301572": { found: false, scannedDays: 10, scannedLeads: 12500 }
     }
   }
   ```

### Hvorfor de tidligere søgninger fejlede

Den oprindelige `alka-attribution-probe` brugte kun ét projekt (`Alka - Mødebooking`) og scannede kun success-leads i specifikke kampagner. De 4 numre kan ligge i:
- Andre projekter (fx ren Permission/Police-konvertering)
- Leads der ikke har status "success" i dialeren (fordi salget afsluttes uden for telefonen)

Den nye mode scanner ALLE projekter og ALLE leads (ikke kun success), så vi finder dem uanset hvor de ligger.

### Efter implementering

Jeg deployer funktionen og kører den med dine 4 numre med det samme. Hvis numrene findes nogen steder i Alka denne uge, får du fuld data tilbage. Hvis stadig 0 matches, har vi bevis for at numrene ikke ligger i `cphsales` HeroBase-konto, og må undersøge en anden konto/integration.

### Hvad jeg IKKE rører
- `sampleCampaign` mode (eksisterende logik bevares)
- Andre integrationer
- Database, RLS, frontend

