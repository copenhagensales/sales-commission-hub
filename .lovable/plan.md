

## Verificeret plan: Alka-only udvidelse uden påvirkning af andre integrationer

### Verifikationsresultater (gennemtjekket mod database + kode)

| Tjek | Resultat |
|---|---|
| Eksisterer Alka-salg i DB i dag? | **0 salg** — filteret blokerer alt nuværende Alka-trafik |
| Hvilke andre integrationer deler Alka's konfiguration? | **Tryg** bruger samme host (`wshero01`) + samme `calls_org_codes=["Copenhagen sales"]` |
| Hvor mange steder filtreres email-domæner? | 3× i `enreach.ts` (linje 503, 651, 740) + 1× i `core/users.ts` |
| Hvilken kolonne kan bære config? | `dialer_integrations.config` (JSONB) findes allerede — ingen migration nødvendig |
| Endpoint-routing | `usesLeadsEndpoint` returnerer `true` kun for `dialerName === "ase"` → Alka rammer `/simpleleads` |
| Calls-sync exclude-liste | `core/calls.ts` ekskluderer `@relatel.dk`, `@ase.dk` m.fl. — IKKE Alka-domæner → sikker |

### Kritiske risici planen håndterer

1. **Tryg deler `Copenhagen sales` orgCode med Alka** → vi må IKKE ændre Alka's `calls_org_codes` uden at vide hvilken orgCode der reelt tilhører Alka-agenter. Probe-fasen skal afklare dette FØR Fase 4.
2. **Hardkodet whitelist på 4 steder** → en pr-integration override skal læses i ALLE 4, ellers slipper salg igennem ét sted og blokeres et andet (inkonsistens).
3. **`config`-kolonnen bruges allerede** til `productExtraction`, `dataFilters` m.m. → vi skal læse i `DialerIntegrationConfig`-typen først for at undgå at overskrive eksisterende felter.

---

### Fase 1 — Probe-udvidelse (Alka-isoleret, ingen risiko)

**Fil:** `supabase/functions/probe-enreach-integration/index.ts` (eksisterer)

Tilføj én ny rapport-sektion `agentAudit` der:
- Henter seneste 100 success-leads fra Alka via `/simpleleads`
- Grupperer på `lastModifiedByUser.orgCode` og `firstProcessedByUser.orgCode`
- For hver orgCode: tæl, vis email-domæne, marker `wouldPassCurrentFilter` (true/false mod `@copenhagensales.dk`/`@cph-relatel.dk`/`@cph-sales.dk`)
- Returner top-10 + total `wouldBeFiltered`-count

**Output afgør Fase 2's whitelist-værdier.** Kører kun mod `integration_id=48d8bd23-...` → 0 påvirkning på Tryg/Eesy/ASE.

---

### Fase 2 — Pr-integration agent-domæne whitelist (Alka-only aktivering)

**Database:** Ingen migration. Vi skriver til `dialer_integrations.config` JSONB:
```json
{ "allowedAgentEmailDomains": ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk", "@<alka-domæne fra Fase 1>"] }
```
Kun Alka-rækken (`48d8bd23-...`) opdateres. Tryg/Eesy/ASE rører vi ikke → de har `null` for dette felt.

**Type-update:** `supabase/functions/integration-engine/types.ts` → `DialerIntegrationConfig` får valgfri `allowedAgentEmailDomains?: string[]`.

**Kode-ændringer (4 steder, alle med samme fallback-mønster):**
1. `enreach.ts` linje 503 (fetchSales)
2. `enreach.ts` linje 651 (fetchSalesRange)
3. `enreach.ts` linje 740 (mapLeadToSale — `VALID_AGENT_DOMAINS` for agent-attribution-fallback)
4. `core/users.ts` linje 6-15 (`VALID_EMAIL_DOMAINS`)

**Mønster pr. sted:**
```ts
const domains = this.config?.allowedAgentEmailDomains 
  ?? ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"]; // fallback = NUVÆRENDE adfærd
```

**Backwards-kompatibilitet garanteret:** Når `config.allowedAgentEmailDomains` er `undefined` (Tryg, Eesy, ASE, Adversus, Relatel, Lovablecph) → identisk opførsel med i dag. Ingen regression mulig.

