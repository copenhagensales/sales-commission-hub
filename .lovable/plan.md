

# FM Forecast & Profit Agent — Ny fane i Booking

## Overblik
Tilføj en ny fane "Profit Agent" til BookingManagement-siden (`/vagt-flow/booking?tab=profit-agent`) med et fuldt internt analytics-dashboard der dekomponerer FM-performance i lokations-, sælger- og kombinationseffekter.

## Struktur

### 1. `BookingManagement.tsx` — Tilføj fane
- Ny tab: `{ value: "profit-agent", label: "Profit Agent", icon: Brain, permissionKey: "tab_fm_locations" }`
- Lazy-load ny komponent `FmProfitAgentContent`

### 2. `FmProfitAgentContent.tsx` — Hovedkomponent (~600 linjer)
Indeholder 4 interne sub-tabs: **Oversigt**, **Driver-analyse**, **Forecast**, **Risiko**

**Realistisk mock-data** med ~15 lokationer og ~10 sælgere der illustrerer:
- Lokationer der ser stærke ud men er sælger-drevne
- Sælgere der performer konsistent på tværs
- Stærke kombinationer med begrænset data
- Høj omsætning men svag DB

**Scoring-model (mock):**
- `locationScore`: Varians mellem sælgere på samme lokation (lav varians = stærk lokation)
- `sellerScore`: Varians mellem lokationer for samme sælger (lav varians = stærk sælger)
- `combinationScore`: Afvigelse fra forventet (lokation + sælger individuelt)
- `confidence`: Baseret på antal observationer

**Driver-klassifikation:**
- Location-driven: Høj locationScore, lav sellerScore-dominans
- Seller-driven: Høj sellerScore, stor forskel mellem sælgere
- Combination-driven: combinationScore > forventet
- Uncertain: For få datapunkter

### Sub-tabs indhold:

**Oversigt:**
- KPI-kort: Total DB, Gns. DB%, Bedste lokation, Bedste sælger, Risiko-flag antal
- Top 5 lokationer (ranket på DB med driver-badge)
- Top 5 sælgere (ranket på DB med konsistens-badge)
- AI-indsigt panel med naturligt sprog

**Driver-analyse:**
- Seller/location matrix-heatmap (tabel)
- Variance-chart: Spredning mellem sælgere per lokation
- Filtre: Datospænd, lokation, sælger
- Sammenligning: Vælg 2+ lokationer eller 2+ sælgere side-by-side
- Forklaringstekster per resultat

**Forecast:**
- Anbefalingskort per lokation: Forventet DB, Anbefalet sælger, Konfidensgrad, Hoveddiver, Risikoniveau
- Næste-uge planlægningsvisning

**Risiko:**
- Flag-liste: For lidt data, højt sælger-afhængig lokation, omkostningsfølsom, ustabil historik, misvisende høj omsætning

### UI-stil
- Premium SaaS-look med Cards, Charts (recharts), Tables
- Klar typografi og spacing
- Farve-kodede badges for driver-type (grøn=lokation, blå=sælger, lilla=kombination, grå=usikker)

| Fil | Ændring |
|-----|---------|
| `BookingManagement.tsx` | Tilføj "Profit Agent" tab + lazy import |
| `FmProfitAgentContent.tsx` | Ny fil — fuldt dashboard med mock data og 4 sub-tabs |

