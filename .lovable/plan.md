

# Ny fane: Sælgeroversigt på Salgsvalidering

## Koncept
En ny Tabs-baseret visning på SalesValidation-siden med to faner:
1. **Validering** (eksisterende) — input, matching, resultater
2. **Sælgeroversigt** (ny) — aggregeret per-sælger tabel baseret på valideringsresultater

Når der er valgt en kunde + periode og der er kørt en validering (eller indlæst en tidligere), viser fane 2 en tabel med:

| Sælger | Totale salg | Verificerede | Uverificerede | Annulleringer | Verificeringsrate |
|--------|------------|--------------|---------------|---------------|-------------------|
| Kasper M | 45 | 32 | 10 | 3 | 71% |

## Data
Bruger den eksisterende `results` state (array af `MatchResult[]`), som allerede indeholder `matched.agentName` og `category`. Aggregerer client-side med `useMemo` — ingen ny query nødvendig.

Beregninger per sælger:
- **Totale salg**: `verified_sale` + `unverified_sale` + `matched_cancellation` (alle med denne sælger)
- **Verificerede**: `category === "verified_sale"`
- **Uverificerede**: `category === "unverified_sale"`
- **Annulleringer**: `category === "matched_cancellation"`
- **Verificeringsrate**: `verificerede / (verificerede + uverificerede)` i procent

Sorteret efter totale salg, faldende.

## Teknisk

### `src/pages/economic/SalesValidation.tsx`

1. **Import** `Tabs, TabsContent, TabsList, TabsTrigger` fra `@/components/ui/tabs`
2. **Ny `useMemo`**: `sellerStats` der grupperer `results` per `agentName` og beregner de 5 kolonner
3. **Wrap** eksisterende indhold i `<TabsContent value="validation">` og tilføj `<TabsContent value="sellers">` med tabellen
4. `Tabs` placeres lige efter kunde/periode-vælgeren og KPI-kortene, så begge faner deler dem

### UI for sælger-fanen
- Tabel med kolonner: Sælger, Total, Verificerede, Uverificerede, Annulleringer, Rate
- Farve-kodning: grøn badge for høj rate (>80%), gul for middel (50-80%), rød for lav (<50%)
- Vis "Kør en validering først" besked hvis `results` er null
- Totalrække i bunden

| Fil | Ændring |
|-----|---------|
| `src/pages/economic/SalesValidation.tsx` | Tilføj Tabs + sælgeroversigt fane |