`adversus.ts` (linje 265, 452) **rører vi ikke** — Alka er Enreach.

---

### Fase 3 — Udnyt nye `data`-felter (kun konfiguration, ingen kode)

Ingen kode-ændring. `mapLeadToSale` gemmer allerede hele `lead`-objektet i `raw_payload`. Når Fase 2 er ude og Alka-salg lander, kan `Notater`, `Forsikringsselskab`, `KVHXR`, `Gadenavn`, `Husnr` osv. tilgås via:
- UI: pricing rules conditional matching mod `raw_payload.data.<felt>`
- Sales-detail visning trækker direkte fra `raw_payload`

Hvis vi senere vil have et felt op som top-level kolonne, gøres det isoleret pr. felt.

---

### Fase 4 — Aktivér call-sync for Alka (kun hvis probe-rapporten bekræfter)

**Forudsætning:** Probe-fasen skal afdække den korrekte orgCode for Alka-agenter. Hvis det viser sig at Alka-agenter også bruger `"Copenhagen sales"` (ligesom Tryg), så er feltet allerede sat korrekt og call-sync vil virke når Fase 2 lander Alka-salg.

**Hvis probe viser en anden orgCode (fx `"TRYG Forsikring A/S"` som probe-rapporten antydede):**
- Opdatér `dialer_integrations.calls_org_codes` for Alka → fx `["TRYG Forsikring A/S"]`
- Tryg's egen `calls_org_codes` er stadig `["Copenhagen sales"]` → uændret
- `core/calls.ts` exclude-liste er verificeret: indeholder ikke Alka-relevante domæner → sikker

---

### Filer der berøres (komplet liste)

**Fase 1:**
- `supabase/functions/probe-enreach-integration/index.ts` (udvid)

**Fase 2:**
- `supabase/functions/integration-engine/types.ts` (tilføj felt til `DialerIntegrationConfig`)
- `supabase/functions/integration-engine/adapters/enreach.ts` (3 steder)
- `supabase/functions/integration-engine/core/users.ts` (1 sted)
- DB: én UPDATE på `dialer_integrations` hvor `id='48d8bd23-...'`

**Fase 3:** Ingen filer.

**Fase 4:** En UPDATE på `dialer_integrations.calls_org_codes` for Alka (kun hvis probe-fasen viser at det er nødvendigt).

### Filer/integrationer der EKSPLICIT IKKE røres
- `adapters/adversus.ts` — Adversus-integrationer påvirkes ikke
- `dialer_integrations` for Tryg, Eesy, ASE — config forbliver `null` på `allowedAgentEmailDomains` → fallback til hardkodet whitelist (= identisk med i dag)
- `core/calls.ts` exclude-liste — verificeret sikker for Alka
- `EXCLUDED_EMAIL_PATTERNS` (`agent-X@adversus.local`) — bevares
- `WHITELISTED_EMAILS` (gmail-undtagelser) — bevares globalt
- Cron-schedules / sync-frekvens
- UI / pricing rules / produktmapping — bruges først efter Fase 2

### Verificering pr. fase
- **Fase 1:** Probe-output rapporterer Alka's faktiske orgCodes + hvor mange ville passere nuværende filter. Hvis tallet er 0 bekræftes hypotesen.
- **Fase 2:** Smoke-test: kør Tryg sync (skal være uændret antal salg) + ASE sync (uændret) + Alka sync (skal nu lande >0 salg). Sammenlign agent-emails på nye Alka-rækker mod whitelist fra Fase 1.
- **Fase 4:** `dialer_calls`-rækker dukker op for Alka uden at Tryg's call-sync ændres.

### Anbefalet rækkefølge
1. Godkend Fase 1 alene (5 minutters edge-function-edit, nul risiko)
2. Læs probe-output sammen → beslut Alka-domæner og om Fase 4 er nødvendig
3. Godkend Fase 2 (lille kode-diff, fuld backwards-kompatibilitet)
4. Verificér via smoke-test at andre integrationer er uændrede
5. Beslut Fase 3/4 separat

