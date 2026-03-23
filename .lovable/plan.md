

# FM Profit Agent — Rigtig data + AI Chat-interface

## Overblik
Erstat mock-data med rigtige FM-salgsdata fra databasen og ombyg hele UI'et til et **chat-baseret interface** hvor managere kan stille spørgsmål om lokationer, sælgere og profitabilitet. AI'en har adgang til de beregnede scores og observations og svarer i naturligt sprog.

## Arkitektur

```text
┌─────────────────────────────────────────┐
│  FmProfitAgentContent.tsx               │
│  ┌───────────────────────────────────┐  │
│  │  Chat interface (besked-liste)    │  │
│  │  - Bruger spørgsmål               │  │
│  │  - AI svar med markdown           │  │
│  │  - Inline KPI-kort & tabeller     │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Input + quick-action chips       │  │
│  │  "Bedste lokationer?" "Risiko?"   │  │
│  └───────────────────────────────────┘  │
└────────────┬────────────────────────────┘
             │ invoke
┌────────────▼────────────────────────────┐
│  Edge function: fm-profit-agent         │
│  1. Hent FM data (sales, bookings,      │
│     costs, employees, locations)        │
│  2. Beregn observations & scores        │
│  3. Byg kontekst-prompt med data        │
│  4. Kald Lovable AI med brugerens       │
│     spørgsmål + data-kontekst           │
│  5. Stream svar tilbage                 │
└─────────────────────────────────────────┘
```

## Ændringer

### 1. Ny edge function: `supabase/functions/fm-profit-agent/index.ts`
- Modtager `{ message, history }` fra frontend
- Henter FM-data fra databasen:
  - `sales` (source=fieldmarketing, seneste 12 uger) med `sale_items` og `raw_payload` (fm_location_id, fm_seller_id)
  - `fm_locations` (navn)
  - `employee_master_data` (sælgernavne via fm_seller_id)
  - `booking` + `booking_hotel` + `booking_diet` (omkostninger)
- Beregner observations (samme scoring-logik som nuværende, men med rigtige data)
- Bygger et system-prompt med:
  - Aggregerede lokationsscores, sælgerscores, kombinationer
  - Totaler, trends, risikoflag
- Kalder Lovable AI Gateway med streaming
- Returnerer SSE stream

### 2. Omskriv `FmProfitAgentContent.tsx` — Chat UI
- Fjern alle 4 sub-tabs og mock-data
- Erstat med chat-interface:
  - Beskedliste med bruger/AI-bobler
  - Markdown-rendering af AI-svar (react-markdown)
  - Quick-action chips: "Oversigt", "Bedste lokationer", "Driver-analyse", "Risikoflag", "Forecast næste uge"
  - Streaming af AI-svar token-by-token
- Brug `supabase.functions.invoke('fm-profit-agent', ...)` med streaming
- Behold premium SaaS-look med clean cards og spacing

### 3. Quick-action chips (foreslåede spørgsmål)
- "Giv mig en oversigt over alle lokationer"
- "Hvilke lokationer er sælger-drevne?"
- "Hvem er de bedste sælgere?"
- "Vis risikoflag"
- "Hvor bør vi stå næste uge?"
- "Sammenlign Fields og Lyngby Storcenter"

## Data-flow i edge function

```text
1. Hent sales (12 uger) → grupper per uge/lokation/sælger
2. Hent omkostninger fra booking/hotel/diet
3. Beregn: revenue, commission, sellerCost, locationCost, hotelCost, dietCost, DB
4. Kør scoring-engine (location/seller/combo scores)
5. Formatér som kontekst-tekst til AI
6. Send til Lovable AI med brugerens spørgsmål
```

| Fil | Ændring |
|-----|---------|
| `supabase/functions/fm-profit-agent/index.ts` | Ny edge function — data + AI |
| `src/pages/vagt-flow/FmProfitAgentContent.tsx` | Omskriv til chat-interface |

