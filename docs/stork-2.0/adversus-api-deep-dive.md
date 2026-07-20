# Adversus API i Stork 1.0 — deep dive

Forarbejde til Lag E (Stork 2.0). Faktarapport, ingen anbefalinger.

Scope:
- Den rå Adversus API (endpoints, formater, idiosynkrasier) som 1.0 møder den.
- 1.0's wrapper er kun observation — hvilke felter og edge cases driften har afsløret.
- IKKE: detaljeret pricing-/lønberegning (separate rapporter findes).

Empirisk grundlag:
- Kode i `/home/user/sales-commission-hub` (state pr. 2026-05-13).
- DB-state læst fra `docs/system-snapshot.md`.
- Live Supabase MCP forbundet til Stork 2.0 — ingen direkte queries mod 1.0-prod.

---

## 1. Hvad Adversus er, ud fra 1.0's perspektiv

Adversus er en dialer-platform (telemarketing) med base-URL `https://api.adversus.io`. Auth er HTTP Basic med username/password — ikke OAuth, ikke API-keys. Stork har FIRE forskellige Adversus-konti aktive samtidig (én pr. Stork-"integration"). Hver er en separat tenant i Adversus.

Active Adversus-integrationer (`dialer_integrations.provider = 'adversus'`):
- `Lovablecph` — TDC Erhverv / Eesy TM
- `Relatel_CPHSALES` — Relatel
- `tryg` — Tryg
- `eesy` — Eesy
- (`ase`-integration findes også men er `provider='enreach'`, ikke Adversus)

Sample fra `dialer_integrations` (`docs/system-snapshot.md:6236-6256`):
```
name: "Relatel_CPHSALES", provider: "adversus", api_url: null,
sync_frequency_minutes: 15, sync_schedule: "0,15,30,45 * * * *",
meta_sync_schedule: "10,40 * * * *",
productExtraction: { strategy: "standard_closure" }
```

Bemærk:
- `api_url` er ALTID null for Adversus — base-URL er hardkodet til `https://api.adversus.io` i adapter-koden. Enreach derimod har `api_url` udfyldt (`https://wshero01.herobase.com/api`).
- Credentials lagres krypteret i `dialer_integrations.encrypted_credentials` (pgp_sym_encrypt) og dekrypteres via `get_dialer_credentials(p_integration_id, p_encryption_key)` SECURITY DEFINER RPC. Dekrypteret format: `{ username, password }` JSON.

---

## 2. API-endpoints — hvad 1.0 faktisk kalder

### Auth header

`Authorization: Basic <base64(username:password)>` på alle requests.

### Endpoints brugt af 1.0 mod Adversus

| Endpoint | Metode | Brugt af | Returnerer |
|---|---|---|---|
| `/v1/sales` | GET | integration-engine, sync-adversus | Liste af sales |
| `/v1/sales?pageSize=N&page=N&filters=<JSON>` | GET | integration-engine, sync-adversus, adversus-diagnostics | Paginated sales med filter |
| `/sales?pageSize=N&page=N&filters=<JSON>` | GET | adapters/adversus.ts `fetchSalesSequential` | Samme — uden /v1 prefix |
| `/v1/leads?filters=<JSON>&pageSize=N` | GET | adversus-diagnostics | Leads i kampagne |
| `/leads?filters=<JSON>&pageSize=N` | GET | adapters/adversus.ts `fetchLeadsForCampaign` | Samme — uden /v1 prefix |
| `/v1/leads/{id}` | GET | enrichment-healer, tdc-opp-backfill, adversus-lead-check, adapters/adversus.ts `fetchLeadById` | Single lead detail |
| `/v1/users` | GET | integration-engine, sync-adversus | Liste af users (agents) |
| `/v1/campaigns` | GET | integration-engine, sync-adversus | Liste af kampagner |
| `/cdr?filters=<JSON>&pageSize=N&page=N` | GET | adapters/adversus.ts `fetchCallsRange` | Call detail records |
| `/v1/sessions?filters=<JSON>&page=N&pageSize=N&sortProperty=startTime&sortDirection=DESC` | GET | adapters/adversus.ts `fetchSessionsRange` | Sessions (kampagne-opslag) |
| `/webhooks` | GET, POST, DELETE, PUT | adversus-manage-webhooks, adversus-create-webhook | Webhook-administration |
| `/webhooks/{id}` | DELETE, PUT | adversus-manage-webhooks | Webhook update/delete |

**`/v1`-prefiks-inkonsistens**: I `integration-engine/adapters/adversus.ts` har klassen `baseUrl = "https://api.adversus.io"` (uden /v1). `this.get()` prepender `/v1` (linje 131), men direkte `fetch()`-kald gør ikke:
- `fetchSalesRaw` (linje 203): `${baseUrl}/sales?...` — NO /v1
- `fetchSalesSequential` (linje 754): `${baseUrl}/sales?...` — NO /v1
- `fetchLeadsForCampaign` (linje 828): `${baseUrl}/leads?...` — NO /v1
- `fetchCallsRange` /cdr (linje 922): `${baseUrl}/cdr?...` — NO /v1
- `fetchSessionsRange` (via `this.get`): `/v1/sessions` — WITH /v1
- `fetchLeadById` (linje 689): `${baseUrl}/v1/leads/${leadId}` — HARDKODET /v1

`/webhooks` endpoint bruges uden /v1 prefix overhovedet (`adversus-manage-webhooks/index.ts:76,106,150`). Adversus er tilsyneladende tolerant overfor begge formater.

