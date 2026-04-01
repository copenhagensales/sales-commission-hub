

## Opret ny Adversus-integration: Eesy TM

### Overblik
Opretter en ny `dialer_integrations`-row for "Eesy TM" med provider `adversus` og de angivne API-credentials, krypteret med `DB_ENCRYPTION_KEY`. Derefter verificeres API-forbindelsen, kampagner synkroniseres, og cron-jobs oprettes.

### Eksisterende kontekst
- **Client**: "Eesy TM" (`81993a7b-ff24-46b8-8ffb-37a83138ddba`)
- **Client Campaign**: "Eesy TM Products" (`d031126c-aec0-4b80-bbe2-bbc31c4f04ba`)
- **Eksisterende Adversus-integrationer**: Lovablecph (`26fac751`), Relatel_CPHSALES (`657c2050`)
- Der findes allerede ~20+ Eesy TM kampagnemappings i `adversus_campaign_mappings` (fra Lovablecph-kontoen)

### Trin

**1. Opret integrationen i databasen**
- Kald `create_dialer_integration` RPC med:
  - `p_name`: `"Eesy TM"`
  - `p_provider`: `"adversus"`
  - `p_credentials`: `'{"username":"CPHSalesAPI","password":"e36iv65wzk008w44c8ksowgok"}'`
  - `p_encryption_key`: fra `DB_ENCRYPTION_KEY` secret
- Dette indsætter en ny aktiv row med krypterede credentials

**2. Verificer API-forbindelsen**
- Kald `integration-engine` med `action: "fetch-sample-fields"` for den nye integration-ID
- Bekræft at vi får kampagner og sample-data retur fra Adversus API

**3. Synk kampagner + brugere**
- Kald `integration-engine` med `actions: ["campaigns", "users"]` for den nye integration
- Verificer at kampagnerne matcher de eksisterende Eesy TM-mappings
- Map nye kampagner til "Eesy TM Products" client campaign

**4. Test salgssynkronisering**
- Kald `integration-engine` med `actions: ["sales"]` og `days: 1` 
- Verificer at salg hentes og gemmes korrekt med produkter og agent-data

**5. Opret cron-jobs (via migration)**
- **Sales sync**: Hvert 15. minut (forskudt fra eksisterende jobs) — f.eks. `13,28,43,58 * * * *`
- **Meta sync**: Hver 30. minut (forskudt) — f.eks. `15,45 * * * *`
- Payload-format matcher eksisterende Adversus-jobs men med det nye integration-ID

### Vigtige overvejelser
- Kampagnemappings er globale (ingen `integration_id` kolonne) — de eksisterende Eesy TM-mappings vil automatisk blive brugt af den nye integration
- `adversus_campaign_mappings` tabellen har `reference_extraction_config` for OPP-udlæsning som allerede er sat op
- Credentials gemmes krypteret med `pgp_sym_encrypt` via `DB_ENCRYPTION_KEY`
- Den nye integration bruger separate API-credentials (CPHSalesAPI) — dette kan betyde at den ser andre/færre kampagner end Lovablecph-kontoen. Vi verificerer dette i trin 2-3

### Tekniske detaljer
- Integration-engine henter credentials via `get_dialer_credentials` RPC og instantierer `AdversusAdapter` med `{username, password}`
- Cron-jobs kalder `integration-engine` edge function med `integration_id` parameter
- Alle eksisterende stabilitetskontroller (rate limiting, circuit breaker, run locking, working hours) gælder automatisk

