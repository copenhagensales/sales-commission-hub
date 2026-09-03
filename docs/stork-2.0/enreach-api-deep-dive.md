# Enreach (HeroBase) API i Stork 1.0 — deep dive

Forarbejde til Lag E (Stork 2.0). Faktarapport, ingen anbefalinger.

Scope:
- Den rå Enreach API (HeroBase) — endpoints, formater, idiosynkrasier.
- 1.0's wrapper er kun observation — hvilke felter og edge cases driften har afsløret.
- IKKE: detaljeret pricing-/lønberegning.

Empirisk grundlag:
- Kode i `/home/user/sales-commission-hub` (state pr. 2026-05-13).
- DB-state læst fra `docs/system-snapshot.md`.
- Live Supabase MCP forbundet til Stork 2.0 — ingen direkte queries mod 1.0-prod.

---

## 1. Hvad Enreach egentlig er

"Enreach" i Stork-konteksten er **et brand-navn** for et white-label-API hostet på **HeroBase** (Benemen). Faktisk URL er `https://wshero01.herobase.com/api`. Internt kalder koden den ofte "HeroBase" eller refererer til "Benemen" (via header `X-Benemen-Event`).

Auth er **HTTP Basic** (username + password). Adapter understøtter også Bearer-token, men det er ikke set i prod-credentials.

### Enreach-integrationer (`dialer_integrations.provider = 'enreach'`)

Stork har konfigureret mindst tre Enreach-konti — disse er IKKE samme HeroBase-tenant nødvendigvis, men deler alle samme base-URL og auth-skema.

| Integration-navn | `dialer_integrations.id` | Klient | Speciel adfærd |
|---|---|---|---|
| `ase` | `a76cf63a-4b02-4d99-b6b5-20a8e4552ba5` | ASE A-kasse | Bruger `/leads` endpoint (ikke `/simpleleads`) — eneste integration med dette |
| `tryg` | `a5068f85-da1c-43e1-8e57-92cc5c4749f1` | Tryg Forsikring | Bruger `/simpleleads` |
| `alka` | `48d8bd23-df14-41fe-b000-abb8a4d6cd1d` | Alka A-kasse | Bruger `/simpleleads` + `enableUserPreFetch=true` |

(`dialer_integrations` tabellen har 7 rækker totalt. Resten er Adversus.)

Bemærk: `ase`, `tryg`, `alka` er live alle tre, men deler samme HeroBase-platform med forskellig data og forskellig konfiguration.

### `dialer_integrations.api_url` for Enreach
Default `https://wshero01.herobase.com/api`. Hvis udfyldt, sanitiziseres (`adapter:97-113`):
- Fjern `Web: `, `URL: `, `API: `, `Endpoint: ` prefiks (`adapter:99`).
- Tilføj `https://` hvis mangler.
- Tilføj `/api` hvis ikke afsluttet med det.

Sample fra ase-integrationen viser `api_url: "https://wshero01.herobase.com/api"` (`docs/system-snapshot.md:6262`).

### Credentials format

Stork dekrypterer credentials via `get_dialer_credentials()` RPC og forventer JSON med:
```ts
{
  username?: string,
  password?: string,
  api_token?: string,   // Hvis indeholder ":" → Basic Auth (user:pass), ellers Bearer
  api_url?: string,      // Override af base-URL
  org_code?: string      // Default OrgCode for /calls
}
```

Adapter prøver Basic (username+password) først, så api_token (Basic eller Bearer afhængigt af om det indeholder ":") (`adapter:124-137`).

---

## 2. API-endpoints

Stork rør følgende HeroBase-endpoints:

| Endpoint | Metode | Brugt af | Returnerer |
|---|---|---|---|
| `/myaccount` | GET | adapter (orgCode auto-discovery) | Account info inkl. `OrgCode` |
| `/myaccount/request/limits` | GET | `fetchRateLimits`, probe | Rate-limit konfiguration |
| `/myaccount/request/counts` | GET | `fetchRateLimits`, probe | Aktuel brug (per-minute counter) |
| `/projects` | GET | `fetchAccessibleProjects` | Liste over projects (uniqueId, name, active) |
| `/campaigns` | GET | `fetchCampaigns` (returnerer `[]`!), webhook-manager `campaigns`-action, probe | Kampagner |
| `/campaigns?Limit=500` | GET | alka-reference-lookup | — |
| `/simpleleads?Projects=*&ModifiedFrom=YYYY-MM-DD&AllClosedStatuses=true&skip=N&take=N` | GET | `processPageByPage` (default sales-vej) | Lette lead-objekter |
| `/simpleleads?Projects=X&Campaigns=Y&...&Include=lastModifiedByUser,firstProcessedByUser` | GET | probe, alka-lookup | Med user-info inkluderet |
| `/leads?SearchName=cphsales2&ModifiedFrom=...&Include=data,campaign,lastModifiedByUser,firstProcessedByUser&skip=N&take=N` | GET | ASE-integration | Detaljeret lead inkl. `data`-objekt |
| `/leads/{uniqueId}` | GET | enreach-diagnostics, alka-lookup | Single lead detail |
| `/leads/{uniqueId}?Include=lastModifiedByUser,firstProcessedByUser` | GET | probe | Single lead med users |
| `/leads?<diverse parametre>` | GET | enreach-diagnostics (eksperimenterer med 12+ varianter) | Test |
| `/users?Limit=N` | GET | `ensureUserOrgCodeMap` (kun ved `enableUserPreFetch=true`), alka-probe, probe | Liste over users |
| `/calls?OrgCode=X&StartTime=ISO&TimeSpan=PT2H&Limit=5000` | GET | `fetchCallsChunkWithOrg` | CDR (call detail records) |
| `/hooks` | GET, POST | `enreach-manage-webhooks` (list, create) | Webhook-administration |
| `/hooks/{id}` | DELETE | `enreach-manage-webhooks` | Slet webhook |
| `/hooks/{id}/example` | GET | `enreach-manage-webhooks` (action="example") | Eksempel-payload fra registreret webhook |
| `/hooks/meta` | GET | `enreach-manage-webhooks` (action="meta") | Metadata om webhook-konfig |

