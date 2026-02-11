

## Tilfoej debug-logging til fetchSalesRange

### Problem
`fetchSalesRange` (linje 428-483) mangler debug-logging, saa vi kan ikke se om telefonnummer 004551806520 bliver hentet fra HeroBase API og derefter filtreret fra. Kun `fetchSales` (den daglige sync) gemmer debug data.

### Loesning
Tilfoej samme debug-tracking til `fetchSalesRange` som allerede findes i `fetchSales`, samt et specifikt telefonnummer-soeg saa vi kan spore praecis hvad der sker med leadet.

### AEndringer

**Fil: `supabase/functions/integration-engine/adapters/enreach.ts`**

1. Tilfoej raw lead tracking og skipReasonMap til `fetchSalesRange` (ligesom i `fetchSales`):
   - Opret `allRawLeads` array og `skipReasonMap` i `fetchSalesRange`
   - Gem alle raw leads i `allRawLeads` foer filtrering
   - Track skip-reasons for closure og dataFilter
   - Track skip-reasons for email-whitelist
   - Gem debug data i `this.lastDebugData` efter pagination

2. Tilfoej telefonnummer-soegning i pageProcessor (baade `fetchSales` og `fetchSalesRange`):
   - Log specifikt naar et lead med telefonnummer `51806520` ses i raw data
   - Log hvilken closure, agent-email og kampagne leadet har
   - Log om det filtreres fra og af hvilken grund

### Teknisk detalje

Konkret aendres `fetchSalesRange` metoden (linje 428-483) til at:

```text
fetchSalesRange (foer)          fetchSalesRange (efter)
--------------------------      --------------------------
Henter leads                    Henter leads
Filtrerer closure=success       Gemmer ALLE raw leads
Filtrerer dataFilters           Filtrerer closure=success (tracker skip)
Filtrerer email                 Filtrerer dataFilters (tracker skip)
Returnerer                      Filtrerer email (tracker skip)
                                Soeger efter 51806520
                                Gemmer debug data
                                Logger diagnostik
                                Returnerer
```

Dette sikrer at naeste gang vi koerer en catch-up sync, kan vi se i debug-loggen praecis hvad der skete med det manglende lead.

### Test
Efter deploy koeres en ny catch-up sync for 27-29. januar 2026, og derefter tjekkes `integration_debug_log` for at se om telefonnummeret dukker op i raw_items, skipped_items eller registered_items.