### Filter-format

Adversus accepterer JSON-encoded filter-objekter i `filters` query param:

```
?filters=<URL-encoded JSON>
```

Operatorer brugt:
- `$gt`, `$lt` — for `lastModifiedTime`, `created`, `insertedTime`, `startTime`
- `$eq` — for `campaignId`

Eksempler fra koden:
- `{"lastModifiedTime": {"$gt": "2026-04-01T00:00:00Z"}}` — sales modificeret efter dato
- `{"lastModifiedTime": {"$gt": from, "$lt": to}}` — sales i vindue
- `{"campaignId": {"$eq": 19629}}` — leads for specifik kampagne (numerisk)
- `{"insertedTime": {"$gt": startIso, "$lt": endIso}}` — CDR i vindue
- `{"startTime": {"$gt": startIso, "$lt": endIso}}` — sessions i vindue
- `{"created": {"$gt": startDate.toISOString()}}` — sync-adversus bruger `created` i stedet for `lastModifiedTime`

### Paginering

`pageSize=1000` er max (`adapter:749`). Standard: 1000 for sales, 5000 for leads, 100 for diagnostics.

Pagination styres med `page=N` parameter. **Adversus CDR-endpoint starter ved `page=0`** (`adapter:930`), alle andre starter ved `page=1`. Ingen central side-tæller — koden stopper når en page returnerer færre rows end pageSize.

Sortering: kun `/sessions` har dokumenteret sort-support (`sortProperty=startTime&sortDirection=DESC`). Andre endpoints sorteres af 1.0 selv efter modtagelse.

---

## 3. Response-formatet — hvad Adversus leverer

Adversus indpakker arrays i et top-level objekt med pluralis-nøgle. 1.0's adapter fortolker pragmatisk:

```ts
const sales = data.sales || data || [];       // /sales
const users = data.users || data || [];        // /users
const campaigns = data.campaigns || data || []; // /campaigns
const records = data.calls || data.cdr || data.cdrs || data.activities || data.data || []; // /cdr (varierer!)
const sessions = data.sessions || data || []; // /sessions
const leads = data.leads || data || [];        // /leads
```

`/cdr`-endpoint har historisk returneret forskellige nøgler — `calls`, `cdr`, `cdrs`, `activities`, eller `data` — så koden prøver dem alle (`adapter:973-976`).

For `/leads/{id}` (single lead) returnerer Adversus stadig `{ leads: [...] }` med ét element i et array (`adapter:721-723`):
```ts
if (data?.leads && Array.isArray(data.leads)) {
  return data.leads[0] || null;
}
```

### Sale-objekt (fra `/sales`)

Felter Stork læser fra hver sale-record (`adapter:278-381, 460-547`):

```
{
  id:              number    // primær sale-id; bruges som externalId
  leadId:          number    // FK til /leads/{id}
  campaignId:      number    // FK til kampagne (numerisk)
  state:           string    // 'success', 'cancelled', m.fl.
  closedTime:      ISO-8601  // foretrukket sale_datetime
  createdTime:     ISO-8601  // fallback
  ownedBy:         object|number  // { id, email?, name?, displayName?, username? }
  createdBy:       object|number  // alternativ til ownedBy
  lines: [                   // produkt-linjer
    {
      id:           number,  // lineId
      productId:    number,
      title:        string,
      quantity:     number,
      unitPrice:    number,
      // andre felter fra raw_data sample: data, note, unit, totalPrice,
      // description, totalDiscount, totalNetPrice, totalProvision
    }
  ],
  lead: {                    // delvist embedded lead — fuld via /leads/{id}
    id:       number,
    company:  string,
    phone:    string,
    name:     string,
    agentEmail|sellerEmail|salesRepEmail: string,  // sjælden, fra agent_email-fallback
  },
  campaign?: { name: string }  // ikke altid embedded
}
```

Sample af én linje (`docs/system-snapshot.md:349281-349295`):
```
data: [],
note: null,
unit: "1",
title: "Partnersalg Finansforbundet - TRYG",
lineId: 1742503,
quantity: 1,
productId: 5222,
unitPrice: 0,
totalPrice: 0,
description: null,
totalDiscount: 0,
totalNetPrice: 0,
totalProvision: null
```

Bemærk Adversus rapporterer sin egen pris i `unitPrice`/`totalPrice`/`totalNetPrice` og sin egen provision i `totalProvision` — **men Stork ignorerer dem**. Stork bruger egne pricing-regler i `product_pricing_rules` og overskriver `mapped_commission`/`mapped_revenue` på `sale_items`.

### Lead-objekt (fra `/leads/{id}` eller embedded i sale)

```
{
  id:           number,
  campaignId:   number,
  status:       string,
  result|outcome|closingCode: string,
  resultData: [
    {
      id:       number,    // field-id (Adversus internal)
      label?:   string,    // human-readable name (varierer — sometimes 'name')
      name?:    string,    // alternative label
      type?:    string,
      value:    any        // typically string, can be empty
    }
  ],
  phone|mobile|contactPhone: string,
  contactData: {
    phone, mobile, phoneNumbers,
    Telefonnummer1?, "Kontakt nummer"?, Mobil?, Telefon?  // danske aliaser
  },
  phoneNumbers: string[],
  createdAt: ISO-8601,
  updatedAt: ISO-8601,
}
```