### Endpoint-quirks

- **`/simpleleads`** er den primære lette endpoint — flat lead-struktur, kun visse felter.
- **`/leads`** har samme data men kræver `Include=` parametre for at få relaterede objekter (data, campaign, users). ASE bruger denne med `SearchName=cphsales2`.
- **`/sales`, `/orders`, `/results`, `/flow`, `/flows`** prøvet i `enreach-diagnostics:332-341` som "alternative endpoints" — alle returnerede 404 eller noget ubrugeligt. Stork bruger dem ikke.

### URL-format

- Stork sætter `/api`-suffix på base-URL (`adapter:111-113`).
- Trailing slash strippes.
- Endpoint-paths starter med `/`.
- HeroBase aksepterer både PascalCase og camelCase i query params (men adapter bruger PascalCase: `Projects`, `ModifiedFrom`, `Statuses`, `Limit`, `SearchName`).

### Query-parametre

- `Projects=*` — wildcard, alle projekter. Eller komma-separeret liste af project uniqueId'er.
- `Campaigns=X,Y` — liste af campaign uniqueId'er.
- `ModifiedFrom=YYYY-MM-DD` — inklusiv.
- `ModifiedTo=YYYY-MM-DD` — **exklusiv** (`adapter:617`: "ModifiedTo bumped +1d for exclusive API"). Stork tilføjer +1 dag for at simulere inklusiv.
- `AllClosedStatuses=true` — inkludér alle closure-typer.
- `Statuses=UserProcessed` — kun status "UserProcessed".
- `LeadClosures=Success` — kun lukket med success.
- `Include=data,campaign,lastModifiedByUser,firstProcessedByUser` — eager-loading af relaterede objekter (særligt for `/leads`).
- `IncludeAnswers=true` — inkludér resultat-data (sjælden).
- `SearchName=cphsales2` — search-name brugt af ASE.
- `skip=N&take=N` — pagination (`take` er sidens størrelse, max 1000-5000 afhængigt af endpoint).
- `Limit=N` — ofte synonym med take, brugt på flere endpoints.
- `OrgCode=X` — for `/calls` endpoint (org-filter).
- `StartTime=ISO` + `TimeSpan=ISO-8601-duration` — for `/calls` chunk fetching (typisk `PT2H` = 2 timer).
- `DialTimeFrom=YYYY-MM-DD` — tested but not used.

### Pagination

Pagination via `skip` + `take` (zero-baseret skip). Standard `take=500`. `fetchSalesRaw` bruger `take=limit` (default 20). `fetchUsers` bruger `take=1000`. `/calls` bruger `Limit=5000` per chunk.

**Pagination stuck-detection** (`adapter:340-346`): hvis to consecutive pages har samme `firstId`, stopper adapter for at undgå infinite loop — nogle endpoint-varianter ignorerer skip/take.

---

## 3. Response-formatet

HeroBase responses er **inkonsistente i wrapper-shape**. Adapter prøver flere muligheder:
```ts
const arr = Array.isArray(data)
  ? data
  : (data.Results || data.results || data.Leads || data.leads || data.Data || data.data || []);
```

(`adapter:331-336`, `enreach-diagnostics:129`, m.fl.)

For specifikke endpoints kan responsen være:
- Top-level array (flest endpoints).
- `{ Results: [...] }` eller `{ results: [...] }`.
- `{ Leads: [...] }` / `{ leads: [...] }`.
- `{ Data: [...] }` / `{ data: [...] }`.
- `{ Projects: [...] }` / `{ projects: [...] }`.
- `{ campaigns: [...] }` / `{ Campaigns: [...] }`.

Probe har observeret at `/myaccount`-endpoint returnerer single object med `OrgCode`-felt (`adapter:1471-1479`).

### Field-naming: PascalCase vs camelCase

HeroBase serverer **både PascalCase og camelCase versioner af samme field** afhængigt af endpoint og version. Adapter bruger `getStr()` (`adapter:233-237`) og `getValue()` (`adapter:214-231`) helpers der prøver flere keys:
```ts
this.getStr(obj, ["uniqueId", "UniqueId"]);
this.getStr(obj, ["closure", "Closure"]);
this.getStr(obj, ["firstProcessedTime", "FirstProcessedTime"]);
```

Plus `getValue` har en case-insensitive fallback der prøver lowercase-matches på samtlige nøgler i objektet — fanger eksotiske casing-varianter.

### `/simpleleads` lead-objekt

Real sample fra `integration_debug_log` (alka, provider="alka") (`docs/system-snapshot.md:9928-9967`):

```json
{
  "uniqueId": "82549084S3064",
  "status": "UserProcessed",
  "closure": "NotInterested",
  "priority": 10,
  "uploadTime": "2026-03-30T09:04:24.0000000",
  "lastModifiedTime": "2026-05-06T10:16:41.0000000",
  "firstProcessedTime": "2026-05-06T10:16:41.0000000",
  "campaign": {
    "code": "AA_MB_FORBUND_LEJL",
    "uniqueId": "CAMP10062S3064"
  },
  "data": {
    "age": "71",
    "Notater": "",
    "Resultat": "Nej tak",
    "cusPOSTNR": "8200",
    "cusAdresse": "Jens Baggesens Vej 33 1 9  8200 Aarhus N DK",
    "cusFornavn": "Miro",
    "cusEfternavn": "Zujo",
    "cusPART_ID": "45032455",
    "cusKUNDE_ID": "2157167",
    "cusBoligform": "LEJLIGHED",
    "cusPOSTDISTRIKT": "Aarhus N",
    "cusTELEFONNR_MOBIL": "+4560730683",
    "cusTELEFONNR_PRIVAT": "+4586947910"
  },
  "closureData": [],
  "ownerOrgUnit": { "orgCode": "TRYG Forsikring A/S" },
  "uploadedByUser": { "orgCode": "API_ALKA_AC@tryg.dk" },
  "lastModifiedByUser": { "orgCode": "t01asts" },
  "firstProcessedByUser": { "orgCode": "t01asts" }
}
```

