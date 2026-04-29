# Plan: UI-fix for skjulte ASE-annulleringer

Kvikfix. UI-only. Ingen DB. Ingen migrationer. Ingen rød zone. Præcis 2 filer.

## Problem

33 ASE-sager (24 godkendte + 9 afviste) er usynlige i `ApprovedTab` og `ApprovalQueueTab` fordi filter/dropdown/search bruger rå `agent_name`/`agent_email` i stedet for resolved medarbejdernavn. Sælgere med flere email-aliaser optræder flere gange i dropdownen, og hver filtrering rammer kun delmængden.

`useAgentNameResolver` har allerede al data — den bruges bare ikke i selve filter-logikken.

## Fil 1: `src/components/cancellations/ApprovedTab.tsx`

### Ændring A — Sælger-dropdown med resolved navn som unique key
Linje 228-231 (`sellers`-useMemo):
- Byg `Map<resolvedName, Set<rawValues>>` så hver person kun optræder én gang.
- Render `<SelectItem value={resolvedName}>` med resolved navn som både value og label.

### Ændring B — Filter sammenligner resolved navne
Linje 235:
```ts
result.filter((i) => resolve(i.agentName) === sellerFilter)
```

### Ændring C — Søg matcher både rå og resolved navn
Linje 240, tilføj OR-clause:
```ts
resolve(i.agentName).toLowerCase().includes(q)
```

### Ændring D — To separate provision-kolonner (kun ASE)
Semantisk korrekt: ASE's tal og Stork's beregnede commission er forskellige ting og skal vises hver for sig.

- Udvid select-listen i `useQuery` (linje 46) — `sale_items` hentes allerede via `sale_items(product:products(name))`; udvid til `sale_items(mapped_commission, product:products(name))`.
- I mappingen (linje 104) tilføj to felter:
  - `uploadedProvision`: eksisterende `provValue`-logik (uploaded_data.Provision)
  - `systemCommission`: `sum(sale_items.mapped_commission)`
- I tabellen (linje 349 + 372): erstat den ene kolonne `Provision` med to kolonner `Uploaded provision` og `System commission`.
- **Kun ASE** (`{isAse && ...}` wrapper bevares). Andre clients: uændret — beholder eksisterende enkelt-kolonne-adfærd.

## Fil 2: `src/components/cancellations/ApprovalQueueTab.tsx`

Tre ændringer (provision urørt — `mapped_commission` bruges allerede direkte på linje 1329 og 1485).

### Ændring A — `allSellers` dropdown (linje 1051-1056)
Samme behandling: `Map<resolvedName, Set<rawValues>>` så hver person kun optræder én gang i dropdownen.

### Ændring B — Filter virker for både group-view OG flat-view (linje 1066-1069)
Group-view kan have flere agenter pr. OPP-gruppe. Hvis vi kun resolver én værdi, falder grupper med flere sælgere ud:
```ts
const resolvedAgents = (item as any).agents?.map((a: string) => resolve(a))
  ?? [resolve((item as any).agentName)];
return resolvedAgents.includes(sellerFilter);
```

### Ændring C — Søg matcher både rå og resolved navne
**Flat-view (linje 1110):**
```ts
i => [i.agentName, resolve(i.agentName), i.oppNumber, i.phone, i.company, i.fileName].join(" ")
```

**Group-view (linje 1101):**
```ts
g => [g.oppGroup, ...(g.agents ?? []), ...(g.agents ?? []).map((a: string) => resolve(a)), g.fileName].join(" ")
```

## Hvad der IKKE røres

- `useAgentNameResolver.ts` — virker korrekt
- `UnmatchedTab.tsx`, `DuplicatesTab.tsx`, `ManualCancellationsTab.tsx` — har samme bug-mønster, men rammer ikke de 33 sager. Parkeret til Stork 2.0.
- DB-skema, migrationer, RLS, edge functions, pricing-motor, `cancellation_queue`, `sale_items`
- Alle filer i rød zone

## Acceptkriterier (verificeres efter implementation)

1. ApprovedTab for ASE: total-tæller +33 (24 godkendte + 9 afviste tidligere skjulte)
2. Søg på "Alexander Godsk Callesen" finder rækker uanset email-attribution
3. Dropdown: hver person optræder kun én gang
4. Filter på resolved navn fanger alle email-aliaser
5. ApprovedTab ASE: to kolonner "Uploaded provision" + "System commission" synlige
6. ApprovedTab andre clients: uændret enkelt-kolonne (provision-kolonnen er allerede `{isAse && ...}`-wrappet, så den vises kun for ASE i dag — ingen ændring for andre)
7. ApprovalQueueTab group-view OG flat-view filter virker med resolved navn
8. ApprovalQueueTab søg matcher både rå og resolved

## Kvalitetskrav

- Ingen `: any` i ny kode (brug Database-typer; eksisterende `as any`-casts bevares uændret)
- Ingen efterladte `console.log`
- Ingen hardkodede rolle-keys
- Lowercase-håndtering konsistent med eksisterende `resolve()`-implementation (den lowercaser selv)
- `useAgentNameResolver` bruges til alle resolve-kald — ingen duplikeret logik

## Stop-betingelser under implementation

Hvis jeg under bygning opdager noget af følgende, **STOPPER jeg og rapporterer** før jeg fortsætter:
- En ekstra fil ud over de 2 angivne skal røres
- En migration er nødvendig (rød alarm — kvikfix-rammen er forkert)
- En eksisterende helper/hook gør allerede det samme

## Færdig-rapport vil indeholde

- Liste over præcis hvilke filer der er ændret + linjeantal pr. fil
- Eksplicit bekræftelse: ingen migrationer tilføjet
- Eksplicit bekræftelse: ingen filer ud over de 2 angivne er rørt