`resultData` er Adversus' "custom fields" — kunde-konfigurerede felter pr. kampagne. Felter har numerisk `id` plus et label. **Labels er på dansk i 1.0's konti** og bruges som pricing-condition-keys.

### Danske resultData-labels observeret i koden

| Label | Brugt af | Formål |
|---|---|---|
| `OPP nr` / `OPP-nr` | tdc-opp-backfill, sales-rapporter | Eksternt referencenummer (TDC) |
| `Kontakt nummer` | SalesFeed `getEffectivePhone` | Fallback-telefon |
| `Telefonnummer1` | contactData (enrichment-healer) | Telefon-alias |
| `Live Nummer` | webhook form-data (Live-call indikator) | Live-call telefon |
| `Fastgjorte noter` | SalesFeed | Noter til salget |
| `Sales ID` | SalesFeed | Eksternt sales-id |
| `Tilskud` | SalesFeed (Relatel) | Tilskudsbeløb — pricing-condition |
| `Bindingsperiode` / `Binding` | SalesFeed | Binding — pricing-condition |
| `Resultat Af Samtalen` / `Resultat af samtalen` | webhook parser | Human-readable result |
| `Dækningssum` | pricing-engine (ASE) | Lønsikring forsikrings-sum |
| `Forening` | pricing-engine (ASE) | A-kasse forening |
| `Lønsikring` | pricing-engine (ASE) | Lønsikring-flag |
| `A-kasse salg` | pricing-engine (ASE) | A-kasse salg-flag |
| `A-kasse type` | pricing-engine (ASE) | A-kasse type |
| `Eksisterende medlem` | pricing-engine (ASE) | Medlems-flag |
| `Medlemsnummer` | pricing-engine (ASE) | A-kasse medlems-nr |
| `Nuværende a-kasse` | pricing-engine (ASE) | Nuværende a-kasse |
| `Ja - Afdeling` | pricing-engine (ASE) | "Lead" eller "Salg" — bestemmer produkt-routing |
| `Leadudfald` | pricing-engine (ASE) | Lead-resultat |
| `Navn1`, `Navn2` | ASE | Kunde-navne |
| `Telefon1` | ASE | Kunde-telefon |
| `NAVN FF Forsikring` | webhook form-data | Customer-name-alias |

Adversus opretter sit eget feltskema pr. kampagne. **1.0 har ingen central definition** af hvilke felter der findes pr. integration — labels hardkodes i koden hvor de bruges.

**Case-sensitivity:** Labels indkommer normalt med korrekt casing fra Adversus webhook, men `/leads/{id}` endpoint returnerer SOMME-tider lowercase keys. `rematch-pricing-rules/index.ts:29-47` har et `ASE_KEY_MAP` med 17 mappings (lowercase → korrekt casing) for at håndtere dette — gælder kun ASE.

### resultFields format

Stork bygger ofte en `leadResultFields: Record<string, value>` parallelt med `leadResultData`-arrayet:
```ts
for (const field of resultData) {
  const fieldName = field?.name || field?.label;
  if (fieldName) resultFields[fieldName] = field.value;
}
```

Begge formater gemmes i `sales.raw_payload.leadResultData` (array) og `sales.raw_payload.leadResultFields` (object). UI'er læser fra begge:
```ts
function getLeadField(payload, label) {
  // Først array-format
  const field = payload?.leadResultData?.find(f => f.label === label);
  if (field?.value) return field.value;
  // Så object-format
  const val = payload?.leadResultFields?.[label];
  return val != null ? String(val) : null;
}
```

### User-objekt (fra `/users`)

```
{
  id:            number,
  name:          string,
  displayName:   string,
  email:         string,
  active:        boolean,
  username:      string,   // sometimes contains @-email
  role?:         string,
  accessLevel?:  string,
  isAgent?:      boolean,
  isManager?:    boolean,
}
```

Stork har observeret at `email`-feltet ofte er tomt for nogle Adversus-konti. Adapter har 4-trins email-resolution (`adapter:282-309`):

1. `agentObj.email || agentObj.mail || agentObj.emailAddress`
2. `agentObj.username` hvis den indeholder `@`
3. Lookup i userMap via agent-ID
4. `sale.lead.agentEmail || sellerEmail || salesRepEmail`

Hvis intet match → **salget droppes** (linje 313-315, `return null`). 1.0 har en whitelist:
```
@copenhagensales.dk, @cph-relatel.dk, @cph-sales.dk
+ explicit: kongtelling@gmail.com, rasmusventura700@gmail.com
+ exclusion: agent-{digits}@adversus.local pseudo-emails (regex)
```

### Campaign-objekt (fra `/campaigns`)

```
{
  id:           number,    // numerisk ID, varierer fra webhook campaign.id (se §6)
  name:         string,
  settings?: {
    name:       string,
    active:     boolean,
  },
  resultFields?: [
    { id, type, name?, active, options? }
  ],
  active?: boolean,
}
```

Adapter mapper `c.settings?.name || c.name` (`adapter:186`) — Adversus har TO steder hvor kampagne-navnet kan ligge. `c.settings.name` er den nyere.

### CDR / Call-objekt (fra `/cdr`)

```
{
  id:                  number|string,
  uniqueId|uuid:       string,    // alternativer
  insertedTime|startTime|started|created: ISO-8601,
  endTime|ended:       ISO-8601,
  conversationSeconds|billsec|talkTime: number,    // tale-tid
  durationSeconds|duration|totalDuration: number,  // total med ringetid
  disposition|hangupCause|hangup_cause: string,
  userId|agentId|ownedBy.id: number,
  campaignId:          number,
  contactId|leadId:    number,
  source:              string|null,    // null = inbound
  type:                string,
  recordingUrl|recording|links.recording: string,
  answerTime:          ISO-8601,
}
```