### Felt-oversigt

- **`uniqueId`** — primary key, format `<digits>S<digits>` (e.g., `82549084S3064`). Bruges som external_id for både lead og session.
- **`status`** — typically `"UserProcessed"` for closed leads.
- **`closure`** — `"Success"`, `"NotInterested"`, `"InvalidLead"`, `"Callback"`, `"NoAnswer"`, mfl. (`adapter:520-527` — kun `closure.toLowerCase() === "success"` beholdes).
- **`priority`** — integer.
- **Tidspunkter** — alle i format `YYYY-MM-DDTHH:mm:ss.0000000` (`.NET DateTime`, **7-decimal-sekunder, ingen timezone**). Dansk lokaltid implicit. Konverteres til UTC via `_shared/enreach-timezone.ts`.
- **`campaign`** — embedded objekt `{ code, uniqueId }`. `uniqueId` har CAMP-prefix-format (e.g., `CAMP10062S3064`). `code` er fri tekst (`AA_MB_FORBUND_LEJL`).
- **`data`** — flat object med **lead-specifikke felter** (custom per kampagne/projekt). Indeholder kunde-PII (`cusFornavn`, `cusEfternavn`, `cusAdresse`, `cusTELEFONNR_*`, `cusKUNDE_ID`, `cusPART_ID`), kampagne-svar (`Resultat`, `Notater`), og custom-fields (`A-kasse salg`, `Lønsikring`, `Forening`, etc.).
- **`closureData`** — array af produkter for sale-leads. Ofte tom for ikke-success leads.
- **`ownerOrgUnit`** — `{ orgCode }`. Selskab/enheds-niveau.
- **`uploadedByUser`** — `{ orgCode }`. Hvem uploadede leadet.
- **`firstProcessedByUser`** — `{ orgCode }`. Første agent der rørte leadet.
- **`lastModifiedByUser`** — `{ orgCode }`. Sidste agent. **Bruges primært for attribution af salget.**

`/leads` endpoint returnerer **samme struktur men med `Include=` kan tilføje** `email` på user-objekterne, og `data` populeres altid (uden Include kan det være tomt).

### `data`-felter pr. integration

Hver Enreach-tenant + projekt har sit eget `data`-feltsæt. 1.0 har lært specifikke field-keys:

**Tryg-data (mødebooking)** — fra real sample:
- `age`, `Notater`, `Resultat`
- `cusPOSTNR`, `cusAdresse`, `cusFornavn`, `cusEfternavn`
- `cusPART_ID`, `cusKUNDE_ID`, `cusBoligform`, `cusPOSTDISTRIKT`
- `cusTELEFONNR_MOBIL`, `cusTELEFONNR_PRIVAT`
- `Type Datafejl` (ved closure="InvalidLead")
- `Mødedato`, `Mødetidspunkt` (fra `probe-enreach-integration.ts:13` baseline)

**ASE-data (A-kasse-salg)** — hardkodet i adapter (`adapter:1831-1849`):
- `A-kasse salg`, `A-kasse type`
- `Dækningssum`, `daekningssum` (begge findes i prod — casing varierer)
- `Forening`, `Lønsikring`, `loensikring`
- `Eksisterende medlem`, `Medlemsnummer`
- `Nuværende a-kasse`, `nuvaerende a-kasse`
- `Resultat af samtalen`
- `Ja - Afdeling` (værdier: `"Lead"` eller `"Salg"`)
- `Leadudfald`
- `Navn1`, `Navn2`, `Telefon1`

**`/leads` endpoint returnerer lowercase keys for ASE** — adapter normaliserer via `KNOWN_KEY_MAP` (`adapter:1830-1868`). Ikke alle felter mappes; ukendte felter capitaliziseres bare (første bogstav uppercased).

### `closureData` (produkter)

For sale-leads kan `closureData` indeholde produkt-info:
```ts
closureData: [
  { text: "Eesy uden første måned", productName: "..."?, sku?, id?, amount?, quantity?, price? }
]
```

Adapter mapper til StandardProduct (`adapter:963-973`). Stork prøver flere field-navne:
- `text || productName || "Unknown"` → name
- `sku || id || "unknown"` → externalId
- `amount || quantity || 1` → quantity
- `price || amount || 0` → unitPrice

I praksis er `closureData` **ofte tom** — Stork ekstraherer i stedet produkter fra `data`-felterne via konfigurerbare regler (se §5).

### `/calls` CDR-objekt

Fra `mapCdrsToStandardCalls` (`adapter:1631-1687`):
```
{
  uniqueId|UniqueId|Id|CallId: string,
  user|User: { uniqueId, orgCode, email, username },
  campaign|Campaign: { uniqueId, code },
  uniqueLeadId|LeadUniqueId: string,
  StartTime|startTime|Time: ISO,
  EndTime|endTime: ISO,
  Result|result|endCause: string,
  Closure|leadClosure: string,    // "Success" if sale
  Connected|connected: boolean,
  IsAnswered: boolean,
  conversationDuration|ConversationDuration: ISO-8601 duration "PT12M42S",
  dialingDuration|DialingDuration: ISO-8601 duration,
  wrapUpDuration|WrapUpDuration: ISO-8601 duration,
  DurationTotalSeconds|duration|Duration: number,    // fallback seconds
  leadPhoneNumber|PhoneNumber|Phone: string,
  ProjectName: string,
}
```

Durations er **ISO-8601 duration-strings** (`PT12M42S`, `PT6S`) — adapter parser disse i `parseISO8601Duration` (`adapter:1616-1629`).

