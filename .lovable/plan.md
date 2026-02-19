

# Ny fane: "System Kort" — Live statuskort med advarsler

## Formaal

En tredje fane der viser et forenklet, visuelt live-kort over hele systemet. Kun fokus paa status og advarsler — ingen detaljer, ingen tabeller. Tænk "kontrol-rum" overblik hvor man med et blik kan se om alt er grønt eller om noget brænder.

## Hvad bygges

### 1. Ny fane i `SystemStability.tsx`

Tilfoej en tredje tab:

```text
<TabsTrigger value="map">System Kort</TabsTrigger>
```

Renderer en ny komponent `<SystemStatusMap />` med samme props som `SystemArchitectureDiagram`.

### 2. Ny fil: `src/components/system-stability/SystemStatusMap.tsx`

Et visuelt kort bygget som et flowchart med store, farvede noder og animerede forbindelser. Inspireret af referencebildedet men med moerk/moderne dark-mode stil.

**Layout (5 kolonner paa desktop, vertikal paa mobil):**

```text
[KILDER]  -->  [ENGINE]  -->  [DATABASE]  -->  [KPI ENGINE]  -->  [OUTPUT]
```

**Hver node er en stor, visuel blok med:**
- Ikon + titel
- Live statusfarve som baggrund-glow (emerald/amber/red)
- Pulserende ring-animation naar aktiv
- Overload/fejl badge der popper op med advarselstekst

**Noder i kortet:**

Kolonne 1 — Eksterne Kilder:
- Adversus API (farve baseret paa metriker)
- Enreach API (farve baseret paa metriker)
- Webhooks (samlet node: Adversus, Dialer, e-conomic, Zapier)
- Twilio

Kolonne 2 — Processing:
- Integration Engine (viser adapter-status + rate limiter)
- Webhook Processors (samlet)

Kolonne 3 — Database:
- Samlet database-node med records/time tæller

Kolonne 4 — KPI Engine:
- pg_cron (antal aktive jobs)
- KPI Edge Functions (samlet)

Kolonne 5 — Output:
- Cache Tabeller
- Klient Dashboards (alle 6-7 dashboards som sub-items)

**Forbindelseslinjer:**
- SVG-baserede kurver mellem kolonnerne
- Groen = OK, amber = advarsel, roed = overload med pulse
- Animeret dash-stroke paa aktive flows

**Overload/fejl advarsler:**
- Naar `used1m > 80%` eller `used60m > 80%`: Noden faar roed pulserende border + "OVERLOAD" badge
- Naar `successRate1h < 80%`: Noden faar roed glow + "FEJL" badge med fejlbesked
- Naar `successRate1h < 95%`: Amber glow + "ADVARSEL" badge
- Systemwid throughput-gauge i toppen (genbruger logik fra SystemArchitectureDiagram)

**UI-stil:**
- Store runde eller afrundede kort (ikke smaa som i opsaetnings-fanen)
- Glassmorphism: `backdrop-blur-xl bg-card/60`
- Farve-glow shadows der matcher status
- Hover viser tooltip med noegletal
- Responsivt: Desktop = horisontal flow, mobil = vertikal stack

### 3. Aendring i `SystemStability.tsx`

- Tilfoej `<TabsTrigger value="map">System Kort</TabsTrigger>`
- Tilfoej `<TabsContent value="map">` der renderer `<SystemStatusMap />`
- Props er identiske med dem der allerede sendes til `SystemArchitectureDiagram`

## Filer der aendres

| Fil | Aendring |
|-----|----------|
| `src/pages/SystemStability.tsx` | Tilfoej tredje tab + import |
| `src/components/system-stability/SystemStatusMap.tsx` | **NY** — hele status-kortet |

## Ingen andre filer roeres

Eksisterende tabs og komponenter forbliver uaendrede.