Disposition-værdier set i `adapter:1135-1161`: `answered`, `success`, `connected`, `sale`, `answer`, `no answer`, `noanswer`, `no_answer`, `ring`, `busy`, `voicemail`, `machine`, `answering`, `fail`, `error`, `invalid`. Stork mapper til 5 statusværdier: `ANSWERED, NO_ANSWER, BUSY, FAILED, OTHER`.

Hangup-cause (`adapter:1166-1188`): `NORMAL_CLEARING`, `NO_USER_RESPONSE`, `TIMEOUT`, `USER_BUSY`, `CALL_REJECTED`, `UNALLOCATED`, `INVALID`.

### Session-objekt (fra `/sessions`)

```
{
  id|uniqueId:         number|string,
  leadId:              number,
  userId:              number,
  campaignId:          number,
  startTime|created:   ISO-8601,
  endTime:             ISO-8601,
  status:              string,    // see below
  sessionSeconds|durationSeconds: number,
  type:                string,    // call-type
  hangupCause:         string,
  cdr?: {                         // nested CDR object
    durationSeconds, disposition, ...
  },
  conversationSeconds: number,
  disposition:         string,
}
```

Session status-værdier observeret: `success, notInterested, unqualified, invalid, automaticRedial, privateRedial, noAnswer, busy, unknown`.

Stork gemmer sessions i `dialer_sessions` (207 015 rækker — populeret hver sync).

---

## 4. Webhook-formatet — hvad Adversus sender PUSH

Adversus understøtter både JSON og multipart/form-data webhook-deliveries. 1.0 har handlere for begge.

### Endpoint #1 (legacy): `adversus-webhook`

Hardkodet stand-alone endpoint `https://<supabase>/functions/v1/adversus-webhook`. Forventer JSON-only payload. Registreret én gang i seed-migration `20251206193050:31`. Brugt af gamle webhooks i Adversus.

### Endpoint #2 (current): `dialer-webhook?dialer_id=<uuid>`

Parameteriseret endpoint. `adversus-create-webhook/index.ts:72` opretter nye webhooks der peger her. Bruger `dialer_id` til at slå provider op og vælger parser via `dialer-webhook/parsers/factory.ts`. Understøtter JSON OG multipart/form-data.

### JSON payload-format (TypeScript-defineret)

`dialer-webhook/parsers/adversus.ts:11-33`:
```
{
  type:        string,        // 'leadClosedSuccess', 'notInterested', etc.
  event_time?: string,
  payload: {
    result_id?: number,       // unique sale identifier
    campaign?: {
      id:   string,           // BEMÆRK: string i webhook, number i polling-API
      name: string,
    },
    user?: {
      id:    string,
      name:  string,
      email: string,
    },
    lead?: {
      id:      number,
      phone:   string,
      company: string,
    },
    products?: [
      {
        id:         number,
        externalId?: string,
        title:      string,
        quantity:   number,
        unitPrice:  number,
      }
    ],
    resultData?: Record<string, unknown>,   // KEY-VALUE OBJEKT i webhook (ikke array som polling!)
  }
}
```

### Form-data payload (legacy Adversus webhooks)

`dialer-webhook/parsers/adversus.ts:65-138`. Felt-navne (alle stringy, alle valgfri):

- **IDs**: `leadid` / `lead_id`, `userid` / `user_id` / `agentid`, `campaign_id` / `campaignid` / `campaign`, `ordre_id` / `orderId`
- **Agent**: `username` / `user_name` / `agentname`, `useremail` / `user_email` / `agentemail`
- **Campaign**: `campaign_name` / `campaignname`
- **Customer**: `company`, `CVR`, `Efternavn`, `NAVN FF Forsikring`, `customer_name`, `navn`
- **Phone**: `Live Nummer`, `Kontakt nummer`, `Telefonnummer1`, `phone`, `telefon`
- **Status/Result**: `status` (outcome enum), `Resultat Af Samtalen` / `Result` / `result` (free text)
- **OPP**: `OPP nr`

Webhook auto-detection (`dialer-webhook/parsers/adversus.ts:37-55`):
- Multipart: indeholder `leadid` eller `status` i body
- JSON: har `type` og `payload` top-level

### Event-type / campaign_status enum-mapping

`dialer-webhook/parsers/adversus.ts:144-167` mapper free-text Adversus-status-værdier til en kanonisk enum. Adversus-værdier observeret:

- `success` / `leadClosedSuccess` / `closedSuccess` → `success`
- `notInterested` / `not_interested` → `notInterested`
- `invalid` → `invalid`
- `unqualified` → `unqualified`
- `callback` / `redial` → `callback`
- `noAnswer` / `no_answer` → `noAnswer`
- `busy` → `busy`
- `voicemail` → `voicemail`
- `automaticRedial` / `automatic_redial` → `automaticRedial`
- `privateRedial` / `private_redial` → `privateRedial`
- `new`, `pending`, `completed` → samme værdier

Hvis intet match: returneres status-værdien uændret (graceful fallback).

### Webhook-administration

`/webhooks` endpoint på Adversus tager `{ url, event, template? }` for POST og PUT. `event` matcher status-enum-værdierne. `template` (optional) kan definere hvilke felter Adversus skal inkludere i payloaden.