Status mapping (`adapter:1632-1646`):
- `connected=true OR result="answered"|"connected" OR IsAnswered=true` → `ANSWERED`
- `result="busy"` → `BUSY`
- `result="noanswer"|"no answer"|"no_answer"|"noresponse"` → `NO_ANSWER`
- `result="failed"` → `FAILED`
- Else → `OTHER`

---

## 4. Rate limits og auth

### Rate limit headers

HeroBase returnerer rate-limit-info i hver response (`adapter:262-272`):
- `X-Rate-Limit-Limit` — daily limit (e.g., 100000)
- `X-Rate-Limit-Remaining` — antal calls tilbage i dag
- `X-Rate-Limit-Reset` — Unix timestamp eller seconds til reset
- `Retry-After` — på 429

Stork gemmer disse i `integration_sync_runs.rate_limit_remaining` etc. og bruger dem i `provider quota gate` (`utils/quota-gate.ts`).

### Proactive gating

Adapter har **proactive abort** (`adapter:250-254`):
```ts
if (this._metrics.rateLimitRemaining !== undefined && this._metrics.rateLimitRemaining < 50) {
  throw new Error("RATE_LIMIT_EXHAUSTED: ... < 50");
}
```

Stopper sync når <50 calls tilbage.

### Special header

Stork sender `X-Rate-Limit-Fair-Use-Policy: Minute rated` på alle requests (`adapter:142`). Formodes at signalere til HeroBase at klienten respekterer fair-use minute-level rate limits.

### Retry på 429

`adapter:274-289`:
- Læs `Retry-After`-header (sekunder).
- Exponential backoff: `3s, 6s` med 30% jitter, capped 15s.
- Max 2 retries (færre end Adversus' 3).

### Quota-konsekvenser

I praksis observerede 1.0 at Enreach er **strikker på fair-use** end Adversus. Per `docs/adversus-rate-limit-runbook.md`:
- Meta-sync (campaigns/users) aborterer ved >50% 429-rate.
- Adversus fortsætter, Enreach stopper meta-sync action og markerer "partial_success".

### Danish working hours-gate

Begge providers (`enreach` + `adversus`) skippes uden for 08-21 dansk tid (`actions/sync-integration.ts:114`). Enreach-sync **kører IKKE om natten**.

---

## 5. Polling-flow — den eneste rigtige vej

**Webhooks er disablet** (`dialer-webhook/parsers/factory.ts:3-5`): "Enreach webhooks send empty payloads. All Enreach data is ingested via API-sync (integration-engine) every 15 min."

Dette bekræftes af `adversus_events`-tabellen som har mange `unparsed_webhook`-events fra "tryg"-integrationen med raw body `"","AgentEmail":"","AgentName":"",...` — uden åbnings-`{` (malformed). Disse fanges men aldrig parses (`docs/system-snapshot.md:246`).

### Cron-schedule

Per integration:
- ASE: `8,23,38,53 * * * *` (hver 15. min, offset 8 min)
- Tryg: separat schedule (formodet stagger som ASE)
- Alka: separat schedule

`dialer_integrations.config.sync_schedule` indeholder cron-strings. `sync_frequency_minutes` er backup default.

### Sync-flow

1. Cron-job kalder `integration-engine` med `integration_id`.
2. `getAdapter("enreach", credentials, name, api_url, config, calls_org_codes)` → `EnreachAdapter`.
3. Hvis `config.enableUserPreFetch=true` (kun Alka): pre-fetch `/users` → orgCode→email map.
4. `fetchSalesRange({from, to})`:
   - Build endpoint via `buildLeadsEndpoint`: `/leads` (ASE) eller `/simpleleads` (others).
   - Paginate `skip+take`, 500 per page, max 50 000 leads.
   - **Filtrér client-side**: kun `closure.toLowerCase() === "success"`.
   - Anvend `dataFilters` (whitelist på `lastModifiedByUser.orgCode` etc.).
   - Map til `StandardSale` via `mapLeadToSale`.
   - Filtrér `agentEmail` mod whitelist (default `@copenhagensales.dk`, `@cph-relatel.dk`, `@cph-sales.dk` — kan overrides per integration via `config.allowedAgentEmailDomains`).
5. Også `fetchSessions` (alle closure-typer, ikke kun success) → `dialer_sessions`-tabel.
6. `fetchCalls` for CDR — per org-code per dag i 2-timers chunks, deduper på uniqueId.

### Lookback-cap

`fetchSales`: max 7 dage (`adapter:441-445`). `fetchSalesRange`: ingen cap (manuel range — kan være længere).

### Resultat-mapping (Lead → StandardSale)

`mapLeadToSale` (`adapter:745-885`):

| Stork-felt | Hentes fra |
|---|---|
| `externalId` | `lead.uniqueId` |
| `saleDate` | `lead.firstProcessedTime` → konverteret CET→UTC |
| `agentEmail` | Bedst-først whitelist-match af: 1) `firstProcessedByUser.email`, 2) `lastModifiedByUser.email`, 3) orgCode→email map (Alka), 4) orgCode rå hvis indeholder `@` |
| `agentName` | `firstProcessedByUser.name` eller agentEmail |
| `customerName` | `data.Navn1 + Navn2`, eller `data.Navn`, eller `data.Company`, eller `data.Firma` |
| `customerPhone` | `data.Telefon1` eller `Telefon`, `Phone`, `Mobile`, `contact_number`, `SUBSCRIBER_ID`, `Telefon Abo1`, `phoneNumber`, `PhoneNumber`, `Mobilnummer` |
| `campaignId` | `lead.campaign.uniqueId` |
| `campaignName` | `lead.campaign.code`, fallback `data.Kampagne`, fallback `campaignId` |
| `externalReference` | (a) Per-mapping `referenceConfig.field_id`, (b) data.OPP/OrderId/etc., (c) regex-søgning efter "opp" eller "order" i alle variabler |
| `products` | Via `extractProducts` (se §6) |

---

## 6. Produkt-ekstraktion — den konfigurerbare del

Enreach har **ikke struktureret produkt-data** (modsat Adversus' `lines: [...]` array). Produkter må udledes fra `data`-felter på leadet, gennem **konfigurerbar logik per integration**:

`dialer_integrations.config.productExtraction.strategy`:
- `"standard_closure"` — brug `closureData[]` direkte. Fallback til "Venta General".
- `"data_keys_regex"` — anvend regex på `data`-keys; match-groups bliver `(name, price)`.
- `"specific_fields"` — list af keys i `data`; hver med non-empty værdi → eget produkt.
- `"conditional"` — komplekst regelbaseret system (ASE-style).

### "Conditional"-strategi (ASE)

ASE's `productExtraction.conditionalRules` (sample fra `docs/system-snapshot.md:6279-6336`):

```json
[
  {
    "conditions": [
      { "field": "A-kasse salg", "value": "Nej", "operator": "equals" },
      { "field": "Forening", "value": "Fagforening med lønsikring", "operator": "equals" }
    ],
    "conditionsLogic": "AND",
    "extractionType": "static_value",
    "staticProductName": "Lønsikring"
  },
  {
    "conditions": [
      { "field": "A-kasse salg", "value": "Ja", "operator": "equals" },
      { "field": "Lønsikring", "value": "", "operator": "isNotEmpty" }
    ],
    "conditionsLogic": "AND",
    "extractionType": "static_value",
    "staticProductName": "Lønsikring"
  },
  {
    "conditions": [{ "field": "Ja - Afdeling", "value": "Lead", "operator": "equals" }],
    "extractionType": "static_value",
    "staticProductName": "Lead"
  },
  {
    "conditions": [{ "field": "Ja - Afdeling", "value": "Salg", "operator": "equals" }],
    "extractionType": "static_value",
    "staticProductName": "Salg"
  }
]
```

Logik (`adapter:906-924`):
- Iterer over alle rules.
- For hver rule: check conditions (AND/OR logic), if passes → kald `extractFromRule`.
- **Alle matchende rules giver produkter** (ikke kun første). En lead kan generere flere Stork-produkter.

### Extraction-types (`adapter:988-1105`)

- `specific_fields` — `targetKeys: ["Abonnement1", "Abonnement2"]` eller med template `"{{Type}}"` (`{{}}-substitution`).
- `regex` — `regexPattern` mod både keys og values; match-groups → `(name, price)`.
- `static_value` — fast `staticProductName` + optional `staticProductPrice`. Quantity kan parses fra `conditionKey`-feltværdi (`adapter:1056-1064`).
- `composite` — `productNameTemplate: "{{A-kasse type}} - {{Forening}}"` substitueres med data-værdier.

### Conditions: operators (`adapter:1262-1306`)

`equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`, `regex`, `isEmpty`, `isNotEmpty`, `notExists`. Case-insensitive ved string-sammenligning.

### Data-filters (pre-produkt)

Før produkt-extraktion kan en lead filtreres væk via `productExtraction.dataFilters` (legacy) eller `dataFilterGroups` (new style med AND/OR-grupper).

ASE har én filter (`docs/system-snapshot.md:6272-6278`):
```json
[{
  "field": "lastModifiedByUser.orgCode",
  "value": "@copenhagensales.dk",
  "operator": "contains"
}]
```

Eneste leads hvor sidste-modificerende agent har `@copenhagensales.dk` i orgCode (som for ASE ER en email) får sale-records.

**"Bloomreach"-fallback** (`adapter:1199-1209`): hvis filter på `lastModifiedByUser.orgCode` fejler, prøv `firstProcessedByUser.orgCode` som fallback. Hardkodet kun for det specifikke felt-navn.

`agentEmail`-compat (`adapter:1149-1156`): hvis en filter-rule har `field: "agentEmail"`, mapper adapter automatisk til orgCode-fields.

---

## 7. orgCode-attribution — Enreach's unikke quirk

`orgCode` i HeroBase er **agentens identifier** men har FORSKELLIGE formater pr. tenant:

| Tenant | orgCode-format | Eksempel |
|---|---|---|
| ASE (cphsales2) | Email-format | `lala@copenhagensales.dk` |
| Tryg | Agent-kode | `t01asts`, `T01ABJE` |
| Alka (Tryg-tenant) | Mixed | Brugere har orgCode som agent-kode + email på user-objekt |

For ASE er attribution direkte — orgCode IS email.

For Tryg/Alka kræves opslag i `/users` for at konvertere orgCode → email:

```
orgCode "t01asts" → /users lookup → user.email "tor.sten@tryg.dk"
```

Dette er hvad `enableUserPreFetch=true` (`adapter:67-89`) gør:
1. Ved sync-start: hent `/users?Limit=2000`.
2. Byg map `orgCode → { email, name }`.
3. Cache for hele sync-runet.
4. I `mapLeadToSale` (`adapter:787-793`):
   ```ts
   if (fallbackEmail.includes("@")) return fallbackEmail;
   if (orgCode && userOrgCodeMap.has(orgCode)) return userOrgCodeMap.get(orgCode).email;
   return orgCode || "";  // last resort
   ```

Det er **kun Alka der har enableUserPreFetch=true**. Tryg og ASE har det ikke (Tryg fordi den måske ikke er fully wired endnu; ASE fordi orgCode allerede er email).

### Attribution-prioritet

`mapLeadToSale:795-806`:
1. `firstProcessedByUser` enrichet email — hvis matcher whitelist, brug den.
2. Else: `lastModifiedByUser` enrichet email — hvis matcher whitelist, brug den.
3. Else: rå firstProcessed eller lastModified orgCode.

Whitelist styres af `config.allowedAgentEmailDomains` (override) eller default `@copenhagensales.dk`, `@cph-relatel.dk`, `@cph-sales.dk`.

### `agents`-tabel og external_dialer_id

Sample fra `docs/system-snapshot.md:483-493`:
```json
{
  "name": "Andreas Lundahl",
  "source": "enreach",
  "external_dialer_id": "andl@copenhagensales.dk"   // ← email som external_id!
}
```

Det er bevidst: for Enreach lagres agent's email som `external_dialer_id` (mens Adversus bruger numerisk i `external_adversus_id`).

---

## 8. Webhooks — disabled men eksisterende

### Webhook-administration via API

`enreach-manage-webhooks/index.ts` har 6 actions:
- `list` → `GET /hooks` — list alle registrerede webhooks.
- `create` → `POST /hooks` med payload (se nedenfor).
- `delete` → `DELETE /hooks/{id}`.
- `meta` → `GET /hooks/meta` — metadata om mulige konfigurationer.
- `example` → `GET /hooks/{id}/example` — example-payload (kan returnere "Sequence contains no matching element" hvis ingen events).
- `campaigns` → `GET /campaigns` — bruges til at vælge `CampaignCode` ved create.

### Webhook payload-format (når oprettet)

`enreach-manage-webhooks:205-217` — Stork registrerer webhooks med **ContentTemplate-styret JSON**:

```json
{
  "Name": "CPH Sales Webhook",
  "Method": "POST",
  "UrlTemplate": "<dialer-webhook-URL>",
  "Format": "Json",
  "ContentTemplate": "{\"UniqueId\":\"{UniqueId}\",\"AgentEmail\":\"{AgentEmail}\",\"AgentName\":\"{UserName}\",\"CampaignCode\":\"{CampaignCode}\",\"CampaignName\":\"{CampaignName}\",\"LeadStatus\":\"{LeadStatus}\",\"CustomerPhone\":\"{PhoneNumber}\",\"CustomerName\":\"{ContactName}\",\"CustomerCompany\":\"{Company}\",\"ClosedDate\":\"{ClosedDate}\",\"Result\":\"{Result}\"}",
  "LeadStatus": "UserProcessed"
}
```

HeroBase substituerer `{UniqueId}`, `{AgentEmail}`, etc. ved levering.

### Hvorfor de er disablet

`dialer-webhook/parsers/factory.ts:3-5`:
> "EnreachWebhookParser disabled – Enreach webhooks send empty payloads. All Enreach data is ingested via API-sync (integration-engine) every 15 min."

I praksis: webhook-tracker-rækker i `adversus_events`-tabel viser at tryg-integrationen leverer payloads som `"","AgentEmail":"","AgentName":""...` — alle fields tomme. Parseren CAN handle dem (se `EnreachWebhookParser.parseLegacyKeyValueBody` i `parsers/enreach.ts:218-230`) — men den bliver ikke kaldt da factory har den disablet.

**`EnreachWebhookParser`-klassen (275 linjer) er fuldt død** i den nuværende registry, men koden er bevaret. Den kan parse to formater hvis re-enabled:
1. JSON HeroBase SimpleLead webhook (felter som `uniqueId, campaignId, lastModifiedUser, closure`).
2. Legacy "almost JSON" key/value string (med tomme værdier-mønstre).

Header `X-Benemen-Event` bruges til auto-detection (`parsers/enreach.ts:67-71`).

---

## 9. ASE-specielle behandlinger

ASE-integrationen har FLERE special-cases:

1. **Bruger `/leads` endpoint** med `SearchName=cphsales2` i stedet for `/simpleleads` (`adapter:166-184`). Kun for ASE.
2. **Data-key normalisering**: `/leads` returnerer lowercase keys (`a-kasse salg`, `dækningssum`) — adapter normaliserer (`adapter:1830-1868`).
3. **Conditional product-extraction** med 4 regler (se §6).
4. **OrgCode IS email** — ingen pre-fetch nødvendig.
5. **Hardkodede danske data-keys**: 17 specifikke field-keys håndteres i `KNOWN_KEY_MAP`.

`usesLeadsEndpoint`-getter (`adapter:166-168`):
```ts
return this.dialerName.toLowerCase() === "ase";
```

Det er hardkodet på navnet "ase" — ikke en config-flag. Ændring af integration-name til andet (e.g., "ASE A-kasse") ville bryde branchen.

---

## 10. Calls-fetching — det dyre lag

`fetchCallsRange` (`adapter:1458-1581`) er mere kompleks end andre endpoints:

1. **OrgCode resolution**:
   - Hvis `callsOrgCodes` array fra `dialer_integrations.calls_org_codes`: brug dem alle.
   - Else: kald `/myaccount` for at hente real OrgCode.
   - Hvis stadig kun en email-formet orgCode: **fallback til hardcoded `"Salg"`** (`adapter:1481-1483, 1487-1489`).

2. **Per-day chunking**: hver dag deles op i 12 × 2-timers chunks.

3. **Per-orgCode-loop**: for hver konfigureret orgCode, hent alle chunks. Dedupliker på `uniqueId` på tværs af orgCodes.

For ASE-integrationen er `calls_org_codes: ["CPH-Sales - Outbound"]` (`docs/system-snapshot.md:6342-6344`).

Resultat: én 7-dages sync med flere orgCodes kan generere 7 × 12 × N orgCodes = 84+ API-calls. Adapter har 100ms delay mellem chunks.

---

## 11. Datatabeller — Enreach-domæne

Samme tabeller som Adversus + nogle Enreach-specifikke:

| Tabel | Rows | Formål |
|---|---|---|
| `dialer_integrations` | 7 | 3 Enreach + 4 Adversus |
| `dialer_calls` | 312 288 | CDR fra Enreach + Adversus |
| `dialer_sessions` | 207 015 | Sessions fra leads (alle closures) |
| `adversus_events` | 9 636 | INKLUDERER unparsed Enreach webhooks (tabel-navn er historisk arv) |
| `adversus_campaign_mappings` | 126 | INKLUDERER Enreach-kampagner — CAMP-prefix-format matcher Enreach naturligt |
| `agents` | 223 | `source='enreach'` + `external_dialer_id`=email |
| `data_field_definitions` | (small) | PII-classification af `data`-felter |
| `integration_field_mappings` | (medium) | Felt-mapping config (per integration) |
| `integration_debug_log` | 7 | Latest sync raw data — sample-data viser Enreach-format |
| `integration_sync_runs` | 95 410 | Audit log pr. sync incl. rate_limit_remaining etc. |
| `integration_circuit_breaker` | 7 | Pause-state |

`adversus_campaign_mappings` til trods for navnet **er den centrale kampagne-mapping for ALLE dialers, inkl. Enreach**. CAMP-prefix-format i `adversus_campaign_id` er Enreach's naturlige format — det forklarer hvorfor de fleste samples i den kolonne ser sådan ud (se Adversus-rapport).

---

## 12. Idiosynkrasier og edge cases — observeret i drift

Observationer der har drevet workarounds.

1. **PascalCase + camelCase**: Same fields findes i begge formater. Adapter prøver begge.

2. **Inkonsistent response wrapper**: `Results`, `results`, `Leads`, `leads`, `Data`, `data` — adapter prøver alle.

3. **Datetime uden timezone**: `2026-05-06T10:16:41.0000000` — dansk lokaltid antaget. Konvertering via `enreachToUTC` med Intl-API for DST-håndtering. **Fallback offset er hardkodet til 1 time** (`enreach-timezone.ts:34`) — forkert om sommeren (når DK er UTC+2).

4. **`.0000000` 7-decimal-sekunder**: .NET DateTime-format. JavaScript `new Date()` accepterer det men ignorerer ekstra precision.

5. **`ModifiedTo` er exclusive**: Stork tilføjer +1 dag for at simulere inclusive.

6. **`/simpleleads` returnerer `data` selv uden `Include`** — men `/leads` kræver `Include=data,...` for at få det.

7. **Pagination kan være "stuck"**: nogle endpoint-varianter ignorerer `skip`/`take` — adapter detekterer ved samme `firstId` to gange (`adapter:340-346`).

8. **`closure` har mange værdier**: `"Success"`, `"NotInterested"`, `"InvalidLead"`, `"Callback"`, `"NoAnswer"`, `"Busy"`, mfl. — case-insensitive sammenligning.

9. **`lastModifiedByUser.orgCode` er IKKE altid email**: For Tryg er det `t01asts`, for ASE er det `lala@copenhagensales.dk`. Per-tenant behavior.

10. **orgCode → email mapping kræver /users-call**: Kun Alka har det enablet pt. `userOrgCodeMap` cachet pr. sync-run.

11. **`uploadedByUser` reflekterer ikke sælger**: `API_ALKA_AC@tryg.dk` er upload-API'en — ikke en agent.

12. **Sample-data viser `Tryg Forsikring A/S` som ownerOrgUnit**: Alle leads på Tryg-tenant ejes af denne org-unit — det er ikke per-team eller per-agent.

13. **Whitelist filter kan ekskludere ALLE leads**: probe har specifik recommendation når 100% af leads filtreres væk: "🚨 ALLE ... leads ville blive filtreret væk. Whitelist SKAL udvides".

14. **`Bloomreach`-fallback**: hardkodet bare for `lastModifiedByUser.orgCode`-feltet. Andre felter får ingen fallback.

15. **OrgCode auto-detection for /calls** (`adapter:1471-1494`): Hvis `orgCode` indeholder `@` (email-format) → fallback hardkodet til `"Salg"`. Eneste sted hvor `"Salg"` antages.

16. **Tomme webhook-payloads**: Enreach leverer "" eller `"","AgentEmail":""...` — derfor disablet i factory.

17. **`api_url`-sanitization**: Adapter strip user-pasted prefixes som `"Web: "`, `"URL: "`, `"API: "`, `"Endpoint: "` (`adapter:99`). Indikator for at admin-UI-input ikke er konsistent.

18. **`fetchCampaigns` returnerer `[]`** for Enreach (`adapter:1689-1691`). Den faktiske kampagne-data hentes ad hoc fra leads. Kampagne-info er ikke separat synced som for Adversus.

19. **Per-orgCode call-fetching dedupes på uniqueId**: samme opkald kan vises i flere orgCodes — adapter ignorerer duplikater. Stats logges per orgCode.

20. **ISO-8601 duration parsing**: `PT12M42S` parses manuelt med regex (`adapter:1616-1629`) — ingen lib.

21. **`fetchUsers` på `/simpleleads`-tenants ekstrakterer fra leads** (`adapter:1331-1422`): KUN orgCodes med `@` registreres. Tryg-style agent-koder springes over. Kun aktive senest 7 dage.

22. **`fetchProducts` er ikke implementeret**: `DialerAdapter.fetchProducts` er optional og Enreach-adapter har den ikke. Produkt-skema bygges ad hoc fra `data`-felter.

23. **HeroBase rate-limit kan returnere `X-Rate-Limit-Reset` som Unix-timestamp ELLER som seconds-til-reset**: Adapter behandler som int men formatet er uklart (`adapter:271`).

24. **`/myaccount/request/counts`-endpoint** giver minute-level usage — bruges af `fetchRateLimits` til real-time check (kaldes via integration-engine action `check-rate-limits`).

25. **PHONE_SEARCH "51806520" hardkodet** i `adapter:493, 644`: special debug-løsning for at lokalisere et specifikt telefonnummer i leads — formodet midlertidig diagnostik.

26. **Sale-id-format = lead-id-format = session-id-format** for Enreach: `<digits>S<digits>` (e.g., `82549084S3064`). En sale, session, og det underliggende lead har ALLE samme externalId. For Adversus er sale-id, lead-id og session-id forskellige.

---

## 13. Død og skygge-kode

1. **`EnreachWebhookParser`** (275 linjer) — fuld parser-klasse for både JSON og legacy key/value format. Disablet i factory siden Enreach kun sender tomme payloads. Bevaret som live-able kode.

2. **`/sales`, `/orders`, `/results`, `/flow`, `/flows`-endpoints**: Testet i diagnostics, alle returnerer 404 eller intet brugbart. Ingen real-brug.

3. **`fetchCampaigns` returnerer `[]`** for Enreach. Det er bevidst no-op; campaigns-action skippes for Enreach-integrationer.

4. **`alka-*`-edge functions** har "alka" i navnet men kalder generisk HeroBase-API. De er Enreach-funktioner, ikke en separat platform.

5. **Hardkodet PHONE_SEARCH-konstant**: `"51806520"` (`adapter:493, 644`). Single-customer diagnostik-feature; bør være en config-flag eller fjernet.

6. **`enreach-diagnostics`-eksperimentelle endpoints**: TEST 3 prøver 14 forskellige `/leads`-parameter-kombinationer. Alle fail/succeed-results logges. Diagnostik-tool, ikke produktion.

7. **`probe-enreach-integration`** (804 linjer): tilsvarende stort diagnostik-tool specifikt for Alka-integration (hardkodet ALKA_INTEGRATION_ID). Bruges sjældent — manuel debug.

8. **`alka-reference-lookup`** (384 linjer): manuelt sample/dump-tool — kun for at undersøge nye eller ukendte kampagner.

9. **`legacy single conditionKey/conditionValue`** i `ConditionalExtractionRule` (`adapter:1316-1322`): backwards-compatible support. Sample-data i `dialer_integrations` viser kun nye `conditions[]`-format brugt.

10. **`dataFilters` (legacy) vs `dataFilterGroups` (new)**: To måder at konfigurere filtre. Begge eksisterer parallelt. ASE bruger kun den legacy.

11. **`validationKey`-felt** på `productExtraction` (`types.ts:54`): "DEPRECATED: Use conditional rules instead". Stadig understøttet i adapter (`adapter:897-904`).

---

## 14. Sammenfatning af den rå Enreach API

**Hvad Enreach (HeroBase) tilbyder:**

- REST API på `https://wshero01.herobase.com/api`.
- **Basic Auth** (username + password) — Bearer-token understøttet men ikke brugt i prod.
- **JSON responses** med inkonsistent wrapper-shape (Results / Leads / data / array).
- **Mixed casing** — same field i PascalCase OG camelCase.
- **Query-baseret filtering**: `Projects`, `Campaigns`, `ModifiedFrom`, `ModifiedTo` (exclusive!), `Statuses`, `LeadClosures`, `AllClosedStatuses`, `Include`.
- **Pagination**: `skip` + `take` (zero-indexed skip).
- **Rate limits**: `X-Rate-Limit-Limit/Remaining/Reset` headers + 429 + `Retry-After`. Strikker fair-use-policy end Adversus.
- **Webhooks**: registrérbar via `/hooks` med ContentTemplate — men leveres ofte tomme i prod.

**Kerne-resource-typer:**
- **Leads** (`/leads`, `/leads/{id}`): kontakt-record med custom `data`-objekt pr. tenant.
- **SimpleLeads** (`/simpleleads`): lette leads — primær sync-vej for de fleste integrationer.
- **Users** (`/users`): agents — kun rigtig brugbar med orgCode-mapping.
- **Campaigns** (`/campaigns`): kampagne-info.
- **Projects** (`/projects`): wrapper for samlinger af kampagner.
- **Calls** (`/calls`): CDR med ISO-8601 durations + per-OrgCode + per-chunk.
- **Webhooks** (`/hooks`): admin endpoint.

**Domæne-koncepter unikke for Enreach:**
- **`closure`** (vs Adversus' `state`): hvordan leadet sluttede.
- **`orgCode`**: agent-identifier, format varierer pr. tenant.
- **`uniqueId` med S-prefix**: samme id på tværs af lead/session/sale.
- **Custom `data`-objekt**: ingen struktureret produkt-data — produkter udledes via konfigurerbare extraktionsregler.
- **OrgUnit/Project/Campaign hierarki**: 3 organiske niveauer over kampagner.

**Idiosynkrasier som 1.0 har lært at håndtere:**
- Tom webhook-payload → polling-only.
- Per-tenant orgCode-format (email vs agent-kode).
- Lowercase `data`-keys fra `/leads` (ASE-specifik).
- Manglende email på user-objekter (Alka-specifik).
- Sub-second precision i ISO timestamps.
- Exclusive `ModifiedTo`.
- Whitelist-filtreringer der kan slå ALLE leads ud.
- Ingen central kampagne-fetcher — kampagner udledes fra leads.
- Manglende produkt-skema → konfigurerbar extraktion via regler.

---

## 15. Hvad jeg ikke har verificeret empirisk

- **Eksakte rate limits i prod**: kode antager <50 calls = stop. Faktiske daily limits ikke verificeret.
- **Hvorvidt Tryg-integrationen leverer success-leads**: alle samples i debug-log er `closure="NotInterested"`. Tryg's webhook leverer kun tomme payloads. Mulig konsekvens: TRYG-sales kommer ikke ind i Stork korrekt? (Spørgsmål til Mathias.)
- **Om `/sales`-endpoint på HeroBase eksisterer for nogle tenants**: testet i diagnostics som 404 — men måske kun for de specifikke tenants vi har credentials til.
- **Faktisk antal Enreach-integrationer**: Mindst 3 (ase, tryg, alka). Måske flere som ikke er aktive.
- **Brugen af `/projects`-endpoint i prod sync**: `fetchAccessibleProjects` defineret men aldrig kaldt af integration-engine's standard-flow.
- **Faktisk webhook-deployment-status**: Stork har edge functions til at managere webhooks men parser er disablet. Er der live webhook-rækker i HeroBase der peger på Stork? Hvad sker med events der ankommer? (formodet: gemmes som `unparsed_webhook` i `adversus_events`.)
- **Adversus-rapportens fokus på Tryg's "broken Enreach-format"** — det viser sig at være Tryg-Enreach (ikke Tryg-Adversus). Stork har ikke aktiv Tryg-Adversus-integration. Webhook-trafikken til Tryg er Enreach.