Operationer fra 1.0:
- `adversus-create-webhook` — POST /webhooks med URL der peger på `dialer-webhook?dialer_id=<uuid>`.
- `adversus-manage-webhooks` — list, update, delete via `/webhooks` og `/webhooks/{id}`.

---

## 5. Adversus' to identifier-formater for kampagner

Dette er Adversus' mest forvirrende quirk:

### Polling /sales API returnerer numerisk campaignId

```ts
const sale = { id: 12345, campaignId: 19629, ... };
// String(s.campaignId) → "19629"
```

### Webhook payload har string campaign.id

```ts
const webhookPayload = {
  payload: { campaign: { id: "CAMP19629S3064", name: "..." } }
};
```

Sample i `adversus_campaign_mappings` (`docs/system-snapshot.md:165-180`):
- `adversus_campaign_id: "CAMP19629S3064"`, name: "MB CPH sales Forsikringstjek"
- `adversus_campaign_id: "CAMP18153S3012"`, name: "Salg - CS - Ø"

Begge formater er ses i samme kolonne `adversus_campaign_id`. Hvilken format der ender i basen afhænger af om webhook eller polling skrev rækken først.

Konsekvens: `adversus_campaign_mappings.adversus_campaign_id_key` UNIQUE constraint kan have TO rækker for samme Adversus-kampagne (én "19629", én "CAMP19629S3064") — afhængigt af registreringssekvens.

`fetchLeadsForCampaign` i adapter:
```ts
const filters = JSON.stringify({ campaignId: { "$eq": Number(campaignId) } });
```
`Number("CAMP19629S3064")` = NaN → endpoint returnerer enten 0 leads eller fejler. Funktionen virker kun hvis `adversus_campaign_id` er numerisk-formatted.

**Jeg har ikke verificeret hvilket format der dominerer i prod**. Begge sample-rækker viser CAMP-format, hvilket tyder på at webhook har skrevet dem først.

---

## 6. Rate limits — hvad Adversus gør med jer

### Officielle rate limits (afledt fra koden)

Adversus returnerer `429 Too Many Requests` ved over-brug. Adapter-koden antager:
- ~60 requests/minut (`RateLimiter(25, 900)` for normal mode i `buildLeadDataMap:622` — "stays well under 60/min limit").
- 1000 records/page max (`pageSize=1000`).
- `Retry-After` header kan være sekunder eller HTTP-date.

Adapter-throttling:
- `throttleMs = 500` mellem GET-requests (`adapter:51`).
- `delayMs = 2000` (normal) eller `1500` (fast-mode) mellem `/leads/{id}` fetches.
- 150ms efter hver sales-page.
- 400ms efter hver CDR-page.
- 200ms efter hver session-page.

### 429-håndtering

`adapter.get()` ved 429 (`adapter:135-149`):
1. Increment `rateLimitHits`-tæller.
2. Læs `Retry-After`-header. Format kan være sekunder (number) eller HTTP-date.
3. Exponential backoff: `5s, 10s, 20s` (capped) hvis ingen Retry-After.
4. Tilføj ±20% jitter.
5. Retry max 3 gange.

### Driftstilstande

Fra `docs/adversus-rate-limit-runbook.md` (selvdokumenteret):
- **Sales-sync hver 5. min, meta-sync hver 30. min**: split-cron for at reducere API-volumen.
- **Inkrementel sales sync** via watermark i `dialer_sync_state` — kun sales modificeret siden `last_success_at` (med 5 min overlap).
- **Provider-level locking** (`provider_sync_locks`-tabel): kun én Adversus-sync ad gangen, 10 min lock-expiration.
- **Per-integration run lock** (`integration_run_locks`-tabel): kun én sync pr. integration ad gangen.
- **Circuit breaker** (`integration_circuit_breaker`-tabel): efter 3/5/8 konsekutive failures → pause 15/30/60 min.
- **Provider quota gate** (`quota-gate.ts`): hvis nogen integration har rapporteret `rate_limit_remaining=0` og reset er i fremtiden → skip ALLE syncs for samme provider.
- **Danish working hours-gate**: Hvis klokken er udenfor 08:00-21:00 Europe/Copenhagen → skip sync (gælder både enreach og adversus, `sync-integration.ts:114`). Adversus syncs kører IKKE om natten.

### `lastModifiedTime` look-back cap

`adapter:220-226, 405-413`: max 7 dages look-back på `lastModifiedTime` for fetchSales, fetchSalesRange. Standard mode "uncapped=false". Backfill via `safe-backfill` action kan slå capping fra (`uncapped=true`).

### `maxRecords` pre-enrichment limit

`fetchSales` defaulter til `maxRecords=200` i `integration-engine/index.ts:43`. Salg nyere end de første N (sorteret efter closedTime DESC) drops før `buildLeadDataMap` køres. Dette afgrænser også antallet af `/leads/{id}` kald per sync.

---

## 7. Polling-flow vs webhook-flow — hvordan data ankommer

To parallelle veje fører Adversus-salg ind i `sales`-tabellen:

### Vej 1: Polling (kanonisk, kører hver 5-15 min)

Cron → `integration-engine` (`integration_id=<uuid>`) → `getAdapter("adversus")` → `AdversusAdapter`:

1. `fetchUsers()` — populerer agents-tabel.
2. `fetchSalesSequential()` — paginerer `/sales?filters=...&pageSize=1000`.
3. `filterEesyTmStateSuccess()` — Eesy TM kun `state='success'` rows beholdes (`adapter:22-49`).
4. Pre-enrichment limit (slice nyeste N).
5. `buildLeadDataMap()` — pr. unik leadId fetcher `/leads/{leadId}`. Rate-limited (25 req/min).
6. Map til `StandardSale[]` med `rawPayload: { ...sale, leadResultData, leadResultFields }`.
7. `integration-engine/core/sales.ts` → upsert til `sales` + `sale_items` (med pricing-rule-matching).
8. `fetchSessions()` + `fetchCalls()` ved meta-sync — populerer `dialer_sessions` + `dialer_calls`.

Den enrichede `rawPayload` i `sales.raw_payload` indeholder:
- Komplet sale-objekt fra `/sales` (id, leadId, campaignId, lines, state, closedTime, createdTime, ownedBy, etc.)
- `leadResultData`: Array fra `/leads/{id}`.resultData
- `leadResultFields`: Object-form derived fra arrayet.

### Vej 2: Webhook (live push, sekundær)

Adversus → `adversus-webhook` ELLER `dialer-webhook?dialer_id=<uuid>`:

1. Modtag payload (JSON eller form-data).
2. Gem rå event i `adversus_events` (jsonb-payload, 9636 rows i prod).
3. Slå campaign_mapping op via `payload.campaign.id` (string format!).
4. Resolv agent i `agents`-tabel (by external_adversus_id OR email).
5. Hvis same-day correction (samme `result_id` igen): slet tidligere `sales` + `sale_items`.
6. Hvis next-day correction: gem event men ignorer for metrics.
7. Insert `sales` + `sale_items` MED basispris-commission (ikke pricing-rule-matching).

### Konflikt mellem de to veje

- Webhook insertes RÅ pris (kun base products.commission_dkk × qty), ingen rule-matching.
- Polling (5-15 min senere) UPSERTER på `adversus_external_id` og DELETE+INSERT sale_items med fuld rule-matching.

Konsekvens: salg er kortvarigt (5-15 min) med forkert pris efter webhook-modtagelse, derefter rettet af polling. Dokumenteret i pricing-rapporten.

Også: webhook gemmer `result_id` (numerisk sale-id) som `adversus_external_id`. Polling gemmer `s.id`. Begge skulle være samme værdi. Men webhook har også `leadId` (= `payload.lead.id`) som fallback for de-duplication (`dialer-webhook:50-54`).

### Enrichment-healer (sekundær)

`enrichment-healer/index.ts` (cron) re-fetcher `/leads/{leadId}` for sales hvor `enrichment_status IN ('pending', 'failed')` — typisk webhook-inserted sales der mangler `leadResultData`. Opdaterer `raw_payload`-feltet med `leadResultData` og `leadResultFields`. Status'er: `pending`, `failed`, `healed`, `skipped`, `complete`.

`tdc-opp-backfill/index.ts` — specifik backfill for TDC Erhverv-kampagne der mangler `OPP nr` i leadResultData. Hardkodet `TDC_ERHVERV_CAMPAIGN_IDS = ["374ce55d-5b01-41b9-a009-aad5f0feb288"]`. Auto-runs in batches af 50.

---

## 8. Datatabeller — Adversus-domæne

| Tabel | Rows | Formål |
|---|---|---|
| `dialer_integrations` | 7 | Per-Adversus-konto credentials + config. 5 er provider='adversus' |
| `dialer_calls` | 312 288 | CDR fra Adversus + Enreach |
| `dialer_sessions` | 207 015 | Sessions fra Adversus + Enreach |
| `adversus_events` | 9 636 | Rå webhook-events (inkl. unparsed) |
| `adversus_campaign_mappings` | 126 | Adversus-campaign-id ↔ Stork client_campaign_id |
| `adversus_product_mappings` | 183 | Adversus-product-id (numerisk str) ↔ Stork product-uuid |
| `agents` | 223 | Per-dialer-bruger record. `external_adversus_id` for Adversus-users |
| `integration_sync_runs` | 95 410 | Audit-log pr. sync-kørsel |
| `integration_circuit_breaker` | 7 | Pause-state pr. integration |
| `integration_field_mappings` | (medium) | PII-normalisering — `source_field_path: "leadResultData[Kontakt nummer]"` osv. |
| `integration_debug_log` | 7 | Latest sync's raw data pr. provider |
| `provider_sync_locks` | 0 | Provider-level mutex |
| `integration_run_locks` | 0 | Per-integration mutex |
| `dialer_sync_state` | (lille) | Watermark for incremental sync |

### Felt-format i `adversus_events.payload`

Tabellen indeholder MANGE `event_type='unparsed_webhook'`-rækker — webhooks 1.0 ikke kunne parse. Sample (`docs/system-snapshot.md:223-289`) viser at `tryg`-integrationen (provider=enreach men sender via dialer-webhook) leverer en truncated/malformed body `","AgentEmail":"","AgentName":"",...` — det er Enreach der har glemt at indpakke i JSON-objekt. Disse ender i adversus_events trods navnet (alle dialer-events går til denne tabel).

Wait — det tyder på at `adversus_events` reelt fungerer som GENERISK dialer-event log, navnet til trods. Det er en historisk arv fra da kun Adversus eksisterede.

### Felt-format i `adversus_campaign_mappings.reference_extraction_config`

`docs/system-snapshot.md:141-181` — feltet er null i begge samples. Bruges af `integration-engine/core/mappings.ts:16` til at parametrisere OPP-extraction pr. kampagne. Format (fra TypeScript):
```ts
{
  type: "field_id" | "json_path" | "regex" | "static",
  value: string
}
```

For Adversus er extraction i prod typisk hardkodet (`/OPP-\d{4,6}/` regex på alle resultData-værdier i `adapter:614, 649`). Konfigurations-feltet eksisterer men bruges ikke aktivt.

---

## 9. Idiosynkrasier og edge cases — observeret i drift

Observationer der har drevet workarounds i koden. Disse er hvad Adversus FAKTISK gør i 1.0's konti, ikke nødvendigvis hvad dokumentationen siger.

1. **`{leads: [...]}` indpakning for single-resource GET**: `/leads/{id}` returnerer et array med ét element (`adapter:721-723`, `enrichment-healer:117-122`, `tdc-opp-backfill:178-181`). Hvert sted unwrapper independently.

2. **Inkonsistent /v1-prefiks-tolerance**: Same endpoints kaldes nogle steder med /v1 og andre uden — Adversus accepterer begge.

3. **`agentObj` kan være enten objekt eller scalar**: `sale.ownedBy` er nogle gange `{id, email, name}`, andre gange bare en `number`. Adapter har `typeof === "object"`-tjek (`adapter:280, 287`).

4. **Tomt email-felt på users**: Mange Adversus-users har email blank — 1.0 har 4-trins resolver med username-aliaser, lead-embedded emails, og userMap-lookup.

5. **`agent-{digits}@adversus.local` pseudo-emails**: Adversus genererer fake emails for users uden rigtig email. 1.0 udelukker disse med regex `^agent-\d+@adversus\.local$`.

6. **`displayName` vs `name`**: Begge findes på user-objekter — 1.0 prøver `name || displayName`.

7. **`closedTime` vs `createdTime`**: Sales har begge — sale_datetime bruger `closedTime || createdTime`. For nye/ulukkede sales kan `closedTime` være null.

8. **`state='cancelled'` på sale**: 1.0 sætter `validation_status='cancelled'` (`core/sales.ts:472-519`). Detektion er case-insensitive.

9. **Eesy TM special-case**: KUN sales med `state='success'` beholdes ved ingest (`adapter:22-49`). Andre kampagner får alle stater. Hardkodet på `EESY_TM_CLIENT_CAMPAIGN_ID = "d031126c-aec0-4b80-bbe2-bbc31c4f04ba"`.

10. **TDC Erhverv mangler ofte OPP i resultData**: Eget backfill-system kører `/leads/{id}` for ugamle sales uden OPP-nr.

11. **`Resultat af samtalen` vs `Resultat Af Samtalen` casing**: 1.0 har set begge i prod — heraf `ASE_KEY_MAP` med dual-casing-håndtering.

12. **Lønsikring variant-produkter**: Adversus har 10 forskellige product-id'er for varianter af samme produkt (Lønsikring Udvidet, Lønsikring Super, "under 5000", etc.). 1.0 normaliserer alle til standard-id `f9a8362f-3839-4247-961c-d5cd1e7cd37d` for pricing-rule-matching.

13. **Webhook event_time mangler ofte**: 1.0 defaulter til `new Date().toISOString()`.

14. **`resultData` array kan være null OG en tom array**: Skal håndtere begge (`Array.isArray()`-tjek alle steder).

15. **`resultData`-elementer kan mangle `id`** — adapter springer over hvis `field.id === undefined` (`adapter:641-657, adversus-diagnostics:131`).

16. **Form-data webhooks bruger danske feltnavne med mellemrum**: `Live Nummer`, `OPP nr`, `Kontakt nummer`, `NAVN FF Forsikring`, `Resultat Af Samtalen`. Disse er kunde-konfigurerede i Adversus per kampagne — kunden bestemmer label.

17. **CDR-endpoint starter på `page=0`**, mens andre starter på `page=1` (`adapter:930`).

18. **`/cdr`-response wrapper-key varierer**: `data.calls || data.cdr || data.cdrs || data.activities || data.data || data.results`. Adapter prøver alle.

19. **Webhook campaign.id-format afhænger af konfiguration i Adversus**: Numerisk i webhook template `{{campaignId}}` vs string-format `"CAMP19629S3064"` afhænger af hvad kampagne-administratoren har konfigureret i Adversus' webhook-template. 1.0 ser begge formater.

20. **Bug-prone Number() konvertering**: `Number(campaignId)` i `fetchLeadsForCampaign:827` returnerer NaN hvis Stork har gemt CAMP-prefix-format. Funktionen virker kun for numerisk-formatterede kampagne-ids.

21. **Sale-id (`s.id`) er numerisk, men gemmes som string** i `adversus_external_id`. Kollision mellem to Adversus-konti kan opstå hvis de bruger samme sale-id-range (ikke verificeret om Adversus har globalt unique id'er på tværs af konti).

22. **`adversus_external_id` i sale_items kan være null** — sample `docs/system-snapshot.md:349255` viser dette. Ikke alle produkter har en mapping-id; fall-back til titel-baseret mapping.

23. **`unitPrice=0` er normalt** for Adversus-products — provision/revenue beregnes ikke ud fra Adversus' priser. Adversus-line.unitPrice ignoreres helt af Stork.

24. **Test-data i prod**: `adversus_product_mappings` har en `adversus_external_id: "LIVE"` (ikke-numerisk) med titel "Live Test Produkt", product_id=null (`docs/system-snapshot.md:341-348`). Test-rest fra første opsætning.

---

## 10. Død og skygge-kode

1. **`sync-adversus` (2120 linjer)** — den oprindelige Adversus-sync. Ikke kaldt fra frontend (kun `integration-engine`-routen via Settings.tsx/MgTest.tsx). Stadig synlig som "Aktiv" badge i `CphAdversusApiTab.tsx:303` (hardkodet display). Indeholder `commission_transactions`-insert med forkerte kolonnenavne (se pricing-rapporten). **Død i call-graph, men ikke fjernet**.

2. **`adversus-sync-v2` (330 linjer)** — alternative sync der bruger globale env-vars `ADVERSUS_API_USERNAME`/`ADVERSUS_API_PASSWORD` i stedet for per-integration credentials. Kalde tre actions: sync-campaigns, sync-users, sync-sales. Ikke kaldt fra frontend. Listed i `LiveCronStatus.tsx:59` som "known job" — kan stadig være registreret som cron-job uden migration-spor.

3. **`adversus-webhook`** (470 linjer) — legacy webhook endpoint. Stadig live, men nye webhooks registreres via `adversus-create-webhook` til `dialer-webhook`-endpoint. Det betyder `adversus-webhook` modtager kun gamle, ikke-migrerede webhooks. **Halv-død**.

4. **`adversus-diagnostics`** (208 linjer) — manuel diagnose-tool for at finde OPP-felter pr. kampagne. UI-knap kun. Bruges sjældent.

5. **`adversus-lead-check`** (161 linjer) — manuelt lead-lookup-tool. UI-knap kun.

6. **`alka-attribution-probe`** og **`alka-reference-lookup`** — IKKE Adversus. De peger på `wshero01.herobase.com` (Enreach/HeroBase) men har "alka" i navnet fordi Alka A-kasse er en Enreach-kunde. Misnamed, men live.

7. **Trygs `tryg` integration sender Enreach-formaterede webhooks til dialer-webhook men `adversus_events.payload`-samples viser at de er broken**: `"","AgentEmail":""...` mangler åbnings-`{`. Disse ender som `unparsed_webhook`-events. Enreach-parser er disablet i `factory.ts:5`, så Tryg-webhooks fanges kun af adversus-parsers — men de fejler validation.

8. **`integration_run_locks`** (0 rows) og **`provider_sync_locks`** (0 rows) — locking-tabeller med ingen aktive rækker pt. Enten ingen sync kører lige nu, eller funktionaliteten bruges ikke konsistent.

---

## 11. Sammenfatning af det rå Adversus API

**Hvad Adversus tilbyder:**

- **REST API** på `https://api.adversus.io/v1` (med inkonsistent /v1-tolerance).
- **Basic Auth** (username + password — IKKE OAuth/keys).
- **JSON responses** med pluralis-wrapper-key (`{sales: [...]}`, `{leads: [...]}`).
- **Filter-DSL** i query: JSON-encoded objekter med `$gt`/`$lt`/`$eq`-operatorer.
- **Pagination**: `page=N` (varierende start-index) + `pageSize` (max 1000).
- **Webhooks**: konfigurérbar via `/webhooks` endpoint. Deliveres som JSON ELLER multipart/form-data afhængigt af konfiguration.
- **Rate limits**: 429-baseret, ~60 req/min (afledt), `Retry-After`-header understøttet.

**Kerne-resource-typer:**
- **Sales** (`/sales`): salgsevents med embedded campaign/lead/ownedBy info plus product-`lines`.
- **Leads** (`/leads`, `/leads/{id}`): kontakt-record med kunde-konfigureret `resultData`-array.
- **Users** (`/users`): agents/medarbejdere i Adversus.
- **Campaigns** (`/campaigns`): kampagne-definitioner inkl. felt-skema.
- **CDR** (`/cdr`): call-detail-records.
- **Sessions** (`/sessions`): per-lead-aktivitet.

**Idiosynkrasier 1.0 har lært at håndtere:**
- Wrapped single-record responses (`{leads:[lead]}`).
- Numeric vs string campaign-id (polling vs webhook).
- Empty user-emails → 4-trins resolver.
- Variable resultData casing (specielt ASE).
- Kunde-konfigurerede danske field-labels.
- Tilbageholdte 429-fejl (kan komme i bølger).
- Test-data i prod (`"LIVE"` product-id).

---

## 12. Hvad jeg ikke har verificeret empirisk

- **Hvor mange unikke aktive Adversus-konti der findes** — kode siger 5+ men jeg har kun set Lovablecph + Relatel_CPHSALES + tryg + eesy i diverse samples.
- **Hvorvidt det er TM-konti eller en blanding** — Tryg kan være TM eller FM-konfigureret.
- **Live cron-job-state** for `sync-adversus`/`adversus-sync-v2`/`enrichment-healer` — kun fra UI-spor.
- **Faktisk webhook-format pr. integration** — Tryg sender broken Enreach-format. De andre er ikke verificeret.
- **Format af `adversus_external_id` i sales-tabellen pr. integration** — er det numerisk eller CAMP-format dominerende? Sample i snapshot havde alle FM-rækker (ingen Adversus).
- **`reference_extraction_config`-brug** — alle samples viser null.
- **Om `dialer-webhook`-endpointet faktisk modtager Adversus-webhook-trafik** eller om alt går til `adversus-webhook`-endpointet.

